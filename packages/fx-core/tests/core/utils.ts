// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  Solution,
  SolutionContext,
  FxError,
  Result,
  QTreeNode,
  Func,
  Stage,
  LogProvider,
  LogLevel,
  AzureAccountProvider,
  GraphTokenProvider,
  Tools,
  TokenProvider,
  AppStudioTokenProvider,
  TelemetryReporter,
  UserInteraction,
  IProgressHandler,
  SingleSelectConfig,
  MultiSelectConfig,
  InputTextConfig,
  SelectFileConfig,
  SelectFilesConfig,
  SelectFolderConfig,
  SingleSelectResult,
  MultiSelectResult,
  InputTextResult,
  SelectFileResult,
  SelectFilesResult,
  SelectFolderResult,
  RunnableTask,
  TaskConfig,
  SubscriptionInfo,
  Inputs,
  ProjectSettings,
  AzureSolutionSettings,
  ok,
  Void,
  ConfigMap,
  Colors,
  Json,
  CryptoProvider,
  PermissionRequestProvider,
} from "@microsoft/teamsfx-api";
import { TokenCredential } from "@azure/core-auth";
import { TokenCredentialsBase } from "@azure/ms-rest-nodeauth";
import { SolutionLoader } from "../../src/core/loader";
import {
  DEFAULT_PERMISSION_REQUEST,
  PluginNames,
} from "../../src/plugins/solution/fx-solution/constants";
import * as uuid from "uuid";

export class MockSolution implements Solution {
  name = "fx-solution-mock";
  async create(ctx: SolutionContext): Promise<Result<any, FxError>> {
    ctx.projectSettings!.solutionSettings = this.solutionSettings();
    const config = new ConfigMap();
    config.set("create", true);
    ctx.config.set("solution", config);
    return ok(Void);
  }
  solutionSettings(): AzureSolutionSettings {
    return {
      name: this.name,
      version: "1.0.0",
      hostType: "Azure",
      capabilities: ["Tab"],
      azureResources: [],
      activeResourcePlugins: [PluginNames.FE, PluginNames.LDEBUG, PluginNames.AAD, PluginNames.SA],
    } as AzureSolutionSettings;
  }
  async scaffold(ctx: SolutionContext): Promise<Result<any, FxError>> {
    ctx.config.get("solution")!.set("scaffold", true);
    return ok(Void);
  }
  async provision(ctx: SolutionContext): Promise<Result<any, FxError>> {
    ctx.config.get("solution")!.set("provision", true);
    return ok(Void);
  }
  async deploy(ctx: SolutionContext): Promise<Result<any, FxError>> {
    ctx.config.get("solution")!.set("deploy", true);
    return ok(Void);
  }
  async publish(ctx: SolutionContext): Promise<Result<any, FxError>> {
    ctx.config.get("solution")!.set("publish", true);
    return ok(Void);
  }
  async localDebug(ctx: SolutionContext): Promise<Result<any, FxError>> {
    ctx.config.get("solution")!.set("localDebug", true);
    return ok(Void);
  }
  async getQuestions(
    task: Stage,
    ctx: SolutionContext
  ): Promise<Result<QTreeNode | undefined, FxError>> {
    return ok(undefined);
  }
  async getQuestionsForUserTask(
    func: Func,
    ctx: SolutionContext
  ): Promise<Result<QTreeNode | undefined, FxError>> {
    return ok(undefined);
  }
  async executeUserTask(func: Func, ctx: SolutionContext): Promise<Result<any, FxError>> {
    ctx.config.get("solution")!.set("executeUserTask", true);
    return ok(Void);
  }
}

export class MockSolutionLoader implements SolutionLoader {
  async loadSolution(inputs: Inputs): Promise<Solution> {
    return new MockSolution();
  }
  async loadGlobalSolutions(inputs: Inputs): Promise<Solution[]> {
    return [new MockSolution()];
  }
}

export function randomAppName() {
  return "mock" + new Date().getTime();
}

