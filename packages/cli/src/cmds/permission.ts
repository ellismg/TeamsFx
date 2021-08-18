// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

"use strict";

import path from "path";
import { FxError, err, ok, Result, Stage } from "@microsoft/teamsfx-api";
import { Argv, Options } from "yargs";
import { YargsCommand } from "../yargsCommand";
import CliTelemetry from "../telemetry/cliTelemetry";
import {
  TelemetryEvent,
  TelemetryProperty,
  TelemetrySuccess,
} from "../telemetry/cliTelemetryEvents";
import activate from "../activate";
import { getSystemInputs } from "../utils";
import HelpParamGenerator from "../helpParamGenerator";

export class PermissionStatus extends YargsCommand {
  public readonly commandHead = `status`;
  public readonly command = `${this.commandHead}`;
  public readonly description = "Check user's permission.";

  public params: { [_: string]: Options } = {};

  public builder(yargs: Argv): Argv<any> {
    this.params = HelpParamGenerator.getYargsParamForHelp(Stage.checkPermission);
    return yargs.option(this.params);
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    const rootFolder = path.resolve(args.folder || "./");
    CliTelemetry.withRootFolder(rootFolder).sendTelemetryEvent(TelemetryEvent.CheckPermissionStart);

    const result = await activate(rootFolder);
    if (result.isErr()) {
      CliTelemetry.sendTelemetryErrorEvent(TelemetryEvent.CheckPermission, result.error);
      return err(result.error);
    }

    const core = result.value;
    {
      const result = await core.checkPermission(getSystemInputs(rootFolder));
      if (result.isErr()) {
        CliTelemetry.sendTelemetryErrorEvent(TelemetryEvent.CheckPermission, result.error);
        return err(result.error);
      }
    }

    CliTelemetry.sendTelemetryEvent(TelemetryEvent.CheckPermission, {
      [TelemetryProperty.Success]: TelemetrySuccess.Yes,
    });
    return ok(null);
  }
}

export default class Permission extends YargsCommand {
  public readonly commandHead = `permission`;
  public readonly command = `${this.commandHead} <action>`;
  public readonly description = "Check, grant and list user permission.";

  public readonly subCommands: YargsCommand[] = [new PermissionStatus()];

  public builder(yargs: Argv): Argv<any> {
    this.subCommands.forEach((cmd) => {
      yargs.command(cmd.command, cmd.description, cmd.builder.bind(cmd), cmd.handler.bind(cmd));
    });

    return yargs.version(false);
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    return ok(null);
  }
}
