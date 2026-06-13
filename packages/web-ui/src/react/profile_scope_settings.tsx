import React, {useMemo, useState} from 'react';
import {Options, message} from './options_client';
import {cloneOptions} from './options_logic';
import {ProfileSelect, allProfilesFromOptions, profileOrder} from './profile_widgets';

export type ProfileScopeCapabilities = {
  container?: boolean;
  tab?: boolean;
  window?: boolean;
};

export type ProfileScopeContainerInfo = {
  color?: string;
  colorCode?: string;
  cookieStoreId: string;
  icon?: string;
  iconUrl?: string;
  name?: string;
};

export type ProfileScopeSettings = {
  container: boolean;
  tab: boolean;
  window: boolean;
};

type ProfileScopeAssignments = {
  containers: Record<string, string>;
  normalDefaultProfileName?: string;
  privateDefaultProfileName?: string;
};

type ProfileScopeContainerRow = ProfileScopeContainerInfo & {
  configured: boolean;
  deleted: boolean;
};

export const DEFAULT_PROFILE_SCOPE_CAPABILITIES: ProfileScopeCapabilities = {
  container: false,
  tab: false,
  window: false
};

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isFirefoxContainerId(value?: string): value is string {
  return typeof value === 'string' && /^firefox-container-\d+$/.test(value);
}

export function profileScopesForOptions(options?: Options | null): ProfileScopeSettings {
  const raw = options?.['-profileScopes'];
  const scopes = isRecordValue(raw) ? raw : {};
  return {
    tab: scopes.tab === true,
    container: scopes.container === true,
    window: scopes.window === true
  };
}

export function visibleProfileScopes(options?: Options | null, capabilities?: ProfileScopeCapabilities | null): ProfileScopeSettings {
  const scopes = profileScopesForOptions(options);
  const supported = capabilities || DEFAULT_PROFILE_SCOPE_CAPABILITIES;
  return {
    tab: scopes.tab && supported.tab === true,
    container: scopes.container && supported.container === true,
    window: scopes.window && supported.window === true
  };
}

export function hasVisibleProfileScopes(options?: Options | null, capabilities?: ProfileScopeCapabilities | null) {
  const visible = visibleProfileScopes(options, capabilities);
  return visible.tab || visible.container || visible.window;
}

function assignmentsForOptions(options?: Options | null): ProfileScopeAssignments {
  const raw = options?.['-profileScopeAssignments'];
  const assignments = isRecordValue(raw) ? raw : {};
  const containers = isRecordValue(assignments.containers) ? assignments.containers : {};
  const result: ProfileScopeAssignments = {
    containers: {}
  };
  for (const [cookieStoreId, profileName] of Object.entries(containers)) {
    if (isFirefoxContainerId(cookieStoreId) && typeof profileName === 'string') {
      result.containers[cookieStoreId] = profileName;
    }
  }
  if (typeof assignments.normalDefaultProfileName === 'string') {
    result.normalDefaultProfileName = assignments.normalDefaultProfileName;
  }
  if (typeof assignments.privateDefaultProfileName === 'string') {
    result.privateDefaultProfileName = assignments.privateDefaultProfileName;
  }
  return result;
}

function containerLabel(container: ProfileScopeContainerInfo) {
  if (container.name) {
    return container.name;
  }
  const match = container.cookieStoreId.match(/^firefox-container-(\d+)$/);
  return match
    ? message('options_profileScopeContainerName', `Container ${match[1]}`, match[1])
    : container.cookieStoreId;
}

function containerRows(
  containers: ProfileScopeContainerInfo[] = [],
  assignments: ProfileScopeAssignments,
  appliedAssignments: ProfileScopeAssignments,
  showDefaultContainers: boolean,
  showDeletedContainers: boolean
) {
  const rows: ProfileScopeContainerRow[] = [];
  const knownIds = new Set<string>();
  for (const container of containers) {
    if (isFirefoxContainerId(container.cookieStoreId)) {
      const configured = assignments.containers[container.cookieStoreId] != null;
      const appliedConfigured = appliedAssignments.containers[container.cookieStoreId] != null;
      knownIds.add(container.cookieStoreId);
      if (appliedConfigured || showDefaultContainers) {
        rows.push({
          ...container,
          configured,
          deleted: false
        });
      }
    }
  }
  const deletedIds = new Set([
    ...Object.keys(appliedAssignments.containers),
    ...Object.keys(assignments.containers)
  ]);
  for (const cookieStoreId of deletedIds) {
    if (isFirefoxContainerId(cookieStoreId) && !knownIds.has(cookieStoreId) && showDeletedContainers) {
      rows.push({
        configured: assignments.containers[cookieStoreId] != null,
        cookieStoreId,
        deleted: true
      });
    }
  }
  return rows;
}

