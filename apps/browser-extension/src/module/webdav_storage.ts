import ExtensionRuntime from '@switchyagain/extension-runtime';

type StorageItems = Record<string, unknown>;
type StorageKeys = string | string[] | StorageItems | null | undefined;
type StorageRemoveKeys = string | string[] | null | undefined;
type StorageChanges = Record<string, unknown | undefined>;
type WatchCallback = (changes: StorageChanges) => unknown;
type StopWatching = () => unknown;

type WebDavStorageObserver = {
  onPollError?: (error: unknown) => unknown;
  onPollSuccess?: () => unknown;
  onWriteSuccess?: () => unknown;
};

export type WebDavStorageConfig = {
  deviceId?: string;
  intervalMinutes?: number;
  password?: string;
  remotePath?: string;
  serverUrl: string;
  username?: string;
};

type WebDavEnvelope = {
  app?: string;
  deviceId?: string;
  formatVersion?: number;
  items?: StorageItems;
  updatedAt?: string;
};

type RemoteSnapshot = {
  etag?: string;
  exists: boolean;
  items: StorageItems;
  lastModified?: string;
};

type RemoteMetadata = Omit<RemoteSnapshot, 'items'>;

const DEFAULT_REMOTE_PATH = 'SwitchyAgain/options-sync.json';
const DEFAULT_INTERVAL_MINUTES = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedIntervalMinutes(value: unknown) {
  const interval = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_INTERVAL_MINUTES;
  return Math.max(0, Math.floor(interval));
}

function normalizeRemotePath(path?: string) {
  return (path || DEFAULT_REMOTE_PATH).replace(/^\/+/, '') || DEFAULT_REMOTE_PATH;
}

function ensureCollectionUrl(url: string) {
  return url.endsWith('/') ? url : `${url}/`;
}

function headerValue(headers: Headers, name: string) {
  return headers.get(name) || undefined;
}

function basicAuthHeader(username?: string, password?: string) {
  if (!username && !password) {
    return undefined;
  }
  const value = `${username || ''}:${password || ''}`;
  if (typeof btoa === 'function') {
    return `Basic ${btoa(value)}`;
  }
  return undefined;
}

function statusError(response: Response, method: string, url: string) {
  const err = new Error(`WebDAV ${method} ${url} failed with ${response.status} ${response.statusText}`) as Error & {
    statusCode?: number;
  };
  err.statusCode = response.status;
  return err;
}

class WebDavStorage extends ExtensionRuntime.Storage {
  config: Required<Pick<WebDavStorageConfig, 'remotePath'>> & WebDavStorageConfig;
  lastEtag?: string;
  lastModified?: string;
  lastItems: StorageItems | null = null;
  observer?: WebDavStorageObserver;
  watchCallback?: WatchCallback;

  constructor(config: WebDavStorageConfig, observer?: WebDavStorageObserver) {
    super();
    this.observer = observer;
    this.config = {
      ...config,
      intervalMinutes: normalizedIntervalMinutes(config.intervalMinutes),
      remotePath: normalizeRemotePath(config.remotePath)
    };
  }

  fileUrl() {
    return new URL(this.config.remotePath, ensureCollectionUrl(this.config.serverUrl)).href;
  }

  parentCollectionUrls() {
    const base = ensureCollectionUrl(this.config.serverUrl);
    const parts = this.config.remotePath.split('/').filter(Boolean);
    parts.pop();
    const urls: string[] = [];
    let current = base;
    for (const part of parts) {
      current = new URL(`${encodeURIComponent(part)}/`, current).href;
      urls.push(current);
    }
    return urls;
  }

