// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import * as fs from "fs-extra";
import {
  Func,
  FxError,
  Platform,
  Plugin,
  PluginContext,
  Result,
  err,
  ok,
  VsCodeEnv,
  AzureSolutionSettings,
} from "@microsoft/teamsfx-api";
import * as os from "os";

import { LocalCertificateManager } from "./certificate";
import {
  SolutionPlugin,
  LocalEnvBotKeys,
  LocalEnvBotKeysMigratedFromV1,
  AppStudioPlugin,
} from "./constants";
import {
  LocalDebugConfigKeys,
  LocalEnvFrontendKeys,
  LocalEnvBackendKeys,
  LocalEnvAuthKeys,
  LocalEnvCertKeys,
} from "./constants";
import * as Launch from "./launch";
import * as Settings from "./settings";
import * as Tasks from "./tasks";
import { LocalEnvProvider } from "./localEnv";
import {
  LocalBotEndpointNotConfigured,
  MissingStep,
  NgrokTunnelNotConnected,
  InvalidLocalBotEndpointFormat,
} from "./util/error";
import { prepareLocalAuthService } from "./util/localService";
import { getNgrokHttpUrl } from "./util/ngrok";
import { getCodespaceName, getCodespaceUrl } from "./util/codespace";
import { TelemetryUtils, TelemetryEventName } from "./util/telemetry";
import { Service } from "typedi";
import { ResourcePlugins } from "../../solution/fx-solution/ResourcePluginContainer";
import { isMultiEnvEnabled } from "../../../common";
import { legacyLocalDebugPlugin } from "./legacyPlugin";
import {
  LocalSettingsAuthKeys,
  LocalSettingsBackendKeys,
  LocalSettingsBotKeys,
  LocalSettingsFrontendKeys,
  LocalSettingsTeamsAppKeys,
} from "../../../common/localSettingsConstants";
import { TeamsClientId } from "../../../common/constants";
import { ProjectSettingLoader } from "./projectSettingLoader";
import "./v2";
@Service(ResourcePlugins.LocalDebugPlugin)
export class LocalDebugPlugin implements Plugin {
  name = "fx-resource-local-debug";
  displayName = "LocalDebug";

  activate(solutionSettings: AzureSolutionSettings): boolean {
    return true;
  }

