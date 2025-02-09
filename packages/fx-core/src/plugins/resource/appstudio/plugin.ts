// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  ok,
  err,
  AzureSolutionSettings,
  ConfigFolderName,
  FxError,
  Result,
  PluginContext,
  TeamsAppManifest,
  LogProvider,
  ProjectSettings,
  IComposeExtension,
  IBot,
  AppPackageFolderName,
  ArchiveFolderName,
  V1ManifestFileName,
} from "@microsoft/teamsfx-api";
import { AppStudioClient } from "./appStudio";
import {
  IAppDefinition,
  IMessagingExtension,
  IAppDefinitionBot,
  ITeamCommand,
  IPersonalCommand,
  IGroupChatCommand,
  IUserList,
} from "./interfaces/IAppDefinition";
import { ICommand, ICommandList } from "../../solution/fx-solution/appstudio/interface";
import {
  BotOptionItem,
  HostTypeOptionAzure,
  MessageExtensionItem,
  TabOptionItem,
} from "../../solution/fx-solution/question";
import {
  LOCAL_DEBUG_TAB_ENDPOINT,
  LOCAL_DEBUG_TAB_DOMAIN,
  LOCAL_DEBUG_AAD_ID,
  LOCAL_DEBUG_TEAMS_APP_ID,
  REMOTE_AAD_ID,
  LOCAL_DEBUG_BOT_DOMAIN,
  BOT_DOMAIN,
  LOCAL_WEB_APPLICATION_INFO_SOURCE,
  WEB_APPLICATION_INFO_SOURCE,
  PluginNames,
  SOLUTION_PROVISION_SUCCEEDED,
  REMOTE_TEAMS_APP_ID,
} from "../../solution/fx-solution/constants";
import { AppStudioError } from "./errors";
import { AppStudioResultFactory } from "./results";
import {
  Constants,
  TEAMS_APP_MANIFEST_TEMPLATE,
  CONFIGURABLE_TABS_TPL,
  STATIC_TABS_TPL,
  BOTS_TPL,
  COMPOSE_EXTENSIONS_TPL,
  TEAMS_APP_SHORT_NAME_MAX_LENGTH,
  DEFAULT_DEVELOPER_WEBSITE_URL,
  DEFAULT_DEVELOPER_TERM_OF_USE_URL,
  DEFAULT_DEVELOPER_PRIVACY_URL,
  FRONTEND_ENDPOINT,
  FRONTEND_DOMAIN,
  LOCAL_BOT_ID,
  BOT_ID,
  REMOTE_MANIFEST,
  FRONTEND_ENDPOINT_ARM,
  FRONTEND_DOMAIN_ARM,
  ErrorMessages,
  SOLUTION,
  MANIFEST_TEMPLATE,
  TEAMS_APP_MANIFEST_TEMPLATE_FOR_MULTI_ENV,
  STATIC_TABS_TPL_FOR_MULTI_ENV,
  CONFIGURABLE_TABS_TPL_FOR_MULTI_ENV,
  BOTS_TPL_FOR_MULTI_ENV,
  COMPOSE_EXTENSIONS_TPL_FOR_MULTI_ENV,
} from "./constants";
import AdmZip from "adm-zip";
import * as fs from "fs-extra";
import { getTemplatesFolder, isV2 } from "../../..";
import path from "path";
import { getArmOutput } from "../utils4v2";
import {
  isArmSupportEnabled,
  isMultiEnvEnabled,
  getAppDirectory,
  isSPFxProject,
} from "../../../common";
import {
  LocalSettingsAuthKeys,
  LocalSettingsBotKeys,
  LocalSettingsFrontendKeys,
  LocalSettingsTeamsAppKeys,
} from "../../../common/localSettingsConstants";
import { v4 } from "uuid";
import isUUID from "validator/lib/isUUID";
import { ResourcePermission, TeamsAppAdmin } from "../../../common/permissionInterface";
import Mustache from "mustache";

export class AppStudioPluginImpl {
  public async getAppDefinitionAndUpdate(
    ctx: PluginContext,
    type: "localDebug" | "remote",
    manifest: TeamsAppManifest
  ): Promise<Result<string, FxError>> {
    let appDefinition: IAppDefinition;
    let teamsAppId: Result<string, FxError>;
    const appDirectory = await getAppDirectory(ctx.root);
    const appStudioToken = await ctx.appStudioToken?.getAccessToken();

    if (type == "localDebug") {
      const appDefinitionAndManifest = await this.getAppDefinitionAndManifest(ctx, true);

      if (appDefinitionAndManifest.isErr()) {
        return err(appDefinitionAndManifest.error);
      }

      appDefinition = appDefinitionAndManifest.value[0];

      const localTeamsAppID = this.getTeamsAppId(ctx, true);

      let createIfNotExist = false;
      if (!localTeamsAppID) {
        createIfNotExist = true;
      } else {
        const appStudioToken = await ctx?.appStudioToken?.getAccessToken();
        try {
          await AppStudioClient.getApp(localTeamsAppID, appStudioToken!, ctx.logProvider);
        } catch (error) {
          createIfNotExist = true;
        }
      }

      teamsAppId = await this.updateApp(
        ctx,
        appDefinition,
        appStudioToken!,
        type,
        createIfNotExist,
        appDirectory,
        createIfNotExist ? undefined : localTeamsAppID,
        ctx.logProvider
      );

      return teamsAppId;
    } else {
      appDefinition = this.convertToAppDefinition(manifest, true);

      teamsAppId = await this.updateApp(
        ctx,
        appDefinition,
        appStudioToken!,
        type,
        true,
        appDirectory,
        undefined,
        ctx.logProvider
      );

      return teamsAppId;
    }
  }

  private async getSPFxLocalDebugAppDefinitionAndUpdate(
    ctx: PluginContext,
    manifest: TeamsAppManifest
  ): Promise<Result<string, FxError>> {
    const appDirectory = await getAppDirectory(ctx.root);
    const appStudioToken = await ctx.appStudioToken?.getAccessToken();
    const localTeamsAppID = this.getTeamsAppId(ctx, true);
    let createIfNotExist = false;
    if (localTeamsAppID) {
      manifest.id = localTeamsAppID;
    } else {
      manifest.id = "";
      createIfNotExist = true;
    }
    if (manifest.configurableTabs) {
      for (const tab of manifest.configurableTabs) {
        const reg = /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/;
        const result = tab.configurationUrl.match(reg);
        if (result && result.length > 0) {
          const componentID = result[0];
          tab.configurationUrl = `https://{teamSiteDomain}{teamSitePath}/_layouts/15/TeamsLogon.aspx?SPFX=true&dest={teamSitePath}/_layouts/15/TeamsWorkBench.aspx%3FcomponentId=${componentID}%26openPropertyPane=true%26teams%26forceLocale={locale}%26loadSPFX%3Dtrue%26debugManifestsFile%3Dhttps%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fmanifests.js`;
        } else {
          const message =
            "Cannot find componentID in configurableTabs[0].configrationUrl, local debug may fail.";
          ctx.logProvider?.error(message);
          ctx.ui?.showMessage("warn", message, false);
        }
      }
    }
    if (manifest.staticTabs) {
      for (const tab of manifest.staticTabs) {
        const componentID = tab.entityId;
        tab.contentUrl = `https://{teamSiteDomain}/_layouts/15/TeamsLogon.aspx?SPFX=true&dest={teamSitePath}/_layouts/15/TeamsWorkBench.aspx%3FcomponentId=${componentID}%26teams%26personal%26forceLocale={locale}%26loadSPFX%3Dtrue%26debugManifestsFile%3Dhttps%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fmanifests.js`;
      }
    }
    const appDefinition: IAppDefinition = this.convertToAppDefinition(manifest, false);
    const teamsAppId = await this.updateApp(
      ctx,
      appDefinition,
      appStudioToken!,
      "localDebug",
      createIfNotExist,
      appDirectory,
      createIfNotExist ? undefined : localTeamsAppID,
      ctx.logProvider
    );

    return teamsAppId;
  }