export class MockAzureAccountProvider implements AzureAccountProvider {
  getAccountCredentialAsync(): Promise<TokenCredentialsBase | undefined> {
    throw new Error("getAccountCredentialAsync Method not implemented.");
  }
  getIdentityCredentialAsync(): Promise<TokenCredential | undefined> {
    throw new Error("getIdentityCredentialAsync Method not implemented.");
  }
  signout(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  setStatusChangeMap(
    name: string,
    statusChange: (
      status: string,
      token?: string,
      accountInfo?: Record<string, unknown>
    ) => Promise<void>
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  removeStatusChangeMap(name: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getJsonObject(showDialog?: boolean): Promise<Record<string, unknown>> {
    throw new Error("Method not implemented.");
  }
  listSubscriptions(): Promise<SubscriptionInfo[]> {
    throw new Error("Method not implemented.");
  }
  setSubscription(subscriptionId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getAccountInfo(): Record<string, string> {
    throw new Error("Method not implemented.");
  }
  getSelectedSubscription(): Promise<SubscriptionInfo | undefined> {
    throw new Error("Method not implemented.");
  }
  selectSubscription(subscriptionId?: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
}

class MockGraphTokenProvider implements GraphTokenProvider {
  getAccessToken(): Promise<string | undefined> {
    const result = new Promise<string>(function (resovle, {}) {
      resovle("success");
    });
    return result;
  }
  getJsonObject(): Promise<Record<string, unknown> | undefined> {
    const result = new Promise<Record<string, unknown>>(function (resovle, {}) {
      resovle({});
    });
    return result;
  }
  signout(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  setStatusChangeMap(
    name: string,
    statusChange: (
      status: string,
      token?: string,
      accountInfo?: Record<string, unknown>
    ) => Promise<void>
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  removeStatusChangeMap(name: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}

class MockAppStudioTokenProvider implements AppStudioTokenProvider {
  /**
   * Get team access token
   * @param showDialog Control whether the UI layer displays pop-up windows
   */
  getAccessToken(showDialog?: boolean): Promise<string | undefined> {
    throw new Error("Method not implemented.");
  }

  /**
   * Get app studio token JSON object
   * - tid : tenantId
   * - unique_name : user name
   * - ...
   * @param showDialog Control whether the UI layer displays pop-up windows
   */
  getJsonObject(showDialog?: boolean): Promise<Record<string, unknown> | undefined> {
    throw new Error("Method not implemented.");
  }

  /**
   * App studio sign out
   */
  signout(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  /**
   * Add update account info callback
   * @param name callback name
   * @param statusChange callback method
   * @param immediateCall whether callback when register, the default value is true
   */
  setStatusChangeMap(
    name: string,
    statusChange: (
      status: string,
      token?: string,
      accountInfo?: Record<string, unknown>
    ) => Promise<void>,
    immediateCall?: boolean
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  /**
   * Remove update account info callback
   * @param name callback name
   */
  removeStatusChangeMap(name: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}

class MockTelemetryReporter implements TelemetryReporter {
  sendTelemetryErrorEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    // do nothing
  }

  sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
    errorProps?: string[]
  ): void {
    // do nothing
  }

  sendTelemetryException(
    error: Error,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    // do nothing
  }
}

export class MockUserInteraction implements UserInteraction {
  selectOption(config: SingleSelectConfig): Promise<Result<SingleSelectResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  selectOptions(config: MultiSelectConfig): Promise<Result<MultiSelectResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  inputText(config: InputTextConfig): Promise<Result<InputTextResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  selectFile(config: SelectFileConfig): Promise<Result<SelectFileResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  selectFiles(config: SelectFilesConfig): Promise<Result<SelectFilesResult, FxError>> {
    throw new Error("Method not implemented.");
  }
  selectFolder(config: SelectFolderConfig): Promise<Result<SelectFolderResult, FxError>> {
    throw new Error("Method not implemented.");
  }

  openUrl(link: string): Promise<Result<boolean, FxError>> {
    throw new Error("Method not implemented.");
  }
  async showMessage(
    level: "info" | "warn" | "error",
    message: string,
    modal: boolean,
    ...items: string[]
  ): Promise<Result<string | undefined, FxError>>;

  async showMessage(
    level: "info" | "warn" | "error",
    message: Array<{ content: string; color: Colors }>,
    modal: boolean,
    ...items: string[]
  ): Promise<Result<string | undefined, FxError>>;

  async showMessage(
    level: "info" | "warn" | "error",
    message: string | Array<{ content: string; color: Colors }>,
    modal: boolean,
    ...items: string[]
  ): Promise<Result<string | undefined, FxError>> {
    return ok("");
  }
  createProgressBar(title: string, totalSteps: number): IProgressHandler {
    const handler: IProgressHandler = {
      start: async (detail?: string): Promise<void> => {},
      next: async (detail?: string): Promise<void> => {},
      end: async (): Promise<void> => {},
    };
    return handler;
  }
  async runWithProgress<T>(
    task: RunnableTask<T>,
    config: TaskConfig,
    ...args: any
  ): Promise<Result<T, FxError>> {
    return task.run(args);
  }
}

export class MockTools implements Tools {
  logProvider = new MockLogProvider();
  tokenProvider: TokenProvider = {
    azureAccountProvider: new MockAzureAccountProvider(),
    graphTokenProvider: new MockGraphTokenProvider(),
    appStudioToken: new MockAppStudioTokenProvider(),
  };
  telemetryReporter = new MockTelemetryReporter();
  ui = new MockUserInteraction();
  cryptoProvider = new MockCryptoProvider();
  permissionRequestProvider = new MockPermissionRequestProvider();
}

export class MockCryptoProvider implements CryptoProvider {
  encrypt(plaintext: string): Result<string, FxError> {
    return ok(plaintext);
  }
  decrypt(ciphertext: string): Result<string, FxError> {
    return ok(ciphertext);
  }
}

export class MockPermissionRequestProvider implements PermissionRequestProvider {
  async checkPermissionRequest(): Promise<Result<undefined, FxError>> {
    return ok(undefined);
  }

  async getPermissionRequest(): Promise<Result<string, FxError>> {
    return ok(JSON.stringify(DEFAULT_PERMISSION_REQUEST));
  }
}

export class MockLogProvider implements LogProvider {
  async trace({}: string): Promise<boolean> {
    return true;
  }
  async debug({}: string): Promise<boolean> {
    return true;
  }
  async info({}: string | Array<any>): Promise<boolean> {
    return true;
  }
  async warning({}: string): Promise<boolean> {
    return true;
  }
  async error({}: string): Promise<boolean> {
    return true;
  }
  async fatal({}: string): Promise<boolean> {
    return true;
  }
  async log({}: LogLevel, {}: string): Promise<boolean> {
    return true;
  }
}

export function MockProjectSettings(appName: string): ProjectSettings {
  return {
    appName: appName,
    projectId: uuid.v4(),
    solutionSettings: {
      name: PluginNames.SOLUTION,
      version: "1.0.0",
      hostType: "Azure",
      capabilities: ["Tab"],
      azureResources: [],
      activeResourcePlugins: [PluginNames.FE, PluginNames.LDEBUG, PluginNames.AAD, PluginNames.SA],
    } as AzureSolutionSettings,
  };
}

export function MockPreviousVersionBefore2_3_0Context(): Json {
  return {
    solution: {
      teamsAppTenantId: "tenantId",
      localDebugTeamsAppId: "teamsAppId",
    },
    "fx-resource-aad-app-for-teams": {
      local_clientId: "local_clientId",
      local_clientSecret: "{{fx-resource-aad-app-for-teams.local_clientSecret}}",
      local_objectId: "local_objectId",
      local_oauth2PermissionScopeId: "local_oauth2PermissionScopeId",
      local_tenantId: "local_tenantId",
      local_applicationIdUris: "local_applicationIdUris",
    },
  };
}

export function MockPreviousVersionBefore2_3_0UserData(): Record<string, string> {
  return {
    "fx-resource-aad-app-for-teams.local_clientSecret": "local_clientSecret",
  };
}

export function MockLatestVersion2_3_0Context(): Json {
  return {
    solution: {
      teamsAppTenantId: "{{solution.teamsAppTenantId}}",
      localDebugTeamsAppId: "{{solution.localDebugTeamsAppId}}",
    },
    "fx-resource-aad-app-for-teams": {
      local_clientId: "{{fx-resource-aad-app-for-teams.local_clientId}}",
      local_clientSecret: "{{fx-resource-aad-app-for-teams.local_clientSecret}}",
      local_objectId: "{{fx-resource-aad-app-for-teams.local_objectId}}",
      local_oauth2PermissionScopeId:
        "{{fx-resource-aad-app-for-teams.local_oauth2PermissionScopeId}}",
      local_tenantId: "{{fx-resource-aad-app-for-teams.local_tenantId}}",
      local_applicationIdUris: "{{fx-resource-aad-app-for-teams.local_applicationIdUris}}",
    },
  };
}

export function MockLatestVersion2_3_0UserData(): Record<string, string> {
  return {
    "fx-resource-aad-app-for-teams.local_clientId": "local_clientId_new",
    "fx-resource-aad-app-for-teams.local_clientSecret": "local_clientSecret_new",
    "fx-resource-aad-app-for-teams.local_objectId": "local_objectId_new",
    "fx-resource-aad-app-for-teams.local_oauth2PermissionScopeId":
      "local_oauth2PermissionScopeId_new",
    "fx-resource-aad-app-for-teams.local_tenantId": "local_tenantId_new",
    "fx-resource-aad-app-for-teams.local_applicationIdUris": "local_applicationIdUris_new",
    "solution.teamsAppTenantId": "tenantId_new",
    "solution.localDebugTeamsAppId": "teamsAppId_new",
  };
}
