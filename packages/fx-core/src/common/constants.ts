export class ConstantString {
  static readonly UTF8Encoding = "utf-8";
  static readonly DeploymentResourceType = "Microsoft.Resources/deployments";
  static readonly DeploymentNotFound = "DeploymentNotFound";
}

export const ArmHelpLink = "https://aka.ms/teamsfx-arm-help";

export class Bicep {
  static readonly ParameterOrchestrationFileName: string = "param.template.bicep";
  static readonly ModuleOrchestrationFileName: string = "module.template.bicep";
  static readonly OutputOrchestrationFileName: string = "output.template.bicep";
  static readonly VariablesOrchestrationFileName: string = "variables.template.bicep";
  static readonly ParameterFileName: string = "parameters.json";
}

export class TeamsClientId {
  static readonly MobileDesktop = "1fec8e78-bce4-4aaf-ab1b-5451cc387264";
  static readonly Web = "5e3ce6c0-2b1f-4285-8d4b-75ee78787346";
}

export class ResourcePlugins {
  static readonly Aad = "fx-resource-aad-app-for-teams";
  static readonly FrontendHosting = "fx-resource-frontend-hosting";
  static readonly SimpleAuth = "fx-resource-simple-auth";
  static readonly Bot = "fx-resource-bot";
  static readonly LocalDebug = "fx-resource-local-debug";
  static readonly AzureSQL = "fx-resource-azure-sql";
  static readonly Function = "fx-resource-function";
  static readonly Identity = "fx-resource-identity";
}
export class PluginDisplayName {
  static readonly Solution = "Teams Toolkit";
}

export class FeatureFlagName {
  static readonly MultiEnv = "TEAMSFX_MULTI_ENV";
  static readonly ArmSupport = "TEAMSFX_ARM_SUPPORT";
  static readonly BicepEnvCheckerEnable = "TEAMSFX_BICEP_ENV_CHECKER_ENABLE";
  static readonly RemoteCollaboration = "TEAMSFX_REMOTE_COL";
  static readonly APIV2 = "TEAMSFX_APIV2";
}