  /**
   * ask app common questions to generate app manifest
   * @param settings
   * @returns
   */
  public async createManifest(settings: ProjectSettings): Promise<TeamsAppManifest | undefined> {
    const solutionSettings: AzureSolutionSettings =
      settings.solutionSettings as AzureSolutionSettings;
    if (
      !solutionSettings.capabilities ||
      (!solutionSettings.capabilities.includes(BotOptionItem.id) &&
        !solutionSettings.capabilities.includes(MessageExtensionItem.id) &&
        !solutionSettings.capabilities.includes(TabOptionItem.id))
    ) {
      throw new Error(`Invalid capability: ${solutionSettings.capabilities}`);
    }
    if (
      HostTypeOptionAzure.id === solutionSettings.hostType ||
      solutionSettings.capabilities.includes(BotOptionItem.id) ||
      solutionSettings.capabilities.includes(MessageExtensionItem.id)
    ) {
      let manifestString = isMultiEnvEnabled()
        ? TEAMS_APP_MANIFEST_TEMPLATE_FOR_MULTI_ENV
        : TEAMS_APP_MANIFEST_TEMPLATE;
      manifestString = this.replaceConfigValue(manifestString, "appName", settings.appName);
      manifestString = this.replaceConfigValue(manifestString, "version", "1.0.0");
      const manifest: TeamsAppManifest = JSON.parse(manifestString);
      if (solutionSettings.capabilities.includes(TabOptionItem.id)) {
        manifest.staticTabs = isMultiEnvEnabled() ? STATIC_TABS_TPL_FOR_MULTI_ENV : STATIC_TABS_TPL;
        manifest.configurableTabs = isMultiEnvEnabled()
          ? CONFIGURABLE_TABS_TPL_FOR_MULTI_ENV
          : CONFIGURABLE_TABS_TPL;
      }
      if (solutionSettings.capabilities.includes(BotOptionItem.id)) {
        manifest.bots = isMultiEnvEnabled() ? BOTS_TPL_FOR_MULTI_ENV : BOTS_TPL;
      }
      if (solutionSettings.capabilities.includes(MessageExtensionItem.id)) {
        manifest.composeExtensions = isMultiEnvEnabled()
          ? COMPOSE_EXTENSIONS_TPL_FOR_MULTI_ENV
          : COMPOSE_EXTENSIONS_TPL;
      }

      if (settings?.solutionSettings?.migrateFromV1) {
        manifest.webApplicationInfo = undefined;
      }

      return manifest;
    }

    return undefined;
  }

  /**
   * generate app manifest template according to existing manifest
   * @param settings
   * @returns
   */
  public async createV1Manifest(ctx: PluginContext): Promise<TeamsAppManifest> {
    const archiveManifestPath = path.join(
      ctx.root,
      ArchiveFolderName,
      AppPackageFolderName,
      V1ManifestFileName
    );
    const manifestSourceRes = await this.reloadManifestAndCheckRequiredFields(archiveManifestPath);
    if (manifestSourceRes.isErr()) {
      throw manifestSourceRes.error;
    }
    const manifestSource = manifestSourceRes.value;

    let manifestString = (await fs.readFile(archiveManifestPath)).toString();
    manifestString = this.replaceExistingValueToPlaceholder(
      manifestString,
      manifestSource.developer.websiteUrl,
      "baseUrl"
    );
    const manifest: TeamsAppManifest = JSON.parse(manifestString);
    manifest.id = "{appid}";
    manifest.validDomains = [];

    const includeBot = (
      ctx.projectSettings?.solutionSettings as AzureSolutionSettings
    ).activeResourcePlugins?.includes(PluginNames.BOT);
    if (includeBot) {
      if (manifest.bots !== undefined && manifest.bots.length > 0) {
        for (let index = 0; index < manifest.bots.length; ++index) {
          manifest.bots[index].botId = `{${BOT_ID}}`;
        }
      }
      if (manifest.composeExtensions !== undefined && manifest.composeExtensions.length > 0) {
        for (let index = 0; index < manifest.composeExtensions.length; ++index) {
          manifest.composeExtensions[index].botId = `{${BOT_ID}}`;
        }
      }
    }
    return manifest;
  }

  public async reloadManifestAndCheckRequiredFields(
    manifestPath: string
  ): Promise<Result<TeamsAppManifest, FxError>> {
    const result = await this.reloadManifest(manifestPath);
    return result.andThen((manifest) => {
      if (
        manifest === undefined ||
        manifest.name.short === undefined ||
        manifest.name.short.length === 0
      ) {
        return err(
          AppStudioResultFactory.SystemError(
            AppStudioError.ManifestLoadFailedError.name,
            AppStudioError.ManifestLoadFailedError.message("Name is missing")
          )
        );
      }
      return ok(manifest);
    });
  }

  public async provision(ctx: PluginContext): Promise<Result<string, FxError>> {
    let remoteTeamsAppId = this.getTeamsAppId(ctx, false);

    let create = false;
    if (!remoteTeamsAppId) {
      create = true;
    } else {
      const appStudioToken = await ctx?.appStudioToken?.getAccessToken();
      try {
        await AppStudioClient.getApp(remoteTeamsAppId, appStudioToken!, ctx.logProvider);
      } catch (error) {
        create = true;
      }
    }

    if (create) {
      const result = await this.createApp(ctx, false);
      if (result.isErr()) {
        return err(result.error);
      }
      remoteTeamsAppId = result.value.teamsAppId!;
      ctx.logProvider?.info(`Teams app created ${remoteTeamsAppId}`);
    }
    if (isMultiEnvEnabled() || isV2()) {
      ctx.envInfo.profile.get(PluginNames.APPST)?.set(Constants.TEAMS_APP_ID, remoteTeamsAppId);
    }
    return ok(remoteTeamsAppId);
  }

  public async postProvision(ctx: PluginContext): Promise<string> {
    const remoteTeamsAppId = this.getTeamsAppId(ctx, false);
    let manifestString: string;
    const appDirectory = await getAppDirectory(ctx.root);
    const manifestPath = await this.getManifestTemplatePath(ctx.root);
    const manifestResult = await this.reloadManifestAndCheckRequiredFields(manifestPath);
    if (manifestResult.isErr()) {
      throw manifestResult;
    } else {
      manifestString = JSON.stringify(manifestResult.value);
    }

    let appDefinition: IAppDefinition;
    if (isSPFxProject(ctx.projectSettings)) {
      if (isMultiEnvEnabled()) {
        const view = {
          config: ctx.envInfo.config,
          profile: {
            "fx-resource-appstudio": {
              teamsAppId: remoteTeamsAppId,
            },
          },
        };
        manifestString = Mustache.render(manifestString, view);
      }
      appDefinition = this.convertToAppDefinition(JSON.parse(manifestString), false);
    } else {
      const remoteManifest = await this.getAppDefinitionAndManifest(ctx, false);
      if (remoteManifest.isErr()) {
        throw err(remoteManifest.error);
      }
      [appDefinition] = remoteManifest.value;
    }

    const appStudioToken = await ctx?.appStudioToken?.getAccessToken();
    const result = await this.updateApp(
      ctx,
      appDefinition,
      appStudioToken!,
      "remote",
      false,
      appDirectory,
      remoteTeamsAppId,
      ctx.logProvider
    );
    if (result.isErr()) {
      throw result.error;
    }

    ctx.logProvider?.info(`Teams app updated: ${result.value}`);
    return remoteTeamsAppId;
  }

