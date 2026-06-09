export type ParsedUrlCompat = {
  hostname: string;
  href: string;
  port: string;
  protocol: string;
};

function rawBracketedHost(url: string) {
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(url);
  if (scheme == null) {
    return null;
  }
  const authorityStart = scheme[0].length;
  let authorityEnd = url.length;
  for (const separator of ['/', '?', '#']) {
    const index = url.indexOf(separator, authorityStart);
    if (index >= 0 && index < authorityEnd) {
      authorityEnd = index;
    }
  }
  const authority = url.slice(authorityStart, authorityEnd);
  const hostStart = authority.lastIndexOf('@') + 1;
  if (authority.charCodeAt(hostStart) !== '['.charCodeAt(0)) {
    return null;
  }
  const hostEnd = authority.indexOf(']', hostStart + 1);
  if (hostEnd < 0) {
    return null;
  }
  const hostname = authority.slice(hostStart + 1, hostEnd).toLowerCase();
  const host = '[' + hostname + ']' + authority.slice(hostEnd + 1);
  return {host, hostname};
}

export function parseUrlCompat(url: string): ParsedUrlCompat {
  const parsed = new URL(url);
  const rawHost = rawBracketedHost(url);
  return {
    hostname: rawHost != null ? rawHost.hostname : parsed.hostname,
    href: rawHost != null
      ? parsed.href.replace(/\/\/(?:[^/?#@]*@)?\[[^\]]+\](?::\d+)?/, (authority) => {
        const authEnd = authority.lastIndexOf('@');
        const auth = authEnd >= 0 ? authority.slice(0, authEnd + 1) : '//';
        return auth + rawHost.host;
      })
      : parsed.href,
    port: parsed.port,
    protocol: parsed.protocol
  };
}
