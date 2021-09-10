// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import {
  assembleError,
  Func,
  FxError,
  Inputs,
  newSystemError,
  newUserError,
  Stage,
  SystemError,
  UserError,
  ArchiveFolderName,
} from "@microsoft/teamsfx-api";

export const CoreSource = "Core";

export function ProjectFolderExistError(path: string): UserError {
  return newUserError(
    CoreSource,
    "ProjectFolderExistError",
    `Path ${path} already exists. Select a different folder.`
  );
}

export function ProjectFolderNotExistError(path: string): UserError {
  return newUserError(
    CoreSource,
    "ProjectFolderNotExistError",
    `Path ${path} does not exist. Select a different folder.`
  );
}

export function EmptyProjectFolderError(): SystemError {
  return newSystemError(CoreSource, "EmptyProjectFolderError", "Project path is empty");
}

export function MigrateNotImplementError(path: string): SystemError {
  return newSystemError(
    CoreSource,
    "MigrateNotImplemented",
    `Migrate V1 Project is not implemented.`
  );
}

export function WriteFileError(e: Error): SystemError {
  const error = assembleError(e);
  error.name = "WriteFileError";
  error.source = CoreSource;
  return error;
}

export function ReadFileError(e: Error): SystemError {
  const error = assembleError(e);
  error.name = "ReadFileError";
  error.source = CoreSource;
  return error;
}

export function CopyFileError(e: Error): SystemError {
  const error = assembleError(e);
  error.name = "CopyFileError";
  error.source = CoreSource;
  return error;
}

export function NoneFxError(e: any): FxError {
  const err = assembleError(e);
  err.name = "NoneFxError";
  return err;
}

export function NoProjectOpenedError(): UserError {
  return newUserError(
    CoreSource,
    "NoProjectOpened",
    "No project opened, you can create a new project or open an existing one."
  );
}

export function InvalidV1ProjectError(message?: string) {
  return newUserError(
    CoreSource,
    "InvalidV1Project",
    `The project is not a valid Teams Toolkit V1 project. ${message}`
  );
}

export function PathNotExistError(path: string): UserError {
  return newUserError(CoreSource, "PathNotExist", `The path not exist: ${path}`);
}

export function InvalidProjectError(msg?: string): UserError {
  return newUserError(
    CoreSource,
    "InvalidProject",
    `The command only works for project created by Teamsfx Toolkit. ${msg ? ": " + msg : ""}`
  );
}

export class ConcurrentError extends UserError {
  constructor() {
    super(
      new.target.name,
      "Concurrent operation error, please wait until the running task finish or you can reload the window to cancel it.",
      CoreSource
    );
  }
}

export function InvalidProjectSettingsFileError(msg?: string): UserError {
  return newUserError(
    CoreSource,
    "InvalidProjectSettingsFile",
    `The projectSettings.json file is corrupted.`
  );
}

export function TaskNotSupportError(task: Stage | string): SystemError {
  return newSystemError(CoreSource, "TaskNotSupport", `Task is not supported yet: ${task}`);
}

export function FetchSampleError(): UserError {
  return newUserError(CoreSource, "FetchSampleError", "Failed to download sample app");
}

export function InvalidInputError(reason: string, inputs?: Inputs): UserError {
  return newUserError(
    CoreSource,
    "InvalidInput",
    inputs
      ? `Invalid inputs: ${reason}, inputs: ${JSON.stringify(inputs)}`
      : `Invalid inputs: ${reason}`
  );
}

export function FunctionRouterError(func: Func): UserError {
  return newUserError(
    CoreSource,
    "FunctionRouterError",
    `Failed to route function call:${JSON.stringify(func)}`
  );
}

export function ContextUpgradeError(error: any, isUserError = false): FxError {
  if (isUserError) {
    return newUserError(
      CoreSource,
      "ContextUpgradeError",
      `Failed to update context: ${error.message}`,
      undefined,
      error
    );
  } else {
    return newSystemError(
      CoreSource,
      "ContextUpgradeError",
      `Failed to update context: ${error.message}`,
      undefined,
      error
    );
  }
}

export function PluginHasNoTaskImpl(pluginName: string, task: string): SystemError {
  return newSystemError(
    CoreSource,
    "PluginHasNoTaskImplError",
    `Plugin ${pluginName} has not implemented method: ${task}`
  );
}

export function ProjectSettingsUndefinedError(): SystemError {
  return newSystemError(
    CoreSource,
    "ProjectSettingsUndefinedError",
    "Project settings is undefined"
  );
}

export function ProjectEnvNotExistError(env: string): UserError {
  return newUserError(
    CoreSource,
    "ProjectEnvNotExistError",
    `The specified env ${env} does not exist. Select an existing env.`
  );
}

export function InvalidEnvNameError(): UserError {
  return new UserError(
    CoreSource,
    "InvalidEnvNameError",
    `Environment name can only contain letters, digits, _ and -.`
  );
}

export function ProjectEnvAlreadyExistError(env: string): FxError {
  return new UserError(
    "ProjectEnvAlreadyExistError",
    `Project environment ${env} already exists.`,
    CoreSource,
    new Error().stack
  );
}

export function InvalidEnvConfigError(env: string, errorMsg: string): UserError {
  return new UserError(
    CoreSource,
    "InvalidEnvConfigError",
    `The configuration config.${env}.json is invalid, details: ${errorMsg}.`
  );
}

export function NonExistEnvNameError(env: string): UserError {
  return new UserError(CoreSource, "NonExistEnvNameError", `Can not find environment ${env}.`);
}

export function NonActiveEnvError(): UserError {
  return new UserError(CoreSource, "NonActiveEnvError", `Can not find active environment.`);
}

export function ModifiedSecretError(): UserError {
  return new UserError(CoreSource, "ModifiedSecretError", "The secret file has been changed.");
}

export class LoadSolutionError extends SystemError {
  constructor() {
    super(new.target.name, "Failed to load solution", CoreSource);
  }
}

export class NotImplementedError extends SystemError {
  constructor(method: string) {
    super(new.target.name, `Method not implemented:${method}`, CoreSource);
  }
}

export class ObjectIsUndefinedError extends SystemError {
  constructor(name: string) {
    super(new.target.name, `Object ${name} is undefined, which is not expected`, CoreSource);
  }
}