  public async scaffold(ctx: PluginContext): Promise<Result<any, FxError>> {
    const isSpfx = ProjectSettingLoader.isSpfx(ctx);
    const isMigrateFromV1 = ProjectSettingLoader.isMigrateFromV1(ctx);
    const includeFrontend = ProjectSettingLoader.includeFrontend(ctx);
    const includeBackend = ProjectSettingLoader.includeBackend(ctx);
    const includeBot = ProjectSettingLoader.includeBot(ctx);
    const includeAuth = ProjectSettingLoader.includeAuth(ctx);
    const programmingLanguage = ctx.projectSettings?.programmingLanguage ?? "";

    const telemetryProperties = {
      platform: ctx.answers?.platform as string,
      spfx: isSpfx ? "true" : "false",
      frontend: includeFrontend ? "true" : "false",
      function: includeBackend ? "true" : "false",
      bot: includeBot ? "true" : "false",
      auth: includeAuth ? "true" : "false",
      "programming-language": programmingLanguage,
    };
    TelemetryUtils.init(ctx);
    TelemetryUtils.sendStartEvent(TelemetryEventName.scaffold, telemetryProperties);

    // scaffold for both vscode and cli
    if (ctx.answers?.platform === Platform.VSCode || ctx.answers?.platform === Platform.CLI) {
      if (isSpfx) {
        // Only generate launch.json and tasks.json for SPFX
        const launchConfigurations = Launch.generateSpfxConfigurations();
        const launchCompounds = Launch.generateSpfxCompounds();
        const tasks = Tasks.generateSpfxTasks();
        const tasksInputs = Tasks.generateInputs();

        //TODO: save files via context api
        await fs.ensureDir(`${ctx.root}/.vscode/`);
        await fs.writeJSON(
          `${ctx.root}/.vscode/launch.json`,
          {
            version: "0.2.0",
            configurations: launchConfigurations,
            compounds: launchCompounds,
          },
          {
            spaces: 4,
            EOL: os.EOL,
          }
        );

        await fs.writeJSON(
          `${ctx.root}/.vscode/tasks.json`,
          {
            version: "2.0.0",
            tasks: tasks,
            inputs: tasksInputs,
          },
          {
            spaces: 4,
            EOL: os.EOL,
          }
        );
      } else {
        const launchConfigurations = Launch.generateConfigurations(
          includeFrontend,
          includeBackend,
          includeBot,
          isMigrateFromV1
        );
        const launchCompounds = Launch.generateCompounds(
          includeFrontend,
          includeBackend,
          includeBot
        );

        const tasks = Tasks.generateTasks(
          includeFrontend,
          includeBackend,
          includeBot,
          includeAuth,
          isMigrateFromV1,
          programmingLanguage
        );

        //TODO: save files via context api
        await fs.ensureDir(`${ctx.root}/.vscode/`);
        await fs.writeJSON(
          `${ctx.root}/.vscode/launch.json`,
          {
            version: "0.2.0",
            configurations: launchConfigurations,
            compounds: launchCompounds,
          },
          {
            spaces: 4,
            EOL: os.EOL,
          }
        );

        await fs.writeJSON(
          `${ctx.root}/.vscode/tasks.json`,
          {
            version: "2.0.0",
            tasks: tasks,
          },
          {
            spaces: 4,
            EOL: os.EOL,
          }
        );

        if (!isMultiEnvEnabled()) {
          const localEnvProvider = new LocalEnvProvider(ctx.root);
          await localEnvProvider.saveLocalEnv(
            localEnvProvider.initialLocalEnvs(
              includeFrontend,
              includeBackend,
              includeBot,
              includeAuth,
              isMigrateFromV1
            )
          );

          if (includeFrontend) {
            ctx.config.set(LocalDebugConfigKeys.TrustDevelopmentCertificate, "true");
          }

          if (includeBot) {
            ctx.config.set(LocalDebugConfigKeys.SkipNgrok, "false");
            ctx.config.set(LocalDebugConfigKeys.LocalBotEndpoint, "");
          }
        }

        if (includeBackend) {
          await fs.writeJSON(`${ctx.root}/.vscode/settings.json`, Settings.generateSettings(), {
            spaces: 4,
            EOL: os.EOL,
          });
        }
      }
    }

    TelemetryUtils.sendSuccessEvent(TelemetryEventName.scaffold, telemetryProperties);
    return ok(undefined);
  }

