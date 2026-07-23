import React, {useMemo, useState} from 'react';
import {message} from './i18n_client';
import type {Options} from './options_client_types';
import {cloneOptions} from './options_logic';
import {ProfileSelect, profileOrder, scopeAssignableProfilesForOptions} from './profile_widgets';
import {conditionTypesForMode} from './switch_profile_runtime';
import type {ConditionTypeOption, SwitchRuleCondition, SwitchRuleEditableConditionType} from './switch_profile_runtime';

export type ProfileScopeCapabilities = {
  container?: boolean;
  group?: boolean;
  site?: boolean;
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
  group: boolean;
  site: boolean;
  tab: boolean;
  window: boolean;
};

type ProfileScopeAssignments = {
  containers: Record<string, string>;
  normalDefaultProfileName?: string;
  privateDefaultProfileName?: string;
  rules: ProfileScopeRule[];
};

type ProfileScopeRule = {
  condition: SwitchRuleCondition;
  profileName: string;
  quickKey?: string;
  quickTarget?: 'page' | 'site';
  [key: string]: unknown;
};

type ProfileScopeContainerRow = ProfileScopeContainerInfo & {
  configured: boolean;
  deleted: boolean;
};

export const DEFAULT_PROFILE_SCOPE_CAPABILITIES: ProfileScopeCapabilities = {
  container: false,
  group: false,
  site: false,
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
    group: scopes.group === true,
    container: scopes.container === true,
    site: scopes.site === true,
    window: scopes.window === true
  };
}

export function visibleProfileScopes(options?: Options | null, capabilities?: ProfileScopeCapabilities | null): ProfileScopeSettings {
  const scopes = profileScopesForOptions(options);
  const supported = capabilities || DEFAULT_PROFILE_SCOPE_CAPABILITIES;
  return {
    tab: scopes.tab && supported.tab === true,
    group: scopes.group && supported.group === true,
    container: scopes.container && supported.container === true,
    site: scopes.site && supported.site === true,
    window: scopes.window && supported.window === true
  };
}

export function hasVisibleProfileScopes(options?: Options | null, capabilities?: ProfileScopeCapabilities | null) {
  const visible = visibleProfileScopes(options, capabilities);
  return visible.tab || visible.group || visible.container || visible.site || visible.window;
}