  public async validateManifest(ctx: PluginContext): Promise<Result<string[], FxError>> {
    const appStudioToken = await ctx?.appStudioToken?.getAccessToken();
    let manifestString: string | undefined = undefined;
    const appDirectory = await getAppDirectory(ctx.root);
    if (isSPFxProject(ctx.projectSettings)) {
      manifestString = (await fs.readFile(await this.getManifestTemplatePath(ctx.root))).toString();
      if (isMultiEnvEnabled()) {
        const teamsAppId = this.getTeamsAppId(ctx, false);
        if (!teamsAppId) {
          return err(
            AppStudioResultFactory.UserError(
              AppStudioError.GetRemoteConfigError.name,
              AppStudioError.GetRemoteConfigError.message("Manifest validation failed")
            )
          );
        }
        const view = {
          config: ctx.envInfo.config,
          profile: {
            "fx-resource-appstudio": {
              teamsAppId: teamsAppId,
            },
          },
        };
        manifestString = Mustache.render(manifestString, view);
      }
    } else {
      const appDefinitionAndManifest = await this.getAppDefinitionAndManifest(ctx, false);
      if (appDefinitionAndManifest.isErr()) {
        ctx.logProvider?.error("[Teams Toolkit] Manifest Validation failed!");
        const isProvisionSucceeded = !!(ctx.envInfo.profile
          .get("solution")
          ?.get(SOLUTION_PROVISION_SUCCEEDED) as boolean);
        if (
          appDefinitionAndManifest.error.name === AppStudioError.GetRemoteConfigError.name &&
          !isProvisionSucceeded
        ) {
          return err(
            AppStudioResultFactory.UserError(
              AppStudioError.GetRemoteConfigError.name,
              AppStudioError.GetRemoteConfigError.message("Manifest validation failed")
            )
          );
        } else {
          return err(appDefinitionAndManifest.error);
        }
      } else {
        manifestString = JSON.stringify(appDefinitionAndManifest.value[1]);
      }
    }
    return ok(await AppStudioClient.validateManifest(manifestString, appStudioToken!));
  }

  public async migrateV1Project(ctx: PluginContext): Promise<{ enableAuth: boolean }> {
    let manifest: TeamsAppManifest | undefined;
    const archiveAppPackageFolder = path.join(ctx.root, ArchiveFolderName, AppPackageFolderName);
    const archiveManifestPath = path.join(archiveAppPackageFolder, V1ManifestFileName);
    const newAppPackageFolder = path.join(ctx.root, AppPackageFolderName);
    await fs.ensureDir(newAppPackageFolder);
    if (await this.checkFileExist(archiveManifestPath)) {
      manifest = await this.createV1Manifest(ctx);
      const newManifestPath = path.join(newAppPackageFolder, REMOTE_MANIFEST);
      await fs.writeFile(newManifestPath, JSON.stringify(manifest, null, 4));

      const archiveColorFile = path.join(archiveAppPackageFolder, manifest.icons.color);
      const newColorFile = path.join(newAppPackageFolder, manifest.icons.color);
      if (await this.checkFileExist(archiveColorFile)) {
        await fs.copyFile(archiveColorFile, newColorFile);
      }

      const archiveOutlineFile = path.join(archiveAppPackageFolder, manifest.icons.outline);
      const newOutlineFile = path.join(newAppPackageFolder, manifest.icons.outline);
      if (await this.checkFileExist(archiveOutlineFile)) {
        await fs.copyFile(archiveOutlineFile, newOutlineFile);
      }
      return { enableAuth: !!manifest?.webApplicationInfo?.id };
    } else {
      await this.scaffold(ctx);
      return { enableAuth: false };
    }
  }

  public async scaffold(ctx: PluginContext): Promise<any> {
    let manifest: TeamsAppManifest | undefined;
    const templatesFolder = getTemplatesFolder();

    if (isSPFxProject(ctx.projectSettings)) {
      const templateManifestFolder = path.join(templatesFolder, "plugins", "resource", "spfx");
      const manifestFile = isMultiEnvEnabled()
        ? path.resolve(templateManifestFolder, "./solution/manifest_multi_env.json")
        : path.resolve(templateManifestFolder, "./solution/manifest.json");
      const manifestString = (await fs.readFile(manifestFile)).toString();
      manifest = JSON.parse(manifestString);
    } else {
      manifest = await this.createManifest(ctx.projectSettings!);
    }

    // cannot use getAppDirectory before creating the manifest file
    const appDir = isMultiEnvEnabled()
      ? `${ctx.root}/templates/${AppPackageFolderName}`
      : `${ctx.root}/${AppPackageFolderName}`;

    await fs.ensureDir(appDir);
    const manifestTemplatePath = isMultiEnvEnabled()
      ? `${appDir}/${MANIFEST_TEMPLATE}`
      : `${appDir}/${REMOTE_MANIFEST}`;
    await fs.writeFile(manifestTemplatePath, JSON.stringify(manifest, null, 4));

    const defaultColorPath = path.join(
      templatesFolder,
      "plugins",
      "resource",
      "appstudio",
      "defaultIcon.png"
    );
    const defaultOutlinePath = path.join(
      templatesFolder,
      "plugins",
      "resource",
      "appstudio",
      "defaultOutline.png"
    );
    const resourcesDir = isMultiEnvEnabled() ? path.join(appDir, "resources") : appDir;
    await fs.ensureDir(resourcesDir);
    await fs.copy(defaultColorPath, `${resourcesDir}/color.png`);
    await fs.copy(defaultOutlinePath, `${resourcesDir}/outline.png`);

    return undefined;
  }