  public async localDebug(ctx: PluginContext): Promise<Result<any, FxError>> {
    // fallback to original local debug logic if multi-env is not enabled
    if (!isMultiEnvEnabled()) {
      return await legacyLocalDebugPlugin.localDebug(ctx);
    }

    const vscEnv = ctx.answers?.vscodeEnv;
    const includeFrontend = ProjectSettingLoader.includeFrontend(ctx);
    const includeBackend = ProjectSettingLoader.includeBackend(ctx);
    const includeBot = ProjectSettingLoader.includeBot(ctx);
    const includeAuth = ProjectSettingLoader.includeAuth(ctx);
    let skipNgrok = ctx.localSettings?.bot?.get(LocalSettingsBotKeys.SkipNgrok) as boolean;

    const telemetryProperties = {
      platform: ctx.answers?.platform as string,
      vscenv: vscEnv as string,
      frontend: includeFrontend ? "true" : "false",
      function: includeBackend ? "true" : "false",
      bot: includeBot ? "true" : "false",
      auth: includeAuth ? "true" : "false",
      "skip-ngrok": skipNgrok ? "true" : "false",
    };
    TelemetryUtils.init(ctx);
    TelemetryUtils.sendStartEvent(TelemetryEventName.localDebug, telemetryProperties);

    // setup configs used by other plugins
    // TODO: dynamicly determine local ports
    if (ctx.answers?.platform === Platform.VSCode || ctx.answers?.platform === Platform.CLI) {
      let localTabEndpoint: string;
      let localTabDomain: string;
      let localAuthEndpoint: string;
      let localFuncEndpoint: string;

      if (vscEnv === VsCodeEnv.codespaceBrowser || vscEnv === VsCodeEnv.codespaceVsCode) {
        const codespaceName = await getCodespaceName();

        localTabEndpoint = getCodespaceUrl(codespaceName, 3000);
        localTabDomain = new URL(localTabEndpoint).host;
        localAuthEndpoint = getCodespaceUrl(codespaceName, 5000);
        localFuncEndpoint = getCodespaceUrl(codespaceName, 7071);
      } else {
        localTabDomain = "localhost";
        localTabEndpoint = "https://localhost:3000";
        localAuthEndpoint = "http://localhost:5000";
        localFuncEndpoint = "http://localhost:7071";
      }

      if (includeAuth) {
        ctx.localSettings?.auth?.set(
          LocalSettingsAuthKeys.SimpleAuthServiceEndpoint,
          localAuthEndpoint
        );
      }

      if (includeFrontend) {
        ctx.localSettings?.frontend?.set(LocalSettingsFrontendKeys.TabEndpoint, localTabEndpoint);
        ctx.localSettings?.frontend?.set(LocalSettingsFrontendKeys.TabDomain, localTabDomain);
      }

      if (includeBackend) {
        ctx.localSettings?.backend?.set(
          LocalSettingsBackendKeys.FunctionEndpoint,
          localFuncEndpoint
        );
      }

      if (includeBot) {
        if (skipNgrok === undefined) {
          skipNgrok = false;
          ctx.localSettings?.bot?.set(LocalSettingsBotKeys.SkipNgrok, skipNgrok);
        }

        if (skipNgrok) {
          const localBotEndpoint = ctx.localSettings?.bot?.get(
            LocalSettingsBotKeys.BotEndpoint
          ) as string;
          if (localBotEndpoint === undefined) {
            const error = LocalBotEndpointNotConfigured();
            TelemetryUtils.sendErrorEvent(TelemetryEventName.localDebug, error);
            return err(error);
          }

          const botEndpointRegex = /https:\/\/.*(:\d+)?/g;
          if (!botEndpointRegex.test(localBotEndpoint)) {
            const error = InvalidLocalBotEndpointFormat(localBotEndpoint);
            TelemetryUtils.sendErrorEvent(TelemetryEventName.localDebug, error);
            return err(error);
          }

          ctx.localSettings?.bot?.set(LocalSettingsBotKeys.BotEndpoint, localBotEndpoint);
          ctx.localSettings?.bot?.set(LocalSettingsBotKeys.BotDomain, localBotEndpoint.slice(8));
        } else {
          const ngrokHttpUrl = await getNgrokHttpUrl(3978);
          if (!ngrokHttpUrl) {
            const error = NgrokTunnelNotConnected();
            TelemetryUtils.sendErrorEvent(TelemetryEventName.localDebug, error);
            return err(error);
          } else {
            ctx.localSettings?.bot?.set(LocalSettingsBotKeys.BotEndpoint, ngrokHttpUrl);
            ctx.localSettings?.bot?.set(LocalSettingsBotKeys.BotDomain, ngrokHttpUrl.slice(8));
          }
        }
      }
    }

    TelemetryUtils.sendSuccessEvent(TelemetryEventName.localDebug, telemetryProperties);
    return ok(undefined);
  }

  public async postLocalDebug(ctx: PluginContext): Promise<Result<any, FxError>> {
    // fallback to original post-localdebug logic if multi-env is not enabled
    // And the post-localdebug lifecycle can be removed if we use localSettings.json
    // and remove the local.env file for local debug,
    if (!isMultiEnvEnabled()) {
      return await legacyLocalDebugPlugin.postLocalDebug(ctx);
    }

    let trustDevCert = ctx.localSettings?.frontend?.get(LocalSettingsFrontendKeys.TrustDevCert);

    // setup local certificate
    try {
      if (trustDevCert === undefined) {
        trustDevCert = true;
        ctx.localSettings?.frontend?.set(LocalSettingsFrontendKeys.TrustDevCert, trustDevCert);
      }

      const certManager = new LocalCertificateManager(ctx);
      const localCert = await certManager.setupCertificate(trustDevCert);
      if (localCert) {
        ctx.localSettings?.frontend?.set(LocalSettingsFrontendKeys.SslCertFile, localCert.certPath);

        ctx.localSettings?.frontend?.set(LocalSettingsFrontendKeys.SslKeyFile, localCert.keyPath);
        ctx.localSettings?.frontend?.set(LocalSettingsFrontendKeys.SslCertFile, localCert.certPath);
      }
    } catch (error) {
      // do not break if cert error
    }

    return ok(undefined);
  }

