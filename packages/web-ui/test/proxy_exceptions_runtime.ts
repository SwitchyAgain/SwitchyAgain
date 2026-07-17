import {optionsWithProxyExceptions} from '../../../apps/browser-extension/src/module/proxy_exceptions';

describe('Proxy Exceptions runtime options', () => {
  const condition = (pattern: string) => ({conditionType: 'BypassCondition', pattern});

  function options() {
    return {
      '-proxyExceptionsEnabled': true,
      '-globalBypassListId': 'supplemental-list-global',
      '-profileGroupsEnabled': true,
      '-profileGroups': [
        {
          id: 'group-work',
          name: 'Work Group',
          supplementalListIds: ['supplemental-list-work']
        }
      ],
      '-supplementalLists': [
        {
          id: 'supplemental-list-global',
          name: 'Global List',
          bypassList: [condition('global.example')]
        },
        {
          id: 'supplemental-list-work',
          name: 'Work',
          bypassList: [condition('work.example')],
          bypassGroups: [
            {name: 'Enabled', bypassList: [condition('enabled.example')]},
            {name: 'Disabled', enabled: false, bypassList: [condition('disabled.example')]}
          ]
        }
      ],
      '+proxy1': {
        name: 'proxy1',
        profileType: 'FixedProfile',
        bypassList: [condition('profile.example')],
        supplementalListIds: ['supplemental-list-global', 'supplemental-list-work']
      },
      '+proxy2': {
        name: 'proxy2',
        profileType: 'FixedProfile',
        bypassList: []
      },
      '+proxy3': {
        name: 'proxy3',
        profileType: 'FixedProfile',
        bypassList: [],
        profileGroupEnabled: true,
        profileGroupId: 'group-work',
        supplementalListIds: ['supplemental-list-work']
      },
      '+proxy4': {
        name: 'proxy4',
        profileType: 'FixedProfile',
        bypassList: [],
        profileGroupEnabled: false,
        profileGroupId: 'group-work'
      },
      '+pac': {
        name: 'pac',
        profileType: 'PacProfile'
      }
    };
  }

  it('applies Global, direct, and inherited lists once to Proxy Profiles only', () => {
    const effective = optionsWithProxyExceptions(options()) as any;

    expect(effective['+proxy1'].bypassList.map((item: any) => item.pattern)).toEqual([
      'profile.example',
      'global.example',
      'work.example',
      'enabled.example'
    ]);
    expect(effective['+proxy2'].bypassList.map((item: any) => item.pattern)).toEqual(['global.example']);
    expect(effective['+proxy3'].bypassList.map((item: any) => item.pattern)).toEqual(['global.example', 'work.example', 'enabled.example']);
    expect(effective['+proxy4'].bypassList.map((item: any) => item.pattern)).toEqual(['global.example']);
    expect(effective['+proxy1'].bypassList[1]).toMatchObject({globalBypass: true, supplementalListName: 'Global List'});
    expect(effective['+proxy1'].bypassList[2]).toMatchObject({supplementalBypass: true, supplementalListName: 'Work'});
    expect(effective['+pac']).toEqual(options()['+pac']);
  });

  it('does not apply any Supplemental Lists while Proxy Exceptions is disabled', () => {
    const source = {...options(), '-proxyExceptionsEnabled': false};
    expect(optionsWithProxyExceptions(source)).toBe(source);
  });

  it('preserves but does not apply Profile Group links while Profile Groups are disabled', () => {
    const source = {...options(), '-profileGroupsEnabled': false};
    delete (source['+proxy3'] as {supplementalListIds?: string[]}).supplementalListIds;
    const effective = optionsWithProxyExceptions(source) as any;
    expect(effective['+proxy3'].bypassList.map((item: any) => item.pattern)).toEqual(['global.example']);
  });
});
