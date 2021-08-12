param botServiceName string
param botServerfarmsName string
param botWebAppSKU string = 'F1'
param botServiceSKU string = 'S1'
param botSitesName string
param botAadClientId string
@secure()
param botAadClientSecret string
param botDisplayName string
param authLoginUriSuffix string
param m365ClientId string
@secure()
param m365ClientSecret string
param m365TenantId string
param m365OauthAuthorityHost string
param m365ApplicationIdUri string

resource botServices 'Microsoft.BotService/botServices@2021-03-01' = {
  kind: 'bot'
  location: 'global'
  name: botServiceName
  properties: {
    displayName: botDisplayName
    endpoint: 'https://${botServiceName}.azurewebsites.net/api/messages'
    msaAppId: botAadClientId
  }
  sku: {
    name: botServiceSKU
  }
}

resource botServices_MsTeamsChannel 'Microsoft.BotService/botServices/channels@2021-03-01' = {
  parent: botServices
  location: 'global'
  name: 'MsTeamsChannel'
  properties: {
    channelName: 'MsTeamsChannel'
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
  name: botSitesName
  properties: {
    reserved: false
    serverFarmId: botServerfarm.id
    siteConfig: {
      alwaysOn: false
      http20Enabled: false
      numberOfWorkers: 1
    }
  }
}

resource botWebAppSettings 'Microsoft.Web/sites/config@2021-01-01' = {
    parent: botWebApp
    name: 'appsettings'
     properties: {
      BOT_ID: botAadClientId
      BOT_PASSWORD: botAadClientSecret
      INITIATE_LOGIN_ENDPOINT: 'https://${botWebApp.properties.hostNames[0]}${authLoginUriSuffix}'
      M365_APPLICATION_ID_URI: m365ApplicationIdUri
      M365_AUTHORITY_HOST: m365OauthAuthorityHost
      M365_CLIENT_ID: m365ClientId
      M365_CLIENT_SECRET: m365ClientSecret
      M365_TENANT_ID: m365TenantId
      SCM_DO_BUILD_DURING_DEPLOYMENT: 'true'
      WEBSITE_NODE_DEFAULT_VERSION: '12.13.0'
     }
}