  public async getLocalDebugEnvs(ctx: PluginContext): Promise<Record<string, string>> {
    const includeFrontend = ProjectSettingLoader.includeFrontend(ctx);
    const includeBackend = ProjectSettingLoader.includeBackend(ctx);
    const includeBot = ProjectSettingLoader.includeBot(ctx);
    const includeAuth = ProjectSettingLoader.includeAuth(ctx);
    // get config for local debug
    const clientId = ctx.localSettings?.auth?.get(LocalSettingsAuthKeys.ClientId) as string;
    const clientSecret = ctx.localSettings?.auth?.get(LocalSettingsAuthKeys.ClientSecret) as string;
    const applicationIdUri = ctx.localSettings?.auth?.get(
      LocalSettingsAuthKeys.ApplicationIdUris
    ) as string;
    const teamsAppTenantId = ctx.localSettings?.teamsApp.get(
      LocalSettingsTeamsAppKeys.TenantId
    ) as string;

    const teamsMobileDesktopAppId = TeamsClientId.MobileDesktop;
    const teamsWebAppId = TeamsClientId.Web;

    const localAuthPackagePath = ctx.localSettings?.auth?.get(
      LocalSettingsAuthKeys.SimpleAuthFilePath
    ) as string;
    const localAuthEndpoint = ctx.localSettings?.auth?.get(
      LocalSettingsAuthKeys.SimpleAuthServiceEndpoint
    ) as string;
    const localTabEndpoint = ctx.localSettings?.frontend?.get(
      LocalSettingsFrontendKeys.TabEndpoint
    ) as string;
    const localFuncEndpoint = ctx.localSettings?.backend?.get(
      LocalSettingsBackendKeys.FunctionEndpoint
    ) as string;

    const localEnvs: { [key: string]: string } = {};
    if (includeFrontend) {
      if (includeAuth) {
        // frontend local envs
        localEnvs[LocalEnvFrontendKeys.TeamsFxEndpoint] = localAuthEndpoint;
        localEnvs[LocalEnvFrontendKeys.LoginUrl] = `${localTabEndpoint}/auth-start.html`;
        localEnvs[LocalEnvFrontendKeys.ClientId] = clientId;

        // auth local envs (auth is only required by frontend)
        localEnvs[LocalEnvAuthKeys.Urls] = localAuthEndpoint;
        localEnvs[LocalEnvAuthKeys.ClientId] = clientId;
        localEnvs[LocalEnvAuthKeys.ClientSecret] = clientSecret;
        localEnvs[LocalEnvAuthKeys.IdentifierUri] = applicationIdUri;
        localEnvs[
          LocalEnvAuthKeys.AadMetadataAddress
        ] = `https://login.microsoftonline.com/${teamsAppTenantId}/v2.0/.well-known/openid-configuration`;
        localEnvs[
          LocalEnvAuthKeys.OauthAuthority
        ] = `https://login.microsoftonline.com/${teamsAppTenantId}`;
        localEnvs[LocalEnvAuthKeys.TabEndpoint] = localTabEndpoint;
        localEnvs[LocalEnvAuthKeys.AllowedAppIds] = [teamsMobileDesktopAppId, teamsWebAppId].join(
          ";"
        );

        if (localAuthPackagePath) {
          localEnvs[LocalEnvAuthKeys.ServicePath] = await prepareLocalAuthService(
            localAuthPackagePath
          );
        }
      }

      if (includeBackend) {
        localEnvs[LocalEnvFrontendKeys.FuncEndpoint] = localFuncEndpoint;
        localEnvs[LocalEnvFrontendKeys.FuncName] = ctx.projectSettings
          ?.defaultFunctionName as string;
        localEnvs[LocalEnvBackendKeys.FuncWorkerRuntime] = "node";

        // function local envs
        localEnvs[LocalEnvBackendKeys.ClientId] = clientId;
        localEnvs[LocalEnvBackendKeys.ClientSecret] = clientSecret;
        localEnvs[LocalEnvBackendKeys.AuthorityHost] = "https://login.microsoftonline.com";
        localEnvs[LocalEnvBackendKeys.TenantId] = teamsAppTenantId;
        localEnvs[LocalEnvBackendKeys.ApiEndpoint] = localFuncEndpoint;
        localEnvs[LocalEnvBackendKeys.ApplicationIdUri] = applicationIdUri;
        localEnvs[LocalEnvBackendKeys.AllowedAppIds] = [
          teamsMobileDesktopAppId,
          teamsWebAppId,
        ].join(";");
      }

      localEnvs[LocalEnvCertKeys.SslCrtFile] = ctx.localSettings?.frontend?.get(
        LocalSettingsFrontendKeys.SslCertFile
      );
      localEnvs[LocalEnvCertKeys.SslKeyFile] = ctx.localSettings?.frontend?.get(
        LocalSettingsFrontendKeys.SslKeyFile
      );
    }

    if (includeBot) {
      // bot local env
      if (ProjectSettingLoader.isMigrateFromV1(ctx)) {
        localEnvs[LocalEnvBotKeysMigratedFromV1.BotId] = ctx.localSettings?.bot?.get(
          LocalSettingsBotKeys.BotId
        ) as string;
        localEnvs[LocalEnvBotKeysMigratedFromV1.BotPassword] = ctx.localSettings?.bot?.get(
          LocalSettingsBotKeys.BotPassword
        ) as string;
      } else {
        localEnvs[LocalEnvBotKeys.BotId] = ctx.localSettings?.bot?.get(
          LocalSettingsBotKeys.BotId
        ) as string;
        localEnvs[LocalEnvBotKeys.BotPassword] = ctx.localSettings?.bot?.get(
          LocalSettingsBotKeys.BotPassword
        ) as string;
        localEnvs[LocalEnvBotKeys.ClientId] = clientId;
        localEnvs[LocalEnvBotKeys.ClientSecret] = clientSecret;
        localEnvs[LocalEnvBotKeys.TenantID] = teamsAppTenantId;
        localEnvs[LocalEnvBotKeys.OauthAuthority] = "https://login.microsoftonline.com";
        localEnvs[LocalEnvBotKeys.LoginEndpoint] = `${
          ctx.localSettings?.bot?.get(LocalSettingsBotKeys.BotEndpoint) as string
        }/auth-start.html`;
        localEnvs[LocalEnvBotKeys.ApplicationIdUri] = applicationIdUri;
      }

      if (includeBackend) {
        localEnvs[LocalEnvBackendKeys.ApiEndpoint] = localFuncEndpoint;
      }
    }

    return localEnvs;
  }

