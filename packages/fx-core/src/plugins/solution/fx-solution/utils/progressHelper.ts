import { IProgressHandler, PluginContext } from "@microsoft/teamsfx-api";
import { getStrings } from "../../../../common";

export enum DeployArmTemplatesSteps {
  ExecuteDeployment = "Deploying solution ARM templates to Azure. This could take several minutes.",
}
export class ProgressHelper {
  static deployArmTemplatesProgress: IProgressHandler | undefined;

  static async startDeployArmTemplatesProgressHandler(
    ctx: PluginContext
  ): Promise<IProgressHandler | undefined> {
    await this.deployArmTemplatesProgress?.end(true);

    this.deployArmTemplatesProgress = ctx.ui?.createProgressBar(
      getStrings().solution.DeployArmTemplates.Progress.Title,
      Object.entries(DeployArmTemplatesSteps).length
    );
    await this.deployArmTemplatesProgress?.start(
      getStrings().solution.DeployArmTemplates.Progress.Start
    );
    return this.deployArmTemplatesProgress;
  }

  static async endDeployArmTemplatesProgress(success: boolean): Promise<void> {
    await this.deployArmTemplatesProgress?.end(success);
    this.deployArmTemplatesProgress = undefined;
  }
}
