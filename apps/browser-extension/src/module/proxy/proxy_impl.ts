import ExtensionRuntime from '@switchyagain/extension-runtime';
import ProxyAuth from './proxy_auth';
import {profileWithProxyExceptions} from '../proxy_exceptions';
import type {
  ExternalProxyDetails,
  ProxyChangeDetails,
  ProxyChangeWatcher,
  ProxyAuthCapabilities,
  ProxyDnsCapabilities,
  ProxyLog,
  ProxyProfile
} from './proxy_types';

const ProxyEngine = ExtensionRuntime.ProxyEngine;
const RuntimePromise = ExtensionRuntime.Promise;

class ProxyImpl {
  features: string[];
  log: ProxyLog;
  proxyAuthCapabilities: ProxyAuthCapabilities;
  proxyDnsCapabilities: ProxyDnsCapabilities;
  private _proxyAuth?: InstanceType<typeof ProxyAuth>;

  constructor(log: ProxyLog) {
    this.features = [];
    this.proxyAuthCapabilities = {
      http: true,
      https: true,
      socks4: false,
      socks5: false
    };
    this.proxyDnsCapabilities = {
      socks5: false
    };
    this.log = log;
  }

  static isSupported() {
    return false;
  }

  applyProfile(_profile: ProxyProfile, _meta?: ProxyProfile, _options?: unknown): Promise<unknown> {
    return RuntimePromise.reject();
  }

  watchProxyChange(_callback: ProxyChangeWatcher): void | null {
    return null;
  }

  parseExternalProfile(_details: ExternalProxyDetails | ProxyProfile | ProxyChangeDetails, _options?: unknown): unknown {
    return null;
  }

  private _profileNotFound(name: string) {
    this.log.error(`Profile ${name} not found! Things may go very, very wrong.`);
    return ProxyEngine.Profiles.create({
      name,
      profileType: 'VirtualProfile',
      defaultProfileName: 'direct'
    });
  }

  setProxyAuth(profile: ProxyProfile, options: unknown, extraProfileNames: string[] = []) {
    return RuntimePromise.resolve().then(() => {
      if (this._proxyAuth == null) {
        this._proxyAuth = new ProxyAuth(this.log);
      }
      this._proxyAuth.listen();
      const referencedProfiles: ProxyProfile[] = [];
      const addReferencedProfiles = (rootProfile?: ProxyProfile) => {
        if (!rootProfile) {
          return;
        }
        const refSet = ProxyEngine.Profiles.allReferenceSet(rootProfile, options, {
          profileNotFound: this._profileNotFound.bind(this)
        });
        for (const key of Object.keys(refSet)) {
          const name = refSet[key];
          const referencedProfile = ProxyEngine.Profiles.byName(name, options);
          if (referencedProfile && referencedProfiles.indexOf(referencedProfile) < 0) {
            referencedProfiles.push(referencedProfile);
          }
        }
      };
      addReferencedProfiles(profile);
      for (const profileName of extraProfileNames) {
        addReferencedProfiles(ProxyEngine.Profiles.byName(profileName, options));
      }
      return this._proxyAuth.setProxies(referencedProfiles);
    });
  }

  getProfilePacScript(profile: ProxyProfile, meta: ProxyProfile = profile, options: unknown) {
    let ast = ProxyEngine.PacGenerator.script(options, profile, {
      profileNotFound: this._profileNotFound.bind(this)
    });
    ast = ProxyEngine.PacGenerator.compress(ast);
    const script = ProxyEngine.PacGenerator.ascii(ast.print_to_string());
    let profileName = ProxyEngine.PacGenerator.ascii(JSON.stringify(meta.name));
    profileName = profileName.replace(/\*/g, '\\u002a');
    profileName = profileName.replace(/\\/g, '\\u002f');
    const prefix = `/*OmegaProfile*${profileName}*${meta.revision}*/`;
    return prefix + script;
  }

  withProxyExceptions(profile: ProxyProfile, options?: unknown) {
    return profileWithProxyExceptions(profile, options);
  }
}

export default ProxyImpl;