  public async buildTeamsAppPackage(ctx: PluginContext): Promise<string> {
    let manifestString: string | undefined = undefined;

    if (!ctx.envInfo?.envName) {
      throw new Error("Failed to get target environment name from plugin context.");
    }

    const appDirectory = await getAppDirectory(ctx.root);
    const zipFileName: string = isMultiEnvEnabled()
      ? `${ctx.root}/${AppPackageFolderName}/appPackage.${ctx.envInfo.envName}.zip`
      : `${ctx.root}/${AppPackageFolderName}/appPackage.zip`;

    if (isSPFxProject(ctx.projectSettings)) {
      manifestString = (await fs.readFile(await this.getManifestTemplatePath(ctx.root))).toString();
      if (isMultiEnvEnabled()) {
        const view = {
          config: ctx.envInfo.config,
          profile: {
            "fx-resource-appstudio": {
              teamsAppId: this.getTeamsAppId(ctx, false),
            },
          },
        };
        manifestString = Mustache.render(manifestString, view);
      }
    } else {
      const manifest = await this.getAppDefinitionAndManifest(ctx, false);
      if (manifest.isOk()) {
        manifestString = JSON.stringify(manifest.value[1]);
      } else {
        ctx.logProvider?.error("[Teams Toolkit] Teams Package build failed!");
        const isProvisionSucceeded = !!(ctx.envInfo.profile
          .get("solution")
          ?.get(SOLUTION_PROVISION_SUCCEEDED) as boolean);
        if (
          manifest.error.name === AppStudioError.GetRemoteConfigFailedError.name &&
          !isProvisionSucceeded
        ) {
          throw AppStudioResultFactory.UserError(
            AppStudioError.GetRemoteConfigError.name,
            AppStudioError.GetRemoteConfigError.message("Teams package build failed")
          );
        } else {
          throw manifest.error;
        }
      }
    }
    const status = await fs.lstat(appDirectory);

    if (!status.isDirectory()) {
      throw AppStudioResultFactory.UserError(
        AppStudioError.NotADirectoryError.name,
        AppStudioError.NotADirectoryError.message(appDirectory)
      );
    }
    const manifest: TeamsAppManifest = JSON.parse(manifestString);
    const colorFile = `${appDirectory}/${manifest.icons.color}`;

    let fileExists = await this.checkFileExist(colorFile);
    if (!fileExists) {
      throw AppStudioResultFactory.UserError(
        AppStudioError.FileNotFoundError.name,
        AppStudioError.FileNotFoundError.message(colorFile)
      );
    }

    const outlineFile = `${appDirectory}/${manifest.icons.outline}`;
    fileExists = await this.checkFileExist(outlineFile);
    if (!fileExists) {
      throw AppStudioResultFactory.UserError(
        AppStudioError.FileNotFoundError.name,
        AppStudioError.FileNotFoundError.message(outlineFile)
      );
    }

    if (isMultiEnvEnabled()) {
      await fs.ensureDir(path.dirname(zipFileName));
    }

    const zip = new AdmZip();
    zip.addFile(Constants.MANIFEST_FILE, Buffer.from(manifestString));
    zip.addLocalFile(colorFile, isMultiEnvEnabled() ? "resources" : "");
    zip.addLocalFile(outlineFile, isMultiEnvEnabled() ? "resources" : "");
    zip.writeZip(zipFileName);

    if (isSPFxProject(ctx.projectSettings)) {
      await fs.copyFile(zipFileName, `${ctx.root}/SPFx/teams/TeamsSPFxApp.zip`);
    }

    if (appDirectory === `${ctx.root}/.${ConfigFolderName}`) {
      await fs.ensureDir(path.join(ctx.root, `${AppPackageFolderName}`));

      const formerZipFileName = `${appDirectory}/appPackage.zip`;
      if (await this.checkFileExist(formerZipFileName)) {
        await fs.remove(formerZipFileName);
      }

      await fs.move(
        `${appDirectory}/${manifest.icons.color}`,
        isMultiEnvEnabled()
          ? `${ctx.root}/templates/${AppPackageFolderName}/resources/${manifest.icons.color}`
          : `${ctx.root}/${AppPackageFolderName}/${manifest.icons.color}`
      );
      await fs.move(
        `${appDirectory}/${manifest.icons.outline}`,
        isMultiEnvEnabled()
          ? `${ctx.root}/templates/${AppPackageFolderName}/resources/${manifest.icons.outline}`
          : `${ctx.root}/${AppPackageFolderName}/${manifest.icons.outline}`
      );
      await fs.move(
        `${appDirectory}/${REMOTE_MANIFEST}`,
        isMultiEnvEnabled()
          ? `${ctx.root}/templates/${AppPackageFolderName}/${MANIFEST_TEMPLATE}`
          : `${ctx.root}/${AppPackageFolderName}/${REMOTE_MANIFEST}`
      );
    }

    return zipFileName;
  }

  public async publish(ctx: PluginContext): Promise<{ name: string; id: string; update: boolean }> {
    let manifest: TeamsAppManifest | undefined;

    const appDirectory = await getAppDirectory(ctx.root);
    let manifestString = JSON.stringify(
      await fs.readJSON(await this.getManifestTemplatePath(ctx.root))
    );
    if (isSPFxProject(ctx.projectSettings)) {
      if (isMultiEnvEnabled()) {
        const view = {
          config: ctx.envInfo.config,
          profile: {
            "fx-resource-appstudio": {
              teamsAppId: this.getTeamsAppId(ctx, false),
            },
          },
        };
        manifestString = Mustache.render(manifestString, view);
      }
      manifest = JSON.parse(manifestString);
    } else {
      const fillinRes = await this.getAppDefinitionAndManifest(ctx, false);
      if (fillinRes.isOk()) {
        manifest = fillinRes.value[1];
      } else {
        throw fillinRes.error;
      }
    }

    if (!manifest) {
      throw AppStudioResultFactory.SystemError(
        AppStudioError.ManifestLoadFailedError.name,
        AppStudioError.ManifestLoadFailedError.message("")
      );
    }

    // manifest.id === externalID
    const appStudioToken = await ctx?.appStudioToken?.getAccessToken();
    const existApp = await AppStudioClient.getAppByTeamsAppId(manifest.id, appStudioToken!);
    if (existApp) {
      let executePublishUpdate = false;
      let description = `The app ${existApp.displayName} has already been submitted to tenant App Catalog.\nStatus: ${existApp.publishingState}\n`;
      if (existApp.lastModifiedDateTime) {
        description =
          description + `Last Modified: ${existApp.lastModifiedDateTime?.toLocaleString()}\n`;
      }
      description = description + "Do you want to submit a new update?";
      const res = await ctx.ui?.showMessage("warn", description, true, "Confirm");
      if (res?.isOk() && res.value === "Confirm") executePublishUpdate = true;

      if (executePublishUpdate) {
        const appId = await this.beforePublish(ctx, appDirectory, JSON.stringify(manifest), true);
        return { id: appId, name: manifest.name.short, update: true };
      } else {
        throw AppStudioResultFactory.SystemError(
          AppStudioError.TeamsAppPublishCancelError.name,
          AppStudioError.TeamsAppPublishCancelError.message(manifest.name.short)
        );
      }
    } else {
      const appId = await this.beforePublish(ctx, appDirectory, JSON.stringify(manifest), false);
      return { id: appId, name: manifest.name.short, update: false };
    }
  }

  public async postLocalDebug(ctx: PluginContext): Promise<Result<string, FxError>> {
    const manifestPath = await this.getManifestTemplatePath(ctx.root);
    const manifest = await this.reloadManifestAndCheckRequiredFields(manifestPath);
    if (manifest.isErr()) {
      return err(manifest.error);
    }
    let teamsAppId;
    if (isSPFxProject(ctx.projectSettings)) {
      teamsAppId = await this.getSPFxLocalDebugAppDefinitionAndUpdate(ctx, manifest.value);
    } else {
      teamsAppId = await this.getAppDefinitionAndUpdate(ctx, "localDebug", manifest.value);
    }
    if (teamsAppId.isErr()) {
      return teamsAppId;
    }
    return ok(teamsAppId.value);
  }

  public async checkPermission(
    ctx: PluginContext,
    userInfo: IUserList
  ): Promise<ResourcePermission[]> {
    const appStudioToken = await ctx?.appStudioToken?.getAccessToken();

    const teamsAppId = this.getTeamsAppId(ctx, false);
    if (!teamsAppId) {
      if (isMultiEnvEnabled()) {
        throw new Error(ErrorMessages.GetConfigError(Constants.TEAMS_APP_ID, PluginNames.APPST));
      } else {
        throw new Error(ErrorMessages.GetConfigError(REMOTE_TEAMS_APP_ID, SOLUTION));
      }
    }

    const teamsAppRoles = await AppStudioClient.checkPermission(
      teamsAppId,
      appStudioToken as string,
      userInfo.aadId
    );

    const result: ResourcePermission[] = [
      {
        name: Constants.PERMISSIONS.name,
        roles: [teamsAppRoles as string],
        type: Constants.PERMISSIONS.type,
        resourceId: teamsAppId,
      },
    ];

    return result;
  }

  public async listCollaborator(ctx: PluginContext): Promise<TeamsAppAdmin[]> {
    const appStudioToken = await ctx?.appStudioToken?.getAccessToken();
    const teamsAppId = this.getTeamsAppId(ctx, false);
    if (!teamsAppId) {
      if (isMultiEnvEnabled()) {
        throw new Error(ErrorMessages.GetConfigError(Constants.TEAMS_APP_ID, PluginNames.APPST));
      } else {
        throw new Error(ErrorMessages.GetConfigError(REMOTE_TEAMS_APP_ID, SOLUTION));
      }
    }

    const userLists = await AppStudioClient.getUserList(teamsAppId, appStudioToken as string);
    if (!userLists) {
      return [];
    }

    const teamsAppAdmin: TeamsAppAdmin[] = userLists
      .filter((userList, index) => {
        return userList.isAdministrator;
      })
      .map((userList, index) => {
        return {
          userObjectId: userList.aadId,
          displayName: userList.displayName,
          userPrincipalName: userList.userPrincipalName,
          resourceId: teamsAppId,
        };
      });

    return teamsAppAdmin;
  }

