import {OPTIONS_SCHEMA, OPTIONS_VERSION} from './options_schema';

export default function defaultOptions() {
  return {
    schema: OPTIONS_SCHEMA,
    version: OPTIONS_VERSION,
    '-enableQuickSwitch': false,
    '-refreshOnProfileChange': false,
    '-uiLocale': 'en',
    '-uiTheme': 'light',
    '-profileScopes': {
      tab: false,
      group: false,
      container: false,
      window: false
    },
    '-profileScopeAssignments': {
      containers: {}
    },
    '-profileGroupsEnabled': false,
    '-profileGroups': [] as Array<{color?: string; icon?: string; id: string; name: string; order?: number}>,
    '-contextMenuOptions': {
      switchProfile: true,
      tabProfile: false,
      groupProfile: false,
      containerProfile: false,
      windowProfile: false,
      linkProfileNewTab: false,
      linkProfileNewWindow: false,
      linkProfileNewPrivateWindow: false
    },
    '-startupProfileName': '',
    '-quickSwitchProfiles': [] as string[],
    '-revertProxyChanges': true,
    '-confirmDeletion': true,
    '-showCurrentProfileInGeneral': false,
    '-showRequestLens': true,
    '-routeInfoEnabled': true,
    '-routeInfoRequestDetailsEnabled': false,
    '-addConditionsToBottom': false,
    '-showProfileOptions': false,
    '-showPopupAddCondition': true,
    '-showPopupAddTempRule': true,
    '-showExternalProfile': true,
    '-networkRequestIgnoreListEnabled': false,
    '-networkRequestIgnoreList': [] as string[],
    '-downloadInterval': 1440,
    '+proxy': {
      bypassList: [
        {
          pattern: '127.0.0.1',
          conditionType: 'BypassCondition'
        },
        {
          pattern: '::1',
          conditionType: 'BypassCondition'
        },
        {
          pattern: 'localhost',
          conditionType: 'BypassCondition'
        }
      ],
      profileType: 'FixedProfile',
      name: 'proxy',
      color: '#99ccee',
      fallbackProxy: {
        port: 8080,
        scheme: 'http',
        host: 'proxy.example.com'
      }
    },
    '+auto switch': {
      profileType: 'SwitchProfile',
      rules: [
        {
          condition: {
            pattern: 'internal.example.com',
            conditionType: 'HostWildcardCondition'
          },
          profileName: 'direct'
        },
        {
          condition: {
            pattern: '*.example.com',
            conditionType: 'HostWildcardCondition'
          },
          profileName: 'proxy'
        }
      ],
      name: 'auto switch',
      color: '#99dd99',
      defaultProfileName: 'direct'
    }
  };
}
