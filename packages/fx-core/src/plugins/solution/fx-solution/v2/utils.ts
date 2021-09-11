import {
  v2,
  Inputs,
  FxError,
  Result,
  ok,
  err,
  AzureSolutionSettings,
  Void,
  PermissionRequestProvider,
  Json,
  UserError,
  SystemError,
} from "@microsoft/teamsfx-api";
import { LocalSettingsTeamsAppKeys } from "../../../../common/localSettingsConstants";
import { SolutionError } from "../constants";
import { AzureResourceApim, AzureResourceFunction, AzureResourceSQL, AzureSolutionQuestionNames, BotOptionItem, HostTypeOptionAzure, MessageExtensionItem, TabOptionItem } from "../question";
import {
  getActivatedV2ResourcePlugins,
} from "../ResourcePluginContainer";

export function getSelectedPlugins(azureSettings: AzureSolutionSettings): v2.ResourcePlugin[] {
  const plugins = getActivatedV2ResourcePlugins(azureSettings);
  azureSettings.activeResourcePlugins = plugins.map((p) => p.name);
  return plugins;
}

export function getAzureSolutionSettings(ctx: v2.Context): AzureSolutionSettings {
  return ctx.projectSetting.solutionSettings as AzureSolutionSettings;
}

export function isAzureProject(azureSettings: AzureSolutionSettings): boolean {
  return HostTypeOptionAzure.id === azureSettings.hostType;
}

export function combineRecords(records: { name: string; result: Json }[]): Record<string, Json> {
  const ret: Record<v2.PluginName, Json> = {};
  for (const record of records) {
    ret[record.name] = record.result;
  }

  return ret;
}

export function extractSolutionInputs(record: Record<string, string>): v2.SolutionInputs {
  return {
    resourceNameSuffix: record["resourceNameSuffix"],
    resourceGroupName: record["resourceGroupName"],
    location: record["location"],
    teamsAppTenantId: record["teamsAppTenantId"],
    remoteTeamsAppId: undefined,
  };
}

export function reloadV2Plugins(solutionSettings: AzureSolutionSettings): v2.ResourcePlugin[] {
  const res = getActivatedV2ResourcePlugins(solutionSettings);
  solutionSettings.activeResourcePlugins = res.map((p) => p.name);
  return res;
}

export async function ensurePermissionRequest(
  solutionSettings: AzureSolutionSettings,
  permissionRequestProvider: PermissionRequestProvider
): Promise<Result<Void, FxError>> {
  if (solutionSettings.migrateFromV1) {
    return ok(Void);
  }

  if (!isAzureProject(solutionSettings)) {
    return err(
      new UserError( "Solution","Cannot update permission for SPFx project",
        SolutionError.CannotUpdatePermissionForSPFx
      )
    );
  }

  const result = await permissionRequestProvider.checkPermissionRequest();
  if (result.isErr()) {
    return result.map(err);
  }

  return ok(Void);
}

export function parseTeamsAppTenantId(
  appStudioToken?: Record<string, unknown>
): Result<string, FxError> {
  if (appStudioToken === undefined) {
    return err(
      new SystemError(
        "Solution","Graph token json is undefined",
        SolutionError.NoAppStudioToken
      )
    );
  }

  const teamsAppTenantId = appStudioToken["tid"];
  if (
    teamsAppTenantId === undefined ||
    !(typeof teamsAppTenantId === "string") ||
    teamsAppTenantId.length === 0
  ) {
    return err(
      new SystemError( "Solution", "Cannot find teams app tenant id",
        SolutionError.NoTeamsAppTenantId
      )
    );
  }
  return ok(teamsAppTenantId);
}

// Loads teams app tenant id into local settings.
export function loadTeamsAppTenantIdForLocal(
  localSettings: v2.LocalSettings,
  appStudioToken?: Record<string, unknown>
): Result<Void, FxError> {
  return parseTeamsAppTenantId(appStudioToken as Record<string, unknown> | undefined).andThen(
    (teamsAppTenantId) => {
      localSettings.teamsApp[LocalSettingsTeamsAppKeys.TenantId] = teamsAppTenantId;
      return ok(Void);
    }
  );
}



export function fillInSolutionSettings(solutionSettings: AzureSolutionSettings, answers: Inputs): Result<Void, FxError> {
  const capabilities = (answers[AzureSolutionQuestionNames.Capabilities] as string[]) || [];
  if (!capabilities || capabilities.length === 0) {
    return err(
      new SystemError(
        "Solution", "capabilities is empty", 
        SolutionError.InternelError
      )
    );
  }
  let hostType = answers[AzureSolutionQuestionNames.HostType] as string;
  if (capabilities.includes(BotOptionItem.id) || capabilities.includes(MessageExtensionItem.id))
    hostType = HostTypeOptionAzure.id;
  if (!hostType) {
    return err(
      new SystemError(
        "Solution", "hostType is undefined",
        SolutionError.InternelError
      )
    );
  }
  solutionSettings.hostType = hostType;
  let azureResources: string[] | undefined;
  if (hostType === HostTypeOptionAzure.id && capabilities.includes(TabOptionItem.id)) {
    azureResources = answers[AzureSolutionQuestionNames.AzureResources] as string[];
    if (azureResources) {
      if (
        (azureResources.includes(AzureResourceSQL.id) ||
          azureResources.includes(AzureResourceApim.id)) &&
        !azureResources.includes(AzureResourceFunction.id)
      ) {
        azureResources.push(AzureResourceFunction.id);
      }
    } else azureResources = [];
  }
  solutionSettings.azureResources = azureResources || [];
  solutionSettings.capabilities = capabilities || [];
  return ok(Void);
}