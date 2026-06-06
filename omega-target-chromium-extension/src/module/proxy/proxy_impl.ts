const OmegaTarget = require('omega-target');
const OmegaPac = OmegaTarget.OmegaPac;
const OmegaPromise = OmegaTarget.Promise;
const ProxyAuth = require('./proxy_auth');

type Log = {
  error: (...args: unknown[]) => void;
};

type Profile = Record<string, unknown> & {
  defaultProfileName?: string;
  name?: string;
  profileType?: string;
  revision?: string;
};

class ProxyImpl {
  log: Log;
  private _proxyAuth?: InstanceType<typeof ProxyAuth>;

  constructor(log: Log) {
    this.log = log;
  }

  static isSupported() {
    return false;
  }

  applyProfile(_profile: Profile, _meta?: Profile) {
    return OmegaPromise.reject();
  }

  watchProxyChange(_callback: (details: unknown) => void) {
    return null;
  }

  parseExternalProfile(_details: unknown, _options: unknown) {
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

  setProxyAuth(profile: Profile, options: unknown) {
    return OmegaPromise.try(() => {
      if (this._proxyAuth == null) {
        this._proxyAuth = new ProxyAuth(this.log);
      }
      this._proxyAuth.listen();
      const referencedProfiles: Profile[] = [];
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

  getProfilePacScript(profile: Profile, meta: Profile = profile, options: unknown) {
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
