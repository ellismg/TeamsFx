param botServiceName string
param botAadClientId string
param botDisplayName string
param botServerfarmsName string
param botWebAppSKU string = 'F1'
param botServiceSKU string = 'F1'
param botWebAppName string
{{#contains 'fx-resource-identity' Plugins}}
param identityName string
{{/contains}}

var botWebAppHostname = botWebApp.properties.hostNames[0]
var botEndpoint = 'https://${botWebAppHostname}'

resource botServices 'Microsoft.BotService/botServices@2021-03-01' = {
  kind: 'azurebot'
  location: 'global'
  name: botServiceName
  properties: {
    displayName: botDisplayName
    endpoint: uri(botEndpoint, '/api/messages')
    msaAppId: botAadClientId
  }
  sku: {
    name: botServiceSKU
  }
}

resource botServerfarm 'Microsoft.Web/serverfarms@2021-01-01' = {
  kind: 'app'
  location: resourceGroup().location
  name: botServerfarmsName
  properties: {
    reserved: false
  }
  sku: {
    name: botWebAppSKU
  }
}

resource botWebApp 'Microsoft.Web/sites@2021-01-01' = {
  kind: 'app'
  location: resourceGroup().location
  name: botWebAppName
  properties: {
    reserved: false
    serverFarmId: botServerfarm.id
    siteConfig: {
      alwaysOn: false
      http20Enabled: false
      numberOfWorkers: 1
    }
  }
  {{#contains 'fx-resource-identity' Plugins}}
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityName}': {}
    }
  }
  {{/contains}}
}

output botWebAppSKU string = botWebAppSKU
output botServiceSKU string = botServiceSKU
output botWebAppName string = botWebAppName
output botDomain string = botWebAppHostname
output appServicePlanName string = botServerfarmsName
output botServiceName string = botServiceName
output botWebAppResourceId string = botWebApp.id
output botWebAppEndpoint string = botEndpoint
