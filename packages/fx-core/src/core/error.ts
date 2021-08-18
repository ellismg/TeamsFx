// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { Func, FxError, Inputs, Stage, SystemError, UserError } from "@microsoft/teamsfx-api";

export const CoreSource = "Core";

export function ProjectFolderExistError(path: string) {
  return new UserError(
    "ProjectFolderExistError",
    `Path ${path} alreay exists. Select a different folder.`,
    CoreSource,
    new Error().stack
  );
}

export function WriteFileError(e: Error): SystemError {
  return new SystemError(
    "WriteFileError",
    `write file error ${e["message"]}`,
    CoreSource,
    e.stack,
    undefined,
    e
  );
}

export function ReadFileError(e: Error): SystemError {
  return new SystemError(
    "ReadFileError",
    `read file error ${e["message"]}`,
    CoreSource,
    e.stack,
    undefined,
    e
  );
}

export function NoneFxError(e: Error): SystemError {
  return new SystemError(
    "NoneFxError",
    `NoneFxError ${e["message"]}`,
    CoreSource,
    e.stack,
    undefined,
    e
  );
}

export function NoProjectOpenedError() {
  return new UserError(
    "NoProjectOpened",
    "No project opened, you can create a new project or open an existing one.",
    CoreSource,
    new Error().stack
  );
}

export function PathNotExistError(path: string) {
  return new UserError(
    "PathNotExist",
    `The path not exist: ${path}`,
    CoreSource,
    new Error().stack
  );
}

export function InvalidProjectError(msg?: string) {
  return new UserError(
    "InvalidProject",
    `The command only works for project created by Teamsfx Toolkit. ${msg ? ": " + msg : ""}`,
    CoreSource,
    new Error().stack
  );
}

export function ConcurrentError() {
  return new UserError(
    "ConcurrentOperation",
    "Concurrent operation error, please wait until the running task finish or you can reload the window to cancel it.",
    CoreSource,
    new Error().stack
  );
}

export function TaskNotSupportError(task: Stage | string) {
  return new SystemError(
    "TaskNotSupport",
    `Task is not supported yet: ${task}`,
    CoreSource,
    new Error().stack
  );
}

export function FetchSampleError() {
  return new UserError(
    "FetchSampleError",
    "Failed to download sample app",
    CoreSource,
    new Error().stack
  );
}

export function InvalidInputError(reason: string, inputs?: Inputs) {
  return new UserError(
    "InvalidInput",
    inputs
      ? `Invalid inputs: ${reason}, inputs: ${JSON.stringify(inputs)}`
      : `Invalid inputs: ${reason}`,
    CoreSource,
    new Error().stack
  );
}

export function FunctionRouterError(func: Func) {
  return new UserError(
    "FunctionRouterError",
    `Failed to route function call:${JSON.stringify(func)}`,
    CoreSource,
    new Error().stack
  );
}

export function ContextUpgradeError(error: any, isUserError = false): FxError {
  if (isUserError) {
    return new UserError(
      "ContextUpgradeError",
      `Failed to update context: ${error.message}`,
      CoreSource,
      error.stack ?? new Error().stack
    );
  } else {
    return new SystemError(
      "ContextUpgradeError",
      `Failed to update context: ${error.message}`,
      CoreSource,
      error.stack ?? new Error().stack
    );
  }
}

export function PluginHasNoTaskImpl(pluginName: string, task: string) {
  return new SystemError(
    "PluginHasNoTaskImplError",
    `Plugin ${pluginName} has not implemented method: ${task}`,
    CoreSource,
    new Error().stack
  );
}

export function ProjectSettingsUndefinedError(): FxError {
  return new SystemError(
    "ProjectSettingsUndefinedError",
    "Project settings is undefined",
    CoreSource,
    new Error().stack
  );
}

export function ProjectEnvNotExistError(env: string) {
  return new UserError(
    "ProjectEnvNotExistError",
    `The specified env ${env} does not exist. Select an existing env.`,
    CoreSource,
    new Error().stack
  );
}