  public async executeUserTask(func: Func, ctx: PluginContext): Promise<Result<any, FxError>> {
    if (func.method == "getLaunchInput") {
      const env = func.params as string;
      const solutionConfigs = ctx.envInfo.profile.get(SolutionPlugin.Name);
      if (env === "remote") {
        // return remote teams app id
        const remoteId = isMultiEnvEnabled()
          ? (ctx.envInfo.profile
              .get(AppStudioPlugin.Name)
              ?.get(AppStudioPlugin.TeamsAppId) as string)
          : (solutionConfigs?.get(SolutionPlugin.RemoteTeamsAppId) as string);
        if (/^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(remoteId)) {
          return ok(remoteId);
        } else {
          return err(MissingStep("launching remote", "TeamsFx: Provision and TeamsFx: Deploy"));
        }
      } else {
        // return local teams app id
        const localTeamsAppId = isMultiEnvEnabled()
          ? (ctx.localSettings?.teamsApp.get(LocalSettingsTeamsAppKeys.TeamsAppId) as string)
          : (solutionConfigs?.get(SolutionPlugin.LocalTeamsAppId) as string);
        return ok(localTeamsAppId);
      }
    } else if (func.method === "getProgrammingLanguage") {
      const programmingLanguage = ctx.projectSettings?.programmingLanguage;
      return ok(programmingLanguage);
    } else if (func.method === "getSkipNgrokConfig") {
      const skipNgrok = ctx.localSettings?.bot?.get(LocalSettingsBotKeys.SkipNgrok);
      return ok(skipNgrok);
    } else if (func.method === "getLocalDebugEnvs") {
      const localEnvs = await this.getLocalDebugEnvs(ctx);
      return ok(localEnvs);
    } else if (func.method === "migrateV1Project") {
      return await this.scaffold(ctx);
    }

    return ok(undefined);
  }
}

export default new LocalDebugPlugin();