function assignmentsForOptions(options?: Options | null): ProfileScopeAssignments {
  const raw = options?.['-profileScopeAssignments'];
  const assignments = isRecordValue(raw) ? raw : {};
  const containers = isRecordValue(assignments.containers) ? assignments.containers : {};
  const result: ProfileScopeAssignments = {
    containers: {},
    rules: []
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
  if (Array.isArray(assignments.rules)) {
    for (const rawRule of assignments.rules) {
      if (!isRecordValue(rawRule) || !isRecordValue(rawRule.condition)) {
        continue;
      }
      if (typeof rawRule.condition.conditionType !== 'string' || typeof rawRule.profileName !== 'string' || !rawRule.profileName) {
        continue;
      }
      const rule: ProfileScopeRule = {
        ...rawRule,
        condition: {...rawRule.condition} as SwitchRuleCondition,
        profileName: rawRule.profileName
      };
      if (rawRule.quickTarget !== 'page' && rawRule.quickTarget !== 'site') {
        delete rule.quickTarget;
        delete rule.quickKey;
      } else if (typeof rawRule.quickKey !== 'string' || !rawRule.quickKey) {
        delete rule.quickTarget;
        delete rule.quickKey;
      }
      result.rules.push(rule);
    }
  }
  return result;
}

function containerLabel(container: ProfileScopeContainerInfo) {
  if (container.name) {
    return container.name;
  }
  const match = container.cookieStoreId.match(/^firefox-container-(\d+)$/);
  return match ? message('options_profileScopeContainerName', `Container ${match[1]}`, match[1]) : container.cookieStoreId;
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
  const deletedIds = new Set([...Object.keys(appliedAssignments.containers), ...Object.keys(assignments.containers)]);
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
  return Object.keys(assignments.containers).filter((cookieStoreId) => isFirefoxContainerId(cookieStoreId) && !knownIds.has(cookieStoreId));
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

function profileScopeConditionTypes(rules: ProfileScopeRule[], showConditionTypes: number) {
  const options = conditionTypesForMode(showConditionTypes);
  const known = new Set(options.map((option) => option.type));
  for (const rule of rules) {
    const type = rule.condition.conditionType;
    if (typeof type === 'string' && type && !known.has(type as SwitchRuleEditableConditionType)) {
      options.push({
        group: 'condition_group_special',
        type: type as SwitchRuleEditableConditionType
      });
      known.add(type as SwitchRuleEditableConditionType);
    }
  }
  return options;
}

function groupedConditionTypes(options: ConditionTypeOption[]) {
  const groups: Array<{group: ConditionTypeOption['group']; types: ConditionTypeOption[]}> = [];
  for (const option of options) {
    let group = groups.find((candidate) => candidate.group === option.group);
    if (!group) {
      group = {group: option.group, types: []};
      groups.push(group);
    }
    group.types.push(option);
  }
  return groups;
}

function conditionScopeLabel(condition: SwitchRuleCondition) {
  return condition.conditionType === 'UrlRegexCondition' || condition.conditionType === 'UrlWildcardCondition'
    ? message('options_profileScopeRulePage', 'Page')
    : message('options_profileScopeRuleSite', 'Site');
}

function conditionIpValue(condition: SwitchRuleCondition) {
  if (!condition.ip) {
    return '';
  }
  try {
    return ProxyEngine.Conditions.str(condition as never).split(' ', 2)[1] || '';
  } catch (_error) {
    return String(condition.ip);
  }
}

function weekdayList(condition: SwitchRuleCondition) {
  try {
    return ProxyEngine.Conditions.getWeekdayList(condition as never) || [];
  } catch (_error) {
    return [];
  }
}

function ProfileScopeConditionDetails({
  condition,
  onChange,
  onIpChange,
  onWeekdayChange
}: {
  condition: SwitchRuleCondition;
  onChange: (field: 'endHour' | 'maxValue' | 'minValue' | 'pattern' | 'startHour', value: string) => void;
  onIpChange: (value: string) => void;
  onWeekdayChange: (dayIndex: number, selected: boolean) => void;
}) {
  switch (condition.conditionType) {
    case 'FalseCondition':
      return <span className="text-muted">{message('condition_details_FalseCondition', '(Condition ignored when matching)')}</span>;
    case 'HostLevelsCondition':
      return (
        <span className="host-levels-details">
          <input
            className="form-control"
            type="number"
            min={1}
            max={99}
            value={String(condition.minValue ?? '')}
            onChange={(event) => onChange('minValue', event.currentTarget.value)}
          />{' '}
          <span>{message('options_hostLevelsBetween', '≤ host levels ≤')}</span>{' '}
          <input
            className="form-control"
            type="number"
            min={1}
            max={99}
            value={String(condition.maxValue ?? '')}
            onChange={(event) => onChange('maxValue', event.currentTarget.value)}
          />
        </span>
      );
    case 'IpCondition':
      return (
        <input
          className="form-control"
          type="text"
          placeholder="127.0.0.1/8"
          value={conditionIpValue(condition)}
          onChange={(event) => onIpChange(event.currentTarget.value)}
        />
      );
    case 'TimeCondition':
      return (
        <span className="host-levels-details">
          <input
            className="form-control"
            type="number"
            min={0}
            max={23}
            value={String(condition.startHour ?? '')}
            onChange={(event) => onChange('startHour', event.currentTarget.value)}
          />{' '}
          <span>{message('options_hourBetween', '≤ current hour ≤')}</span>{' '}
          <input
            className="form-control"
            type="number"
            min={0}
            max={23}
            value={String(condition.endHour ?? '')}
            onChange={(event) => onChange('endHour', event.currentTarget.value)}
          />
        </span>
      );
    case 'WeekdayCondition':
      return (
        <span>
          {weekdayList(condition).map((selected, dayIndex) => (
            <label className="checkbox-inline" key={dayIndex}>
              <input type="checkbox" checked={!!selected} onChange={(event) => onWeekdayChange(dayIndex, event.currentTarget.checked)} />{' '}
              {message(`options_weekDayShort_${dayIndex}`, String(dayIndex))}
            </label>
          ))}
        </span>
      );
    default:
      return (
        <input
          className="form-control"
          type="text"
          value={condition.pattern || ''}
          onChange={(event) => onChange('pattern', event.currentTarget.value)}
        />
      );
  }
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
  const profiles = useMemo(() => scopeAssignableProfilesForOptions(options).slice().sort(profileOrder), [options]);
  const conditionTypeGroups = useMemo(
    () => groupedConditionTypes(profileScopeConditionTypes(assignments.rules, Number(options['-showConditionTypes']) || 0)),
    [assignments.rules, options]
  );
  const rows = useMemo(
    () => containerRows(containers, assignments, appliedAssignments, showDefaultContainers, showDeletedContainers),
    [appliedAssignments, assignments, containers, showDefaultContainers, showDeletedContainers]
  );
  const removedContainerIds = useMemo(() => deletedContainerIds(containers, appliedAssignments), [appliedAssignments, containers]);
  const showRefreshButton = Boolean(onRefreshContainers && visible.container);
  const showDefaultContainerControl =
    visible.container &&
    containers.some(
      (container) => isFirefoxContainerId(container.cookieStoreId) && appliedAssignments.containers[container.cookieStoreId] == null
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

  function editRule(index: number, updater: (rule: ProfileScopeRule) => void) {
    updateAssignments((nextAssignments) => {
      const rule = nextAssignments.rules[index];
      if (!rule) {
        return;
      }
      updater(rule);
      delete rule.quickKey;
      delete rule.quickTarget;
    });
  }

  function addRule() {
    const profileName = profiles[0]?.name;
    if (!profileName) {
      return;
    }
    updateAssignments((nextAssignments) => {
      nextAssignments.rules.unshift({
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: ''
        },
        profileName
      });
    });
  }

  function cloneRule(index: number) {
    updateAssignments((nextAssignments) => {
      const source = nextAssignments.rules[index];
      if (!source) {
        return;
      }
      const clone: ProfileScopeRule = {
        ...source,
        condition: {...source.condition}
      };
      delete clone.quickKey;
      delete clone.quickTarget;
      nextAssignments.rules.splice(index + 1, 0, clone);
    });
  }

  function removeRule(index: number) {
    updateAssignments((nextAssignments) => {
      nextAssignments.rules.splice(index, 1);
    });
  }

  function moveRule(index: number, offset: -1 | 1) {
    updateAssignments((nextAssignments) => {
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= nextAssignments.rules.length) {
        return;
      }
      const [rule] = nextAssignments.rules.splice(index, 1);
      nextAssignments.rules.splice(nextIndex, 0, rule);
    });
  }

  function updateRuleField(index: number, field: 'endHour' | 'maxValue' | 'minValue' | 'pattern' | 'startHour', value: string) {
    editRule(index, (rule) => {
      if (field === 'pattern') {
        rule.condition.pattern = value;
      } else {
        rule.condition[field] = value === '' ? null : Number(value);
      }
    });
  }

  function updateRuleIp(index: number, value: string) {
    editRule(index, (rule) => {
      rule.condition = value
        ? (ProxyEngine.Conditions.fromStr(`Ip: ${value}`) as unknown as SwitchRuleCondition)
        : {
            conditionType: 'IpCondition',
            ip: '0.0.0.0',
            prefixLength: 0
          };
    });
  }

  function updateRuleWeekday(index: number, dayIndex: number, selected: boolean) {
    editRule(index, (rule) => {
      rule.condition.days || (rule.condition.days = '-------');
      const char = selected ? 'SMTWtFs'[dayIndex] : '-';
      rule.condition.days = rule.condition.days.slice(0, dayIndex) + char + rule.condition.days.slice(dayIndex + 1);
      delete rule.condition.startDay;
      delete rule.condition.endDay;
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

      {visible.site && (
        <section className="settings-group profile-scope-settings-group">
          <div className="settings-section-heading">
            <h3>{message('options_profileScopeSitesSection', 'Pages / Sites')}</h3>
            <button className="btn btn-default btn-xs" type="button" onClick={addRule} disabled={!profiles.length}>
              <span className="glyphicon glyphicon-plus" aria-hidden="true" /> {message('options_profileScopeAddRule', 'Add Rule')}
            </button>
          </div>
          <p className="help-block">
            {message(
              'options_profileScopeSitesHelp',
              'The first matching rule sets the starting profile for every request in the current tab. URL conditions are page rules; host and other conditions are site rules.'
            )}
            <br />
            {message(
              'options_profileScopeQuickRulesHelp',
              'This Page uses scheme, host, port, exact path, and the full query; URL fragments are ignored. This Site uses the existing host wildcard semantics.'
            )}
          </p>
          {assignments.rules.length ? (
            <table className="table table-striped profile-scope-table profile-scope-rules-table">
              <thead>
                <tr>
                  <th>{message('options_profileScopeRuleOrderColumn', 'Order')}</th>
                  <th>{message('options_conditionType', 'Condition Type')}</th>
                  <th>{message('options_conditionDetails', 'Condition Details')}</th>
                  <th>{message('options_profileScopeProfileColumn', 'Profile')}</th>
                  <th>{message('options_profileScopeRuleActionsColumn', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {assignments.rules.map((rule, index) => (
                  <tr key={`${index}:${rule.quickTarget || ''}:${rule.quickKey || ''}`}>
                    <td>
                      <span>{index + 1}</span> <span className="label label-default">{conditionScopeLabel(rule.condition)}</span>
                    </td>
                    <td>
                      <select
                        className="form-control"
                        value={rule.condition.conditionType || ''}
                        onChange={(event) =>
                          editRule(index, (nextRule) => {
                            nextRule.condition.conditionType = event.currentTarget.value as SwitchRuleEditableConditionType;
                          })
                        }
                      >
                        {conditionTypeGroups.map((group) => (
                          <optgroup key={group.group} label={message(group.group, group.group)}>
                            {group.types.map((type) => (
                              <option key={type.type} value={type.type}>
                                {message(`condition_${type.type}`, type.type)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td>
                      <ProfileScopeConditionDetails
                        condition={rule.condition}
                        onChange={(field, value) => updateRuleField(index, field, value)}
                        onIpChange={(value) => updateRuleIp(index, value)}
                        onWeekdayChange={(dayIndex, selected) => updateRuleWeekday(index, dayIndex, selected)}
                      />
                    </td>
                    <td>
                      <ProfileSelect
                        name={rule.profileName}
                        onChange={(name) => editRule(index, (nextRule) => (nextRule.profileName = name))}
                        profiles={profiles}
                      />
                    </td>
                    <td className="profile-scope-rule-actions">
                      <button
                        className="btn btn-default btn-sm"
                        type="button"
                        title={message('options_moveUp', 'Move up')}
                        disabled={index === 0}
                        onClick={() => moveRule(index, -1)}
                      >
                        <span className="glyphicon glyphicon-chevron-up" aria-hidden="true" />
                      </button>{' '}
                      <button
                        className="btn btn-default btn-sm"
                        type="button"
                        title={message('options_moveDown', 'Move down')}
                        disabled={index === assignments.rules.length - 1}
                        onClick={() => moveRule(index, 1)}
                      >
                        <span className="glyphicon glyphicon-chevron-down" aria-hidden="true" />
                      </button>{' '}
                      <button
                        className="btn btn-default btn-sm"
                        type="button"
                        title={message('options_cloneRule', 'Clone')}
                        onClick={() => cloneRule(index)}
                      >
                        <span className="glyphicon glyphicon-duplicate" aria-hidden="true" />
                      </button>{' '}
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        title={message('dialog_delete', 'Delete')}
                        onClick={() => removeRule(index)}
                      >
                        <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">{message('options_profileScopeRulesEmpty', 'No page or site rules.')}</p>
          )}
        </section>
      )}

      {visible.container && (
        <section className="settings-group profile-scope-settings-group">
          <div className="settings-section-heading">
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

      {(visible.tab || visible.group) && (
        <section className="settings-group profile-scope-settings-group">
          <h3>{message('options_profileScopeTabsSection', 'Tabs / Tab Groups')}</h3>
          <p className="help-block">
            {message(
              'options_profileScopeTabsHelp',
              'Tab and tab group profile assignments are temporary and stay with the tab or tab group where they were set.'
            )}
          </p>
        </section>
      )}
    </>
  );
}