  request(method: string, url: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers || {});
    const auth = basicAuthHeader(this.config.username, this.config.password);
    if (auth && !headers.has('Authorization')) {
      headers.set('Authorization', auth);
    }
    return fetch(url, {
      ...init,
      cache: 'no-store',
      headers,
      method
    }).catch((error: Error) => {
      throw new ExtensionRuntime.NetworkError(error);
    });
  }

  async ensureParentCollections() {
    for (const url of this.parentCollectionUrls()) {
      const response = await this.request('MKCOL', url);
      if (response.ok || response.status === 405) {
        continue;
      }
      throw statusError(response, 'MKCOL', url);
    }
  }

  async readRemote(allowMissing = true): Promise<RemoteSnapshot> {
    const url = this.fileUrl();
    const response = await this.request('GET', url, {
      headers: {
        Accept: 'application/json'
      }
    });
    if (response.status === 404 && allowMissing) {
      this.lastEtag = undefined;
      this.lastModified = undefined;
      this.lastItems = {};
      return {
        exists: false,
        items: {}
      };
    }
    if (!response.ok) {
      throw statusError(response, 'GET', url);
    }
    const text = await response.text();
    let parsed: unknown = {};
    if (text.trim()) {
      parsed = JSON.parse(text) as WebDavEnvelope | StorageItems;
    }
    const envelope = parsed as WebDavEnvelope;
    const items = isRecord(envelope.items) ? envelope.items : isRecord(parsed) ? (parsed as StorageItems) : {};
    this.lastEtag = headerValue(response.headers, 'etag');
    this.lastModified = headerValue(response.headers, 'last-modified');
    this.lastItems = {...items};
    return {
      etag: this.lastEtag,
      exists: true,
      items: {...items},
      lastModified: this.lastModified
    };
  }

  async readMetadata(): Promise<RemoteMetadata | null> {
    const url = this.fileUrl();
    const response = await this.request('HEAD', url);
    if (response.status === 404) {
      return {
        exists: false
      };
    }
    if (response.status === 405 || response.status === 501) {
      return null;
    }
    if (!response.ok) {
      throw statusError(response, 'HEAD', url);
    }
    return {
      etag: headerValue(response.headers, 'etag'),
      exists: true,
      lastModified: headerValue(response.headers, 'last-modified')
    };
  }

  async writeRemote(items: StorageItems, expectedEtag?: string) {
    await this.ensureParentCollections();
    const url = this.fileUrl();
    const headers = new Headers({
      'Content-Type': 'application/json;charset=utf-8'
    });
    if (expectedEtag) {
      headers.set('If-Match', expectedEtag);
    }
    const envelope: WebDavEnvelope = {
      app: 'SwitchyAgain',
      deviceId: this.config.deviceId,
      formatVersion: 1,
      items,
      updatedAt: new Date().toISOString()
    };
    const response = await this.request('PUT', url, {
      body: JSON.stringify(envelope, null, 2),
      headers
    });
    if (!response.ok) {
      throw statusError(response, 'PUT', url);
    }
    this.lastEtag = headerValue(response.headers, 'etag');
    this.lastModified = headerValue(response.headers, 'last-modified');
    this.lastItems = {...items};
    this.observer?.onWriteSuccess?.();
    return items;
  }

  async remoteExists() {
    const snapshot = await this.readRemote(true);
    return snapshot.exists;
  }

  get(keys: StorageKeys = null) {
    return this.readRemote(true).then((snapshot) => {
      if (keys == null) {
        return snapshot.items;
      }
      const result: StorageItems = {};
      if (typeof keys === 'string') {
        if (typeof snapshot.items[keys] !== 'undefined') {
          result[keys] = snapshot.items[keys];
        }
      } else if (Array.isArray(keys)) {
        for (const key of keys) {
          if (typeof snapshot.items[key] !== 'undefined') {
            result[key] = snapshot.items[key];
          }
        }
      } else {
        for (const key of Object.keys(keys)) {
          result[key] = typeof snapshot.items[key] !== 'undefined' ? snapshot.items[key] : keys[key];
          if (typeof result[key] === 'undefined') {
            delete result[key];
          }
        }
      }
      return result;
    });
  }

  set(items: StorageItems) {
    if (Object.keys(items).length === 0) {
      return Promise.resolve({});
    }
    return this.readRemote(true).then((snapshot) => {
      return this.writeRemote(
        {
          ...snapshot.items,
          ...items
        },
        snapshot.etag
      );
    });
  }

  remove(keys?: StorageRemoveKeys) {
    if (keys == null) {
      const url = this.fileUrl();
      return this.request('DELETE', url).then((response) => {
        if (!response.ok && response.status !== 404) {
          throw statusError(response, 'DELETE', url);
        }
        this.lastEtag = undefined;
        this.lastModified = undefined;
        this.lastItems = {};
      });
    }
    return this.readRemote(true).then((snapshot) => {
      const nextItems = {...snapshot.items};
      const removeKeys = Array.isArray(keys) ? keys : [keys];
      for (const key of removeKeys) {
        delete nextItems[key];
      }
      return this.writeRemote(nextItems, snapshot.etag).then(() => undefined);
    });
  }

  async poll(callback: WatchCallback) {
    const previousEtag = this.lastEtag;
    const previousLastModified = this.lastModified;
    const previousItems = this.lastItems ? {...this.lastItems} : null;
    const metadata = await this.readMetadata();
    if (
      metadata?.exists &&
      previousItems != null &&
      (metadata.etag || metadata.lastModified) &&
      previousEtag === metadata.etag &&
      previousLastModified === metadata.lastModified
    ) {
      return;
    }
    const snapshot = await this.readRemote(true);
    const changed =
      previousItems != null &&
      (previousEtag !== snapshot.etag ||
        previousLastModified !== snapshot.lastModified ||
        JSON.stringify(previousItems) !== JSON.stringify(snapshot.items));
    if (!changed) {
      return;
    }
    const changes: StorageChanges = {};
    for (const key of Object.keys(snapshot.items)) {
      if (previousItems?.[key] !== snapshot.items[key]) {
        changes[key] = snapshot.items[key];
      }
    }
    for (const key of Object.keys(previousItems || {})) {
      if (!(key in snapshot.items)) {
        changes[key] = undefined;
      }
    }
    if (Object.keys(changes).length > 0) {
      callback(changes);
    }
  }

  watch(_keys: StorageRemoveKeys, callback: WatchCallback): StopWatching {
    let stopped = false;
    this.watchCallback = callback;
    this.readRemote(true).then(
      () => {
        if (!stopped) {
          this.observer?.onPollSuccess?.();
        }
      },
      (error: unknown) => {
        if (!stopped) {
          this.observer?.onPollError?.(error);
        }
      }
    );
    return () => {
      stopped = true;
      if (this.watchCallback === callback) {
        this.watchCallback = undefined;
      }
    };
  }
}

export default WebDavStorage;
