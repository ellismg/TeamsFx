
module simpleAuthProvision '{{PluginOutput.fx-resource-simple-auth.Modules.simpleAuthProvision.Path}}' = {
  name: 'simpleAuthProvision'
  params: {
    simpleAuthServerFarmsName: simpleAuth_serverFarmsName
    simpleAuthWebAppName: simpleAuth_webAppName
    sku: simpleAuth_sku
    m365AadClientId: m365AadClientId
    m365AadClientSecret: m365AadClientSecret
    applicationIdUri: applicationIdUri
    {{#contains 'fx-resource-frontend-hosting' Plugins}}
    frontendHostingStorageEndpoint: {{../PluginOutput.fx-resource-frontend-hosting.Outputs.endpoint}}
    {{/contains}}
    m365TenantId: m365TenantId
    oauthAuthorityHost: m365OauthAuthorityHost
  }
}