function deletedContainerIds(containers: ProfileScopeContainerInfo[] = [], assignments: ProfileScopeAssignments) {
  const knownIds = new Set(containers.map((container) => container.cookieStoreId).filter(isFirefoxContainerId));
  return Object.keys(assignments.containers).filter((cookieStoreId) =>
    isFirefoxContainerId(cookieStoreId) && !knownIds.has(cookieStoreId)
  );
}

function cssUrl(value: string) {
  return `url("${value.replace(/["\\]/g, (match) => `\\${match}`)}")`;
}

function containerIconMaskStyle(container: ProfileScopeContainerInfo): React.CSSProperties {
  const iconUrl = container.iconUrl ? cssUrl(container.iconUrl) : '';
  return {
    backgroundColor: container.colorCode || undefined,
    mask: `${iconUrl} center / contain no-repeat`,
    WebkitMask: `${iconUrl} center / contain no-repeat`
  };
}

function ContainerIdentity({container}: {container: ProfileScopeContainerRow}) {
  const iconStyle = container.colorCode && !container.deleted ? {color: container.colorCode} : undefined;
  return (
    <span className="profile-scope-container-identity">
      {container.iconUrl && !container.deleted ? (
        <span
          className="profile-scope-container-icon profile-scope-container-icon-mask"
          style={containerIconMaskStyle(container)}
          aria-hidden="true"
        />
      ) : (
        <span className="profile-scope-container-icon profile-scope-container-icon-fallback" style={iconStyle}>
          <span className="glyphicon glyphicon-tag" aria-hidden="true" />
        </span>
      )}
      <span>{containerLabel(container)}</span>
      {container.deleted && (
        <span className="label label-default profile-scope-deleted-label">
          {message('options_profileScopeDeletedContainer', 'Deleted')}
        </span>
      )}
    </span>
  );
}

