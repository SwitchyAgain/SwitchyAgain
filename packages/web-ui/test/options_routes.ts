import {parseRoute, routeHref} from '../src/react/options_routes';

describe('options routes', () => {
  it('builds stable route hrefs', () => {
    expect(routeHref('about')).toBe('#/about');
    expect(routeHref('general')).toBe('#/general');
    expect(routeHref('routeTrace')).toBe('#/routeTrace');
    expect(routeHref('profile', {name: 'proxy/main'})).toBe('#/profile/proxy%2Fmain');
  });

  it('parses plain hash routes', () => {
    expect(parseRoute('#/ui')).toEqual({
      name: 'ui',
      params: {}
    });
    expect(parseRoute('#!/general')).toEqual({
      name: 'general',
      params: {}
    });
    expect(parseRoute('#/io')).toEqual({
      name: 'io',
      params: {}
    });
  });

  it('preserves query params on non-profile routes', () => {
    expect(parseRoute('#/routeTrace?url=https%3A%2F%2Fexample.com%2F&includeTempRules=1')).toEqual({
      name: 'routeTrace',
      params: {
        includeTempRules: '1',
        url: 'https://example.com/'
      }
    });
    expect(parseRoute('#/profileScope?container=firefox-default')).toEqual({
      name: 'profileScope',
      params: {
        container: 'firefox-default'
      }
    });
  });

  it('parses profile routes with encoded names and query params', () => {
    expect(parseRoute('#/profile/proxy%2Fmain?help=condition&tab=rules')).toEqual({
      name: 'profile',
      params: {
        help: 'condition',
        tab: 'rules'
      },
      profileName: 'proxy/main'
    });
  });

  it('falls back to about for empty or unknown routes', () => {
    expect(parseRoute('')).toEqual({
      name: 'about',
      params: {}
    });
    expect(parseRoute('#/unknown?x=1')).toEqual({
      name: 'about',
      params: {
        x: '1'
      }
    });
  });
});
