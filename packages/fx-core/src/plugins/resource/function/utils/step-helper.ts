// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IProgressHandler, UserInteraction } from "@microsoft/teamsfx-api";

export class StepHelper {
  progressHandler?: IProgressHandler;

  message: string;
  title: string;

  constructor(title: string) {
    this.title = title;
    this.message = "";
  }

  public async start(entireSteps: number, ui?: UserInteraction) {
    this.progressHandler = ui?.createProgressBar(this.title, entireSteps);
    await this.progressHandler?.start();
  }

  public async forward(message: string): Promise<void> {
    await this.progressHandler?.next(message);
  }

  public async end(success: boolean): Promise<void> {
    await this.progressHandler?.end(success);
  }
}