  public async grantPermission(
    ctx: PluginContext,
    userInfo: IUserList
  ): Promise<ResourcePermission[]> {
    const appStudioToken = await ctx?.appStudioToken?.getAccessToken();

    const teamsAppId = this.getTeamsAppId(ctx, false);
    if (!teamsAppId) {
      if (isMultiEnvEnabled()) {
        throw new Error(
          AppStudioError.GrantPermissionFailedError.message(
            ErrorMessages.GetConfigError(Constants.TEAMS_APP_ID, PluginNames.APPST)
          )
        );
      } else {
        throw new Error(
          AppStudioError.GrantPermissionFailedError.message(
            ErrorMessages.GetConfigError(REMOTE_TEAMS_APP_ID, SOLUTION)
          )
        );
      }
    }

    try {
      await AppStudioClient.grantPermission(teamsAppId, appStudioToken as string, userInfo);
    } catch (error) {
      throw new Error(
        AppStudioError.GrantPermissionFailedError.message(error?.message, teamsAppId)
      );
    }

    const result: ResourcePermission[] = [
      {
        name: Constants.PERMISSIONS.name,
        roles: [Constants.PERMISSIONS.admin],
        type: Constants.PERMISSIONS.type,
        resourceId: teamsAppId,
      },
    ];

    return result;
  }

  private async beforePublish(
    ctx: PluginContext,
    appDirectory: string,
    manifestString: string,
    update: boolean
  ): Promise<string> {
    const manifest: TeamsAppManifest = JSON.parse(manifestString);
    const publishProgress = ctx.ui?.createProgressBar(`Publishing ${manifest.name.short}`, 3);
    try {
      // Validate manifest
      await publishProgress?.start("Validating manifest file");
      const validationResult = await AppStudioClient.validateManifest(
        manifestString!,
        (await ctx.appStudioToken?.getAccessToken())!
      );
      if (validationResult.length > 0) {
        throw AppStudioResultFactory.UserError(
          AppStudioError.ValidationFailedError.name,
          AppStudioError.ValidationFailedError.message(validationResult)
        );
      }

      // Update App in App Studio
      const remoteTeamsAppId = this.getTeamsAppId(ctx, false);
      await publishProgress?.next(
        `Updating app definition for app ${remoteTeamsAppId} in app studio`
      );
      const appDefinition = this.convertToAppDefinition(manifest, true);
      let appStudioToken = await ctx?.appStudioToken?.getAccessToken();
      const colorIconContent =
        manifest.icons.color && !manifest.icons.color.startsWith("https://")
          ? (await fs.readFile(`${appDirectory}/${manifest.icons.color}`)).toString("base64")
          : undefined;
      const outlineIconContent =
        manifest.icons.outline && !manifest.icons.outline.startsWith("https://")
          ? (await fs.readFile(`${appDirectory}/${manifest.icons.outline}`)).toString("base64")
          : undefined;
      try {
        await AppStudioClient.updateApp(
          remoteTeamsAppId,
          appDefinition,
          appStudioToken!,
          undefined,
          colorIconContent,
          outlineIconContent
        );
      } catch (e) {
        if (e.name === 404) {
          throw AppStudioResultFactory.UserError(
            AppStudioError.TeamsAppNotFoundError.name,
            AppStudioError.TeamsAppNotFoundError.message(remoteTeamsAppId)
          );
        }
      }

      // Build Teams App package
      // Platforms will be checked in buildTeamsAppPackage(ctx)
      await publishProgress?.next(`Building Teams app package in ${appDirectory}.`);
      const appPackage = await this.buildTeamsAppPackage(ctx);

      const appContent = await fs.readFile(appPackage);
      appStudioToken = await ctx.appStudioToken?.getAccessToken();
      await publishProgress?.next(`Publishing ${manifest.name.short}`);
      if (update) {
        // Update existing app in App Catalog
        return await AppStudioClient.publishTeamsAppUpdate(
          manifest.id,
          appContent,
          appStudioToken!
        );
      } else {
        // Publish Teams App
        return await AppStudioClient.publishTeamsApp(manifest.id, appContent, appStudioToken!);
      }
    } finally {
      await publishProgress?.end(true);
    }
  }