export function ProfileScopeSettingsPage({
  appliedOptions,
  capabilities = DEFAULT_PROFILE_SCOPE_CAPABILITIES,
  containers = [],
  onOptionsChange,
  onRefreshContainers,
  options,
  visibleScopes
}: {
  appliedOptions?: Options | null;
  capabilities?: ProfileScopeCapabilities;
  containers?: ProfileScopeContainerInfo[];
  onOptionsChange: (options: Options) => void;
  onRefreshContainers?: () => void;
  options: Options;
  visibleScopes?: ProfileScopeSettings;
}) {
  const [showDefaultContainers, setShowDefaultContainers] = useState(false);
  const [showDeletedContainers, setShowDeletedContainers] = useState(false);
  const visible = visibleScopes || visibleProfileScopes(options, capabilities);
  const assignments = assignmentsForOptions(options);
  const appliedAssignments = assignmentsForOptions(appliedOptions || options);
  const profiles = useMemo(() => allProfilesFromOptions(options).slice().sort(profileOrder), [options]);
  const rows = useMemo(
    () => containerRows(containers, assignments, appliedAssignments, showDefaultContainers, showDeletedContainers),
    [appliedAssignments, assignments, containers, showDefaultContainers, showDeletedContainers]
  );
  const removedContainerIds = useMemo(() => deletedContainerIds(containers, appliedAssignments), [appliedAssignments, containers]);
  const showRefreshButton = Boolean(onRefreshContainers && visible.container);
  const showDefaultContainerControl = visible.container && containers.some((container) =>
    isFirefoxContainerId(container.cookieStoreId) && appliedAssignments.containers[container.cookieStoreId] == null
  );

  function updateAssignments(updater: (nextAssignments: ProfileScopeAssignments) => void) {
    const nextOptions = cloneOptions(options);
    const nextAssignments = assignmentsForOptions(nextOptions);
    updater(nextAssignments);
    nextOptions['-profileScopeAssignments'] = nextAssignments;
    onOptionsChange(nextOptions);
  }

  function setWindowProfile(key: 'normalDefaultProfileName' | 'privateDefaultProfileName', profileName: string) {
    updateAssignments((nextAssignments) => {
      if (profileName) {
        nextAssignments[key] = profileName;
      } else {
        delete nextAssignments[key];
      }
    });
  }

  function setContainerProfile(cookieStoreId: string, profileName: string) {
    updateAssignments((nextAssignments) => {
      if (profileName) {
        nextAssignments.containers[cookieStoreId] = profileName;
      } else {
        delete nextAssignments.containers[cookieStoreId];
      }
    });
  }

  function removeDeletedContainers() {
    updateAssignments((nextAssignments) => {
      for (const cookieStoreId of removedContainerIds) {
        delete nextAssignments.containers[cookieStoreId];
      }
    });
    setShowDeletedContainers(false);
  }

  function containersEmptyMessage() {
    if (!showDefaultContainers && (containers.length > 0 || removedContainerIds.length > 0)) {
      return message('options_profileScopeConfiguredContainersEmpty', 'No configured containers.');
    }
    return message('options_profileScopeContainersEmpty', 'No known containers.');
  }

  return (
    <>
      <div className="page-header">
        <h2>{message('options_tab_profileScope', 'Profile Scope')}</h2>
      </div>

      {visible.window && (
        <section className="settings-group profile-scope-settings-group">
          <h3>{message('options_profileScopeWindowSection', 'Normal / Private')}</h3>
          <div className="form-group">
            <label>{message('options_profileScopeNormalWindow', 'Normal windows')}</label>{' '}
            <ProfileSelect
              defaultIcon="glyphicon-share-alt"
              defaultText={message('options_profileScopeUseDefault', 'Use Default')}
              inline
              name={assignments.normalDefaultProfileName || ''}
              onChange={(name) => setWindowProfile('normalDefaultProfileName', name)}
              profiles={profiles}
            />
          </div>
          <div className="form-group">
            <label>{message('options_profileScopePrivateWindow', 'Private windows')}</label>{' '}
            <ProfileSelect
              defaultIcon="glyphicon-share-alt"
              defaultText={message('options_profileScopeUseDefault', 'Use Default')}
              inline
              name={assignments.privateDefaultProfileName || ''}
              onChange={(name) => setWindowProfile('privateDefaultProfileName', name)}
              profiles={profiles}
            />
          </div>
        </section>
      )}

      {visible.container && (
        <section className="settings-group profile-scope-settings-group">
          <div className="profile-scope-section-heading">
            <h3>{message('options_profileScopeContainersSection', 'Containers')}</h3>
            {showRefreshButton && (
              <button className="btn btn-default btn-xs" type="button" onClick={onRefreshContainers}>
                <span className="glyphicon glyphicon-refresh" aria-hidden="true" />{' '}
                {message('options_profileScopeRefreshContainers', 'Refresh')}
              </button>
            )}
          </div>
          {(showDefaultContainerControl || removedContainerIds.length > 0) && (
            <div className="profile-scope-container-controls">
              {showDefaultContainerControl && (
                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={showDefaultContainers}
                    onChange={(event) => setShowDefaultContainers(event.currentTarget.checked)}
                  />{' '}
                  {message('options_profileScopeShowDefaultContainers', 'Show containers using default profile')}
                </label>
              )}
              {removedContainerIds.length > 0 && (
                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={showDeletedContainers}
                    onChange={(event) => setShowDeletedContainers(event.currentTarget.checked)}
                  />{' '}
                  {message('options_profileScopeShowDeletedContainers', 'Show deleted containers')}
                </label>
              )}
              {removedContainerIds.length > 0 && (
                <button className="btn btn-default btn-xs" type="button" onClick={removeDeletedContainers}>
                  <span className="glyphicon glyphicon-trash" aria-hidden="true" />{' '}
                  {message('options_profileScopeRemoveDeletedContainers', 'Remove deleted containers')}
                </button>
              )}
            </div>
          )}
          {rows.length ? (
            <table className="table table-striped profile-scope-table">
              <thead>
                <tr>
                  <th>{message('options_profileScopeContainerColumn', 'Container')}</th>
                  <th>{message('options_profileScopeProfileColumn', 'Profile')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((container) => (
                  <tr className={container.deleted ? 'profile-scope-container-deleted' : undefined} key={container.cookieStoreId}>
                    <td>
                      <ContainerIdentity container={container} />
                    </td>
                    <td>
                      <ProfileSelect
                        defaultIcon="glyphicon-share-alt"
                        defaultText={message('options_profileScopeUseDefault', 'Use Default')}
                        inline
                        name={assignments.containers[container.cookieStoreId] || ''}
                        onChange={(name) => setContainerProfile(container.cookieStoreId, name)}
                        profiles={profiles}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">{containersEmptyMessage()}</p>
          )}
        </section>
      )}

      {visible.tab && (
        <section className="settings-group profile-scope-settings-group">
          <h3>{message('options_profileScopeTabsSection', 'Tabs')}</h3>
          <p className="help-block">
            {message('options_profileScopeTabsHelp', 'Tab profile assignments are temporary and stay with their tabs.')}
          </p>
        </section>
      )}
    </>
  );
}
