// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { Inputs, LocalSettings, PluginConfig, ProjectSettings } from "./types";

import {
  GraphTokenProvider,
  LogProvider,
  TelemetryReporter,
  AzureAccountProvider,
  AppStudioTokenProvider,
  TreeProvider,
  PermissionRequestProvider,
} from "./utils";
import { UserInteraction } from "./qm";
import { CryptoProvider } from "./utils";
import { EnvConfig } from "./schemas/envConfig";

/*
 * Context will be generated by Core and carry necessary information to
 * develop a Teams APP.
 */
export interface Context {
  root: string;

  logProvider?: LogProvider;

  telemetryReporter?: TelemetryReporter;

  azureAccountProvider?: AzureAccountProvider;

  graphTokenProvider?: GraphTokenProvider;

  appStudioToken?: AppStudioTokenProvider;

  treeProvider?: TreeProvider;

  answers?: Inputs;

  projectSettings?: ProjectSettings;

  localSettings?: LocalSettings;

  ui?: UserInteraction;

  cryptoProvider: CryptoProvider;

  permissionRequestProvider?: PermissionRequestProvider;
}

export interface EnvInfo {
  envName: string;
  // input
  config: EnvConfig;
  // output
  profile: Map<string, any>;
}

export interface SolutionContext extends Context {
  // dotVsCode?: VsCode;

  // app: TeamsAppManifest;

  envInfo: EnvInfo;
}

export interface PluginContext extends Context {
  // A readonly view of env info
  envInfo: EnvInfo;

  // A mutable config for current plugin
  config: PluginConfig;
}
