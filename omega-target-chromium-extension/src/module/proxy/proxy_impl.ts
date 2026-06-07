import OmegaTargetModule = require('omega-target');
import ProxyAuth = require('./proxy_auth');
import type {
  ExternalProxyDetails,
  ProxyChangeDetails,
  ProxyChangeWatcher,
  ProxyLog,
  ProxyProfile
} from './proxy_types';

const OmegaTarget = OmegaTargetModule;
const OmegaPac = OmegaTarget.OmegaPac;
const OmegaPromise = OmegaTarget.Promise;

class ProxyImpl {
  features: string[];
  log: ProxyLog;
  private _proxyAuth?: InstanceType<typeof ProxyAuth>;

  constructor(log: ProxyLog) {
    this.features = [];
    this.log = log;
  }

  static isSupported() {
    return false;
  }

  applyProfile(_profile: ProxyProfile, _meta?: ProxyProfile, _options?: unknown): Promise<unknown> {
    return OmegaPromise.reject();
  }

  watchProxyChange(_callback: ProxyChangeWatcher): void | null {
    return null;
  }

  parseExternalProfile(
    _details: ExternalProxyDetails | ProxyProfile | ProxyChangeDetails,
    _options?: unknown
  ): unknown {
    return null;
  }

  private _profileNotFound(name: string) {
    this.log.error(`Profile ${name} not found! Things may go very, very wrong.`);
    return OmegaPac.Profiles.create({
      name,
      profileType: 'VirtualProfile',
      defaultProfileName: 'direct'
    });
  }

  setProxyAuth(profile: ProxyProfile, options: unknown) {
    return OmegaPromise.try(() => {
      if (this._proxyAuth == null) {
        this._proxyAuth = new ProxyAuth(this.log);
      }
      this._proxyAuth.listen();
      const referencedProfiles: ProxyProfile[] = [];
      const refSet = OmegaPac.Profiles.allReferenceSet(profile, options, {
        profileNotFound: this._profileNotFound.bind(this)
      });
      for (const key of Object.keys(refSet)) {
        const name = refSet[key];
        const referencedProfile = OmegaPac.Profiles.byName(name, options);
        if (referencedProfile) {
          referencedProfiles.push(referencedProfile);
        }
      }
      return this._proxyAuth.setProxies(referencedProfiles);
    });
  }

  getProfilePacScript(profile: ProxyProfile, meta: ProxyProfile = profile, options: unknown) {
    let ast = OmegaPac.PacGenerator.script(options, profile, {
      profileNotFound: this._profileNotFound.bind(this)
    });
    ast = OmegaPac.PacGenerator.compress(ast);
    const script = OmegaPac.PacGenerator.ascii(ast.print_to_string());
    let profileName = OmegaPac.PacGenerator.ascii(JSON.stringify(meta.name));
    profileName = profileName.replace(/\*/g, '\\u002a');
    profileName = profileName.replace(/\\/g, '\\u002f');
    const prefix = `/*OmegaProfile*${profileName}*${meta.revision}*/`;
    return prefix + script;
  }
}

export = ProxyImpl;
