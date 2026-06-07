import {message} from './options_client';
import type {Profile as ProfileModel} from './profile_types';

export type Profile = ProfileModel & {
  defaultProfileName?: string;
  desc?: string;
  name: string;
  validResultProfiles?: string[];
};

export type PageInfo = {
  domain?: string;
  errorCount?: number;
  summary?: Record<string, {errorCount?: number}>;
  tempRuleProfileName?: string;
  url?: string;
};

export type PopupState = {
  availableProfiles?: Record<string, Profile>;
  currentProfileCanAddRule?: boolean;
  currentProfileName?: string;
  externalProfile?: Profile;
  isSystemProfile?: boolean;
  lastProfileNameForCondition?: string;
  proxyNotControllable?: string;
  refreshOnProfileChange?: boolean;
  showExternalProfile?: boolean;
  validResultProfiles?: string[];
};

export type PopupCondition = Record<string, unknown> | Array<Record<string, unknown>>;

export type PopupCallback<T = unknown> = (error?: unknown, result?: T) => void;

export type PopupTarget = {
  addCondition?: (
    condition: PopupCondition,
    profileName: string,
    addToBottom: boolean,
    callback?: PopupCallback
  ) => void;
  addProfile?: (profile: Profile, callback?: PopupCallback) => void;
  addTempRule?: (domain: string, profileName: string, callback?: PopupCallback) => void;
  applyProfile?: (name: string, callback?: PopupCallback) => void;
  getActivePageInfo?: (callback: PopupCallback<PageInfo>) => void;
  getMessage?: (key: string, substitutions?: string | string[]) => string;
  getState?: (keys: string[], callback: PopupCallback<PopupState>) => void;
  openManage?: {
    (callback?: PopupCallback): void;
    (domain?: string, profileName?: string, callback?: PopupCallback): void;
  };
  openOptions?: (hash?: string | null, callback?: PopupCallback) => void;
  setDefaultProfile?: (
    profileName: string,
    defaultProfileName: string,
    callback?: PopupCallback
  ) => void;
  setState?: (name: string, value: unknown, callback?: PopupCallback) => void;
};

declare global {
  interface Window {
    OmegaTargetPopup?: PopupTarget;
  }
}

export function closePopup() {
  window.close();
  document.body.style.opacity = '0';
  window.setTimeout(() => history.go(0), 300);
}

export function popupTarget() {
  return window.OmegaTargetPopup || {};
}

export function waitForPopupTarget() {
  if (window.OmegaTargetPopup) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries++;
      if (window.OmegaTargetPopup) {
        window.clearInterval(timer);
        resolve();
      } else if (tries > 100) {
        window.clearInterval(timer);
        reject(new Error('Popup target API is unavailable.'));
      }
    }, 20);
  });
}

export function callbackPromise<T>(
  invoke: (callback: PopupCallback<T>) => void
) {
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
      window.setTimeout(() => {
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

export function getPopupState(keys: string[]) {
  return callbackPromise<PopupState>((callback) => {
    const getState = popupTarget().getState;
    if (!getState) {
      callback(popupMethodUnavailable('getState'));
      return;
    }
    getState(keys, callback);
  });
}

export function getPopupPageInfo() {
  return callbackPromise<PageInfo | undefined>((callback) => {
    const getActivePageInfo = popupTarget().getActivePageInfo;
    if (!getActivePageInfo) {
      callback(popupMethodUnavailable('getActivePageInfo'));
      return;
    }
    getActivePageInfo(callback);
  });
}

export function popupMessage(key: string, fallback = key, substitutions?: string | string[]) {
  return popupTarget().getMessage?.(key, substitutions) || message(key, fallback, substitutions);
}