  private async checkFileExist(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  private replaceConfigValue(config: string, id: string, value: string): string {
    if (config && id && value) {
      const idTag = `{${id}}`;
      while (config.includes(idTag)) {
        config = config.replace(idTag, value);
      }
    }

    return config;
  }

  private replaceExistingValueToPlaceholder(
    config: string,
    value: string,
    placeholderName: string
  ): string {
    if (config && value && placeholderName) {
      config = config.split(value).join(`{${placeholderName}}`);
    }

    return config;
  }

  private convertToAppDefinitionMessagingExtensions(
    appManifest: TeamsAppManifest
  ): IMessagingExtension[] {
    const messagingExtensions: IMessagingExtension[] = [];

    if (appManifest.composeExtensions) {
      appManifest.composeExtensions.forEach((ext: IComposeExtension) => {
        const me: IMessagingExtension = {
          botId: ext.botId,
          canUpdateConfiguration: true,
          commands: ext.commands,
          messageHandlers: ext.messageHandlers ?? [],
        };

        messagingExtensions.push(me);
      });
    }

    return messagingExtensions;
  }

  private convertToAppDefinitionBots(appManifest: TeamsAppManifest): IAppDefinitionBot[] {
    const bots: IAppDefinitionBot[] = [];
    if (appManifest.bots) {
      appManifest.bots.forEach((manBot: IBot) => {
        const teamCommands: ITeamCommand[] = [];
        const groupCommands: IGroupChatCommand[] = [];
        const personalCommands: IPersonalCommand[] = [];

        manBot?.commandLists?.forEach((list: ICommandList) => {
          list.commands.forEach((command: ICommand) => {
            teamCommands.push({
              title: command.title,
              description: command.description,
            });

            groupCommands.push({
              title: command.title,
              description: command.description,
            });

            personalCommands.push({
              title: command.title,
              description: command.description,
            });
          });
        });

        const bot: IAppDefinitionBot = {
          botId: manBot.botId,
          isNotificationOnly: manBot.isNotificationOnly ?? false,
          supportsFiles: manBot.supportsFiles ?? false,
          scopes: manBot.scopes,
          teamCommands: teamCommands,
          groupChatCommands: groupCommands,
          personalCommands: personalCommands,
        };

        bots.push(bot);
      });
    }
    return bots;
  }

  private async reloadManifest(manifestPath: string): Promise<Result<TeamsAppManifest, FxError>> {
    try {
      const manifest = await fs.readJson(manifestPath);
      if (!manifest) {
        return err(
          AppStudioResultFactory.SystemError(
            AppStudioError.ManifestLoadFailedError.name,
            AppStudioError.ManifestLoadFailedError.message(`Failed to load manifest file`)
          )
        );
      }
      // Object.assign(ctx.app, manifest);
      return ok(manifest);
    } catch (e) {
      return err(
        AppStudioResultFactory.SystemError(
          AppStudioError.ManifestLoadFailedError.name,
          AppStudioError.ManifestLoadFailedError.message(
            `Failed to load manifest file from ${manifestPath}`
          )
        )
      );
    }
  }

  private getConfigForCreatingManifest(
    ctx: PluginContext,
    localDebug: boolean
  ): Result<
    {
      tabEndpoint?: string;
      tabDomain?: string;
      aadId: string;
      botDomain?: string;
      botId?: string;
      webApplicationInfoResource?: string;
      teamsAppId: string;
    },
    FxError
  > {
    let tabEndpoint, tabDomain;
    if (isArmSupportEnabled()) {
      // getConfigForCreatingManifest is called in post-provision and validate manifest
      // only in post stage, we find the value from arm output.
      // Here is a walk-around way, try to get from arm output first and then get from ctx config.
      // todo: use the specific function to read config in post stage.
      tabEndpoint = getArmOutput(ctx, FRONTEND_ENDPOINT_ARM) as string;
      tabDomain = getArmOutput(ctx, FRONTEND_DOMAIN_ARM) as string;
      if (!tabEndpoint) {
        tabEndpoint = this.getTabEndpoint(ctx, localDebug);
        tabDomain = this.getTabDomain(ctx, localDebug);
      }
    } else {
      tabEndpoint = this.getTabEndpoint(ctx, localDebug);
      tabDomain = this.getTabDomain(ctx, localDebug);
    }
    const aadId = this.getAadClientId(ctx, localDebug);
    const botId = this.getBotId(ctx, localDebug);
    const botDomain = this.getBotDomain(ctx, localDebug);
    const teamsAppId = this.getTeamsAppId(ctx, localDebug);

    // This config value is set by aadPlugin.setApplicationInContext. so aadPlugin.setApplicationInContext needs to run first.

    const webApplicationInfoResource = this.getApplicationIdUris(ctx, localDebug);
    if (!ctx?.projectSettings?.solutionSettings?.migrateFromV1 && !webApplicationInfoResource) {
      return err(
        localDebug
          ? AppStudioResultFactory.SystemError(
              AppStudioError.GetLocalDebugConfigFailedError.name,
              AppStudioError.GetLocalDebugConfigFailedError.message(
                "webApplicationInfoResource",
                true
              )
            )
          : AppStudioResultFactory.UserError(
              AppStudioError.GetRemoteConfigFailedError.name,
              AppStudioError.GetRemoteConfigFailedError.message("webApplicationInfoResource", true)
            )
      );
    }

    if (!ctx?.projectSettings?.solutionSettings?.migrateFromV1 && !aadId) {
      return err(
        localDebug
          ? AppStudioResultFactory.SystemError(
              AppStudioError.GetLocalDebugConfigFailedError.name,
              AppStudioError.GetLocalDebugConfigFailedError.message(LOCAL_DEBUG_AAD_ID, true)
            )
          : AppStudioResultFactory.UserError(
              AppStudioError.GetRemoteConfigFailedError.name,
              AppStudioError.GetRemoteConfigFailedError.message(REMOTE_AAD_ID, true)
            )
      );
    }

    if (!tabEndpoint && !botId) {
      if (isArmSupportEnabled()) {
        return err(
          localDebug
            ? AppStudioResultFactory.SystemError(
                AppStudioError.GetLocalDebugConfigFailedError.name,
                AppStudioError.GetLocalDebugConfigFailedError.message(
                  LOCAL_DEBUG_TAB_ENDPOINT + ", " + LOCAL_BOT_ID,
                  false
                )
              )
            : AppStudioResultFactory.UserError(
                AppStudioError.GetRemoteConfigFailedError.name,
                AppStudioError.GetRemoteConfigFailedError.message(
                  FRONTEND_ENDPOINT_ARM + ", " + BOT_ID,
                  false
                )
              )
        );
      } else {
        return err(
          localDebug
            ? AppStudioResultFactory.SystemError(
                AppStudioError.GetLocalDebugConfigFailedError.name,
                AppStudioError.GetLocalDebugConfigFailedError.message(
                  LOCAL_DEBUG_TAB_ENDPOINT + ", " + LOCAL_BOT_ID,
                  false
                )
              )
            : AppStudioResultFactory.UserError(
                AppStudioError.GetRemoteConfigFailedError.name,
                AppStudioError.GetRemoteConfigFailedError.message(
                  FRONTEND_ENDPOINT + ", " + BOT_ID,
                  false
                )
              )
        );
      }
    }
    if ((tabEndpoint && !tabDomain) || (!tabEndpoint && tabDomain)) {
      if (isArmSupportEnabled()) {
        return err(
          localDebug
            ? AppStudioResultFactory.SystemError(
                AppStudioError.InvalidLocalDebugConfigurationDataError.name,
                AppStudioError.InvalidLocalDebugConfigurationDataError.message(
                  LOCAL_DEBUG_TAB_ENDPOINT,
                  tabEndpoint,
                  LOCAL_DEBUG_TAB_DOMAIN,
                  tabDomain
                )
              )
            : AppStudioResultFactory.SystemError(
                AppStudioError.InvalidRemoteConfigurationDataError.name,
                AppStudioError.InvalidRemoteConfigurationDataError.message(
                  FRONTEND_ENDPOINT_ARM,
                  tabEndpoint,
                  FRONTEND_DOMAIN_ARM,
                  tabDomain
                )
              )
        );
      } else {
        return err(
          localDebug
            ? AppStudioResultFactory.SystemError(
                AppStudioError.InvalidLocalDebugConfigurationDataError.name,
                AppStudioError.InvalidLocalDebugConfigurationDataError.message(
                  LOCAL_DEBUG_TAB_ENDPOINT,
                  tabEndpoint,
                  LOCAL_DEBUG_TAB_DOMAIN,
                  tabDomain
                )
              )
            : AppStudioResultFactory.SystemError(
                AppStudioError.InvalidRemoteConfigurationDataError.name,
                AppStudioError.InvalidRemoteConfigurationDataError.message(
                  FRONTEND_ENDPOINT,
                  tabEndpoint,
                  FRONTEND_DOMAIN,
                  tabDomain
                )
              )
        );
      }
    }
    if (botId) {
      if (!botDomain) {
        return err(
          localDebug
            ? AppStudioResultFactory.SystemError(
                AppStudioError.GetLocalDebugConfigFailedError.name,
                AppStudioError.GetLocalDebugConfigFailedError.message(LOCAL_DEBUG_BOT_DOMAIN, false)
              )
            : AppStudioResultFactory.UserError(
                AppStudioError.GetRemoteConfigFailedError.name,
                AppStudioError.GetRemoteConfigFailedError.message(BOT_DOMAIN, false)
              )
        );
      }
    }

    return ok({
      tabEndpoint,
      tabDomain,
      aadId,
      botDomain,
      botId,
      webApplicationInfoResource,
      teamsAppId,
    });
  }

  private getTabEndpoint(ctx: PluginContext, isLocalDebug: boolean): string {
    let tabEndpoint: string;

    if (isMultiEnvEnabled()) {
      tabEndpoint = isLocalDebug
        ? (ctx.localSettings?.frontend?.get(LocalSettingsFrontendKeys.TabEndpoint) as string)
        : (ctx.envInfo.profile.get(PluginNames.FE)?.get(FRONTEND_ENDPOINT) as string);
    } else {
      tabEndpoint = isLocalDebug
        ? (ctx.envInfo.profile.get(PluginNames.LDEBUG)?.get(LOCAL_DEBUG_TAB_ENDPOINT) as string)
        : (ctx.envInfo.profile.get(PluginNames.FE)?.get(FRONTEND_ENDPOINT) as string);
    }

    return tabEndpoint;
  }

  private getTabDomain(ctx: PluginContext, isLocalDebug: boolean): string {
    let tabDomain: string;

    if (isMultiEnvEnabled()) {
      tabDomain = isLocalDebug
        ? (ctx.localSettings?.frontend?.get(LocalSettingsFrontendKeys.TabDomain) as string)
        : (ctx.envInfo.profile.get(PluginNames.FE)?.get(FRONTEND_DOMAIN) as string);
    } else {
      tabDomain = isLocalDebug
        ? (ctx.envInfo.profile.get(PluginNames.LDEBUG)?.get(LOCAL_DEBUG_TAB_DOMAIN) as string)
        : (ctx.envInfo.profile.get(PluginNames.FE)?.get(FRONTEND_DOMAIN) as string);
    }
    return tabDomain;
  }

  private getAadClientId(ctx: PluginContext, isLocalDebug: boolean): string {
    let clientId: string;

    if (isMultiEnvEnabled()) {
      clientId = isLocalDebug
        ? (ctx.localSettings?.auth?.get(LocalSettingsAuthKeys.ClientId) as string)
        : (ctx.envInfo.profile.get(PluginNames.AAD)?.get(REMOTE_AAD_ID) as string);
    } else {
      clientId = ctx.envInfo.profile
        .get(PluginNames.AAD)
        ?.get(isLocalDebug ? LOCAL_DEBUG_AAD_ID : REMOTE_AAD_ID) as string;
    }

    return clientId;
  }

  private getBotId(ctx: PluginContext, isLocalDebug: boolean): string {
    let botId: string;

    if (isMultiEnvEnabled()) {
      botId = isLocalDebug
        ? (ctx.localSettings?.bot?.get(LocalSettingsBotKeys.BotId) as string)
        : (ctx.envInfo.profile.get(PluginNames.BOT)?.get(BOT_ID) as string);
    } else {
      botId = ctx.envInfo.profile
        .get(PluginNames.BOT)
        ?.get(isLocalDebug ? LOCAL_BOT_ID : BOT_ID) as string;
    }

    return botId;
  }

  private getBotDomain(ctx: PluginContext, isLocalDebug: boolean): string {
    let botDomain: string;

    if (isMultiEnvEnabled()) {
      botDomain = isLocalDebug
        ? (ctx.localSettings?.bot?.get(LocalSettingsBotKeys.BotDomain) as string)
        : (ctx.envInfo.profile.get(PluginNames.BOT)?.get(BOT_DOMAIN) as string);
    } else {
      botDomain = isLocalDebug
        ? (ctx.envInfo.profile.get(PluginNames.LDEBUG)?.get(LOCAL_DEBUG_BOT_DOMAIN) as string)
        : (ctx.envInfo.profile.get(PluginNames.BOT)?.get(BOT_DOMAIN) as string);
    }

    return botDomain;
  }

  private getApplicationIdUris(ctx: PluginContext, isLocalDebug: boolean): string {
    let applicationIdUris: string;

    if (isMultiEnvEnabled()) {
      applicationIdUris = isLocalDebug
        ? (ctx.localSettings?.auth?.get(LocalSettingsAuthKeys.ApplicationIdUris) as string)
        : (ctx.envInfo.profile.get(PluginNames.AAD)?.get(WEB_APPLICATION_INFO_SOURCE) as string);
    } else {
      applicationIdUris = ctx.envInfo.profile
        .get(PluginNames.AAD)
        ?.get(
          isLocalDebug ? LOCAL_WEB_APPLICATION_INFO_SOURCE : WEB_APPLICATION_INFO_SOURCE
        ) as string;
    }

    return applicationIdUris;
  }

  private getTeamsAppId(ctx: PluginContext, isLocalDebug: boolean): string {
    let teamsAppId: string;
    if (isLocalDebug) {
      teamsAppId = isMultiEnvEnabled()
        ? ctx.localSettings?.teamsApp.get(LocalSettingsTeamsAppKeys.TeamsAppId)
        : (ctx.envInfo.profile.get("solution")?.get(LOCAL_DEBUG_TEAMS_APP_ID) as string);
    } else {
      teamsAppId = isMultiEnvEnabled()
        ? (ctx.envInfo.profile.get(PluginNames.APPST)?.get(Constants.TEAMS_APP_ID) as string)
        : (ctx.envInfo.profile.get("solution")?.get(REMOTE_TEAMS_APP_ID) as string);
    }
    return teamsAppId;
  }

  /**
   *
   * Refer to AppDefinitionProfile.cs
   */
  private convertToAppDefinition(
    appManifest: TeamsAppManifest,
    ignoreIcon: boolean
  ): IAppDefinition {
    const appDefinition: IAppDefinition = {
      appName: appManifest.name.short,
      validDomains: appManifest.validDomains,
    };

    appDefinition.showLoadingIndicator = appManifest.showLoadingIndicator;
    appDefinition.isFullScreen = appManifest.isFullScreen;
    appDefinition.appId = appManifest.id;

    appDefinition.appName = appManifest.name.short;
    appDefinition.shortName = appManifest.name.short;
    appDefinition.longName = appManifest.name.full;
    appDefinition.manifestVersion = appManifest.manifestVersion;
    appDefinition.version = appManifest.version;

    appDefinition.packageName = appManifest.packageName;
    appDefinition.accentColor = appManifest.accentColor;

    appDefinition.developerName = appManifest.developer.name;
    appDefinition.mpnId = appManifest.developer.mpnId;
    appDefinition.websiteUrl = appManifest.developer.websiteUrl;
    appDefinition.privacyUrl = appManifest.developer.privacyUrl;
    appDefinition.termsOfUseUrl = appManifest.developer.termsOfUseUrl;

    appDefinition.shortDescription = appManifest.description.short;
    appDefinition.longDescription = appManifest.description.full;

    appDefinition.staticTabs = appManifest.staticTabs;
    appDefinition.configurableTabs = appManifest.configurableTabs;

    appDefinition.bots = this.convertToAppDefinitionBots(appManifest);
    appDefinition.messagingExtensions = this.convertToAppDefinitionMessagingExtensions(appManifest);

    appDefinition.connectors = appManifest.connectors;
    appDefinition.devicePermissions = appManifest.devicePermissions;
    appDefinition.localizationInfo = appManifest.localizationInfo;

    if (appManifest.webApplicationInfo) {
      appDefinition.webApplicationInfoId = appManifest.webApplicationInfo.id;
      appDefinition.webApplicationInfoResource = appManifest.webApplicationInfo.resource;
    }

    if (!ignoreIcon && appManifest.icons.color) {
      appDefinition.colorIcon = appManifest.icons.color;
    }

    if (!ignoreIcon && appManifest.icons.outline) {
      appDefinition.outlineIcon = appManifest.icons.outline;
    }

    return appDefinition;
  }

  private async createApp(
    ctx: PluginContext,
    isLocalDebug: boolean
  ): Promise<Result<IAppDefinition, FxError>> {
    const appDirectory = await getAppDirectory(ctx.root);
    const status = await fs.lstat(appDirectory);

    if (!status.isDirectory()) {
      throw AppStudioResultFactory.UserError(
        AppStudioError.NotADirectoryError.name,
        AppStudioError.NotADirectoryError.message(appDirectory)
      );
    }
    const manifest: TeamsAppManifest = await fs.readJSON(
      await this.getManifestTemplatePath(ctx.root)
    );
    manifest.bots = undefined;
    manifest.composeExtensions = undefined;
    if (isLocalDebug || !isUUID(manifest.id)) {
      manifest.id = v4();
    }

    const colorFile = `${appDirectory}/${manifest.icons.color}`;
    if (!(await fs.pathExists(colorFile))) {
      throw AppStudioResultFactory.UserError(
        AppStudioError.FileNotFoundError.name,
        AppStudioError.FileNotFoundError.message(colorFile)
      );
    }

    const outlineFile = `${appDirectory}/${manifest.icons.outline}`;
    if (!(await fs.pathExists(outlineFile))) {
      throw AppStudioResultFactory.UserError(
        AppStudioError.FileNotFoundError.name,
        AppStudioError.FileNotFoundError.message(outlineFile)
      );
    }

    const zip = new AdmZip();
    zip.addFile(Constants.MANIFEST_FILE, Buffer.from(JSON.stringify(manifest)));
    zip.addLocalFile(colorFile);
    zip.addLocalFile(outlineFile);

    const archivedFile = zip.toBuffer();
    const appStudioToken = await ctx?.appStudioToken?.getAccessToken();

    try {
      const appDefinition = await AppStudioClient.createApp(
        archivedFile,
        appStudioToken,
        ctx.logProvider
      );
      return ok(appDefinition);
    } catch (e) {
      return err(
        isLocalDebug
          ? AppStudioResultFactory.SystemError(
              AppStudioError.LocalAppIdCreateFailedError.name,
              AppStudioError.LocalAppIdCreateFailedError.message(e)
            )
          : AppStudioResultFactory.SystemError(
              AppStudioError.RemoteAppIdCreateFailedError.name,
              AppStudioError.RemoteAppIdCreateFailedError.message(e)
            )
      );
    }
  }

  private async updateApp(
    ctx: PluginContext,
    appDefinition: IAppDefinition,
    appStudioToken: string,
    type: "localDebug" | "remote",
    createIfNotExist: boolean,
    appDirectory: string,
    teamsAppId?: string,
    logProvider?: LogProvider
  ): Promise<Result<string, FxError>> {
    if (appStudioToken === undefined || appStudioToken.length === 0) {
      return err(
        AppStudioResultFactory.SystemError(
          AppStudioError.AppStudioTokenGetFailedError.name,
          AppStudioError.AppStudioTokenGetFailedError.message
        )
      );
    }

    if (createIfNotExist) {
      const appDef = await this.createApp(ctx, type === "localDebug");
      if (appDef.isErr()) {
        return err(appDef.error);
      }
      if (!appDef.value.teamsAppId) {
        return err(
          type === "remote"
            ? AppStudioResultFactory.SystemError(
                AppStudioError.RemoteAppIdCreateFailedError.name,
                AppStudioError.RemoteAppIdCreateFailedError.message()
              )
            : AppStudioResultFactory.SystemError(
                AppStudioError.LocalAppIdCreateFailedError.name,
                AppStudioError.LocalAppIdCreateFailedError.message()
              )
        );
      }
      teamsAppId = appDef.value.teamsAppId;
      appDefinition.outlineIcon = appDef.value.outlineIcon;
      appDefinition.colorIcon = appDef.value.colorIcon;
    }

    const colorIconContent =
      appDirectory && appDefinition.colorIcon && !appDefinition.colorIcon.startsWith("https://")
        ? (await fs.readFile(`${appDirectory}/${appDefinition.colorIcon}`)).toString("base64")
        : undefined;
    const outlineIconContent =
      appDirectory && appDefinition.outlineIcon && !appDefinition.outlineIcon.startsWith("https://")
        ? (await fs.readFile(`${appDirectory}/${appDefinition.outlineIcon}`)).toString("base64")
        : undefined;
    appDefinition.appId = teamsAppId;

    try {
      await AppStudioClient.updateApp(
        teamsAppId!,
        appDefinition,
        appStudioToken,
        logProvider,
        colorIconContent,
        outlineIconContent
      );
      return ok(teamsAppId!);
    } catch (e) {
      if (e instanceof Error) {
        return err(
          type === "remote"
            ? AppStudioResultFactory.SystemError(
                AppStudioError.RemoteAppIdUpdateFailedError.name,
                AppStudioError.RemoteAppIdUpdateFailedError.message(e)
              )
            : AppStudioResultFactory.SystemError(
                AppStudioError.LocalAppIdUpdateFailedError.name,
                AppStudioError.LocalAppIdUpdateFailedError.message(e)
              )
        );
      }
      throw e;
    }
  }

  private async getAppDefinitionAndManifest(
    ctx: PluginContext,
    isLocalDebug: boolean
  ): Promise<Result<[IAppDefinition, TeamsAppManifest], FxError>> {
    const configs = this.getConfigForCreatingManifest(ctx, isLocalDebug);
    if (configs.isErr()) {
      return err(configs.error);
    }

    const {
      tabEndpoint,
      tabDomain,
      aadId,
      botDomain,
      botId,
      webApplicationInfoResource,
      teamsAppId,
    } = configs.value;

    const validDomains: string[] = [];
    if (tabDomain) {
      validDomains.push(tabDomain);
    }
    if (botDomain) {
      validDomains.push(botDomain);
    }

    let manifest = (await fs.readFile(await this.getManifestTemplatePath(ctx.root))).toString();

    if (isMultiEnvEnabled()) {
      const view = {
        config: ctx.envInfo.config,
        profile: {
          "fx-resource-frontend-hosting": {
            endpoint: tabEndpoint,
          },
          "fx-resource-aad-app-for-teams": {
            clientId: aadId,
            applicationIdUris: webApplicationInfoResource,
          },
          "fx-resource-appstudio": {
            teamsAppId: teamsAppId,
          },
          "fx-resource-bot": {
            botId: botId,
          },
        },
      };
      manifest = Mustache.render(manifest, view);
    }

    const appName = ctx.projectSettings?.appName;
    if (appName) {
      manifest = this.replaceConfigValue(manifest, "appName", appName);
    }

    if (botId) {
      manifest = this.replaceConfigValue(manifest, "botId", botId);
    }

    if (tabEndpoint) {
      manifest = this.replaceConfigValue(manifest, "baseUrl", tabEndpoint);
    }

    manifest = this.replaceConfigValue(manifest, "appClientId", aadId);
    manifest = this.replaceConfigValue(manifest, "appid", teamsAppId);

    if (webApplicationInfoResource) {
      manifest = this.replaceConfigValue(
        manifest,
        "webApplicationInfoResource",
        webApplicationInfoResource
      );
    }

    let updatedManifest: TeamsAppManifest;
    try {
      updatedManifest = JSON.parse(manifest) as TeamsAppManifest;
    } catch (error) {
      if (error.stack && error.stack.startsWith("SyntaxError")) {
        // teams app id in userData may be updated by user, result to invalid manifest
        const reg = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;
        const result = teamsAppId.match(reg);
        if (!result) {
          return err(
            AppStudioResultFactory.UserError(
              AppStudioError.InvalidManifestError.name,
              AppStudioError.InvalidManifestError.message(error, "teamsAppId"),
              undefined,
              error.stack
            )
          );
        }
        return err(
          AppStudioResultFactory.UserError(
            AppStudioError.InvalidManifestError.name,
            AppStudioError.InvalidManifestError.message(error),
            undefined,
            error.stack
          )
        );
      } else {
        return err(error);
      }
    }

    for (const domain of validDomains) {
      updatedManifest.validDomains?.push(domain);
    }

    if (!tabEndpoint && updatedManifest.developer) {
      updatedManifest.developer.websiteUrl = DEFAULT_DEVELOPER_WEBSITE_URL;
      updatedManifest.developer.termsOfUseUrl = DEFAULT_DEVELOPER_TERM_OF_USE_URL;
      updatedManifest.developer.privacyUrl = DEFAULT_DEVELOPER_PRIVACY_URL;
    }

    const appDefinition = this.convertToAppDefinition(updatedManifest, false);
    // For local debug teams app, the app name will have a suffix to differentiate from remote teams app
    // if the resulting short name length doesn't exceeds limit.
    if (isLocalDebug) {
      const suffix = "-local-debug";
      if (
        suffix.length + (appDefinition.shortName ? appDefinition.shortName.length : 0) <=
        TEAMS_APP_SHORT_NAME_MAX_LENGTH
      ) {
        appDefinition.shortName = appDefinition.shortName + suffix;
        appDefinition.appName = appDefinition.shortName;
      }
    }

    return ok([appDefinition, updatedManifest]);
  }

  private async getManifestTemplatePath(projectRoot: string): Promise<string> {
    const appDir = await getAppDirectory(projectRoot);
    return isMultiEnvEnabled() ? `${appDir}/${MANIFEST_TEMPLATE}` : `${appDir}/${REMOTE_MANIFEST}`;
  }
}
