export type RouteName =
  | 'about'
  | 'general'
  | 'io'
  | 'profile'
  | 'profileGroups'
  | 'profileScope'
  | 'proxyExceptions'
  | 'requestLens'
  | 'ui';

export type Route = {
  name: RouteName;
  params?: Record<string, string>;
  profileName?: string;
};

export function routeHref(route: RouteName, params?: Record<string, string>) {
  if (route === 'profile') {
    return `#/profile/${encodeURIComponent(params?.name || '')}`;
  }
  return `#/${route}`;
}

export function parseRoute(hash = ''): Route {
  const value = hash.replace(/^#!?\/?/, '');
  const [path, query = ''] = value.split('?', 2);
  const params = Object.fromEntries(new URLSearchParams(query));
  const parts = path.split('/');
  switch (parts[0]) {
    case 'ui':
      return {name: 'ui', params};
    case 'general':
      return {name: 'general', params};
    case 'requestLens':
      return {name: 'requestLens', params};
    case 'profileScope':
      return {name: 'profileScope', params};
    case 'profileGroups':
      return {name: 'profileGroups', params};
    case 'proxyExceptions':
      return {name: 'proxyExceptions', params};
    case 'io':
      return {name: 'io', params};
    case 'profile':
      return {
        params,
        name: 'profile',
        profileName: decodeURIComponent(parts.slice(1).join('/') || '')
      };
    case 'about':
    default:
      return {name: 'about', params};
  }
}
