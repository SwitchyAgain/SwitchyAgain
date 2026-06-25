import {message} from './i18n_client';
import type {RequestExplanation} from './options_client_types';
import type {NamedProfile, ProfileKey} from './profile_types';
import {closeWindow, getGlobalValue, reloadHistory, setBodyOpacity} from './browser_env';

export type {ProfileKey};

export type Profile = NamedProfile & {
  attachedToProfileName?: string;
  defaultProfileName?: string;
  desc?: string;
  hiddenInContextMenu?: boolean;
  hiddenInPopup?: boolean;
  role?: string;
  validResultProfiles?: string[];
};

export type ProfileMap = Record<ProfileKey, Profile | undefined>;

export type PageInfo = {
  domain?: string;
  errorCount?: number;
  profileScope?: ProfileScopeInfo;
  requestExplanations?: RequestExplanation[];
  requestLimitExceeded?: boolean;
  requests?: Array<{
    error?: string;
    id: string;
    status?: string;
    type?: string;
    url: string;
  }>;
  summary?: Record<string, {errorCount?: number}>;
  tempRuleProfileName?: string;
  url?: string;
};

export type ProfileScopeInfo = {
  assignments?: {
    containers?: Record<string, string>;
    normalDefaultProfileName?: string;
    privateDefaultProfileName?: string;
  };
  capabilities?: ProfileScopeSettings;
  containerProfileName?: string;
  cookieStoreId?: string;
  effectiveProfileName?: string;
  effectiveScope?: 'container' | 'current' | 'group' | 'normal' | 'private' | 'tab';
  enabled?: ProfileScopeSettings;
  groupId?: number;
  groupProfileName?: string;
  incognito?: boolean;
  isContainer?: boolean;
  tabId?: number;
  tabProfileName?: string;
  windowId?: number;
  windowProfileName?: string;
};

export type ProfileScopeSettings = {
  container?: boolean;
  group?: boolean;
  tab?: boolean;
  window?: boolean;
};

export type ProfileScopeSetRequest = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  profileName?: string;
  scope: 'container' | 'group' | 'normal' | 'private' | 'tab';
  tabId?: number;
  windowId?: number;
};

export type PageInfoOptions = {
  includeExplanations?: boolean;
};

export type PopupState = {
  availableProfiles?: ProfileMap;
  currentProfileCanAddRule?: boolean;
  currentProfileName?: string;
  externalProfile?: Profile;
  isSystemProfile?: boolean;
  lastProfileNameForCondition?: string;
  proxyNotControllable?: string;
  refreshOnProfileChange?: boolean;
  scopeAssignableProfiles?: string[];
  showExternalProfile?: boolean;
  showPopupAddCondition?: boolean;
  showPopupAddTempRule?: boolean;
  uiLocale?: string;
  uiTheme?: string;
  validResultProfiles?: string[];
};

export type PopupStateKey = keyof PopupState;
export type PopupWritableStateKey = 'lastProfileNameForCondition';
export type PopupMode = 'condition' | 'external' | 'menu' | 'routeInfo';

export type PopupConditionType =
  | 'HostRegexCondition'
  | 'HostWildcardCondition'
  | 'KeywordCondition'
  | 'UrlRegexCondition'
  | 'UrlWildcardCondition';

export type PopupCondition = {
  conditionType: PopupConditionType;
  pattern: string;
};

export type PopupConditionInput = PopupCondition | PopupCondition[];

export type PopupCallback<T = unknown> = (error?: unknown, result?: T) => void;
export type PopupVoidCallback = PopupCallback<void>;

export type PopupTarget = {
  addCondition?: (condition: PopupConditionInput, profileName: string, addToBottom: boolean, callback?: PopupVoidCallback) => void;
  addProfile?: (profile: Profile, callback?: PopupVoidCallback) => void;
  addTempRule?: (domain: string, profileName: string, callback?: PopupVoidCallback) => void;
  applyProfile?: (name: string, callback?: PopupVoidCallback) => void;
  getActivePageInfo?: {
    (callback: PopupCallback<PageInfo>): void;
    (options: PageInfoOptions, callback: PopupCallback<PageInfo>): void;
  };
  getMessage?: (key: string, substitutions?: string | string[]) => string;
  getState?: (keys: PopupStateKey[], callback: PopupCallback<PopupState>) => void;
  openManage?: {
    (callback?: PopupVoidCallback): void;
    (domain?: string, profileName?: string, callback?: PopupVoidCallback): void;
  };
  openOptions?: (hash?: string | null, callback?: PopupVoidCallback) => void;
  setDefaultProfile?: (profileName: string, defaultProfileName: string, callback?: PopupVoidCallback) => void;
  setProfileScope?: (args: ProfileScopeSetRequest, callback?: PopupVoidCallback) => void;
  setState?: <TKey extends PopupWritableStateKey>(name: TKey, value: PopupState[TKey], callback?: PopupCallback) => void;
};

export function closePopup() {
  closeWindow();
  setBodyOpacity('0');
  setTimeout(() => reloadHistory(), 300);
}

export function popupTarget() {
  return getGlobalValue<PopupTarget>('OmegaTargetPopup') || {};
}

export function waitForPopupTarget() {
  if (getGlobalValue<PopupTarget>('OmegaTargetPopup')) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (getGlobalValue<PopupTarget>('OmegaTargetPopup')) {
        clearInterval(timer);
        resolve();
      } else if (tries > 100) {
        clearInterval(timer);
        reject(new Error('Popup target API is unavailable.'));
      }
    }, 20);
  });
}

export function callbackPromise<T>(invoke: (callback: PopupCallback<T>) => void) {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const callback = (error?: unknown, value?: T) => {
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve(value as T);
      }
    };
    invoke(callback);
    if (!settled) {
      setTimeout(() => {
        if (!settled) {
          reject(new Error('Popup target method did not respond.'));
        }
      }, 15000);
    }
  });
}

function popupMethodUnavailable(methodName: keyof PopupTarget) {
  return new Error(`Popup target method unavailable: ${methodName}.`);
}

export function getPopupState(keys: PopupStateKey[]) {
  return callbackPromise<PopupState>((callback) => {
    const getState = popupTarget().getState;
    if (!getState) {
      callback(popupMethodUnavailable('getState'));
      return;
    }
    getState(keys, callback);
  });
}

export function getPopupPageInfo(options?: PageInfoOptions) {
  return callbackPromise<PageInfo | undefined>((callback) => {
    const getActivePageInfo = popupTarget().getActivePageInfo;
    if (!getActivePageInfo) {
      callback(popupMethodUnavailable('getActivePageInfo'));
      return;
    }
    if (options) {
      getActivePageInfo(options, callback);
    } else {
      getActivePageInfo(callback);
    }
  });
}

export function popupMessage(key: string, fallback = key, substitutions?: string | string[]) {
  return message(key, '', substitutions) || popupTarget().getMessage?.(key, substitutions) || fallback;
}
