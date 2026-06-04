import React, {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Options} from './options_client';
import {message} from './options_client';
import {
  Profile,
  ProfileInline,
  ProfileSelect,
  profileByName,
  resultProfilesFor
} from './profile_widgets';

declare const OmegaSwitchProfileRules: any;

type UnsupportedProfileProps = {
  profile?: {
    profileType?: string;
  } | null;
};

type VirtualProfileProps = {
  onReplaceProfile?: (fromName: string, toName: string) => void;
  onTargetChange?: (name: string) => void;
  options?: Options | null;
  profile?: {
    defaultProfileName?: string;
    name?: string;
  } | null;
};

type RuleListProfileModel = Profile & {
  defaultProfileName?: string;
  format?: string;
  lastUpdate?: string;
  matchProfileName?: string;
  ruleList?: string;
  sourceUrl?: string;
};

type RuleListProfileProps = {
  onDownload?: (name: string) => void;
  onProfileChange?: (field: keyof RuleListProfileModel, value: string) => void;
  options?: Options | null;
  profile?: RuleListProfileModel | null;
  ruleListFormats?: string[];
  updating?: boolean;
};

type PacProfileModel = Profile & {
  auth?: Record<string, any>;
  lastUpdate?: string;
  pacScript?: string;
  pacUrl?: string;
};

type PacProfileProps = {
  onDownload?: (name: string) => void;
  onEditProxyAuth?: () => void;
  onProfileChange?: (field: keyof PacProfileModel, value: string) => void;
  pacProfilesUnsupported?: boolean;
  profile?: PacProfileModel | null;
  referenced?: boolean;
  updating?: boolean;
};

type ProxyEditor = {
  host?: string;
  port?: number | string;
  scheme?: string;
};

type ProxyOption = {
  label: string;
  value?: string;
};

type FixedProfileProps = {
  bypassList?: string;
  isProxyAuthActive?: (scheme: string) => boolean;
  onBypassListChange?: (value: string) => void;
  onEditProxyAuth?: (scheme: string) => void;
  onProxyEditorChange?: (scheme: string, field: keyof ProxyEditor, value?: string | number) => void;
  onShowAdvanced?: () => void;
  optionsForScheme?: Record<string, ProxyOption[]>;
  proxyEditors?: Record<string, ProxyEditor>;
  schemeDisp?: Record<string, string | null>;
  showAdvanced?: boolean;
  urlSchemes?: string[];
};

type SwitchAttachedProfileProps = {
  attached?: RuleListProfileModel | null;
  attachedRuleListError?: {message?: string} | null;
  onAttachNew?: () => void;
  onAttachedChange?: (field: keyof RuleListProfileModel, value: string) => void;
  onDownload?: (name: string) => void;
  ruleListFormats?: string[];
  updating?: boolean;
};

type SwitchConditionHelpProps = {
  onClose?: () => void;
  show?: boolean;
  showConditionTypes?: number;
};

type SwitchRulesHeaderProps = {
  editSource?: boolean;
  onSourceChange?: (code: string) => void;
  onToggleSource?: () => void;
  rules?: SwitchRuleModel[];
  source?: {
    code?: string;
    error?: {
      message?: string;
    };
  } | null;
};

type SwitchRuleTableHeaderProps = {
  onToggleConditionHelp?: () => void;
  showNotes?: boolean;
};

type SwitchRuleCondition = {
  conditionType?: string;
  days?: string;
  endHour?: number | string;
  maxValue?: number | string;
  minValue?: number | string;
  pattern?: string;
  startHour?: number | string;
  [key: string]: any;
};

type SwitchRuleModel = {
  condition: SwitchRuleCondition;
  note?: string;
  profileName?: string;
};

type ConditionTypeOption = {
  group: string;
  type: string;
};

type SwitchRuleRowProps = {
  conditionTypes?: ConditionTypeOption[];
  index: number;
  onAddNote?: (index: number) => void;
  onCloneRule?: (index: number) => void;
  onConditionFieldChange?: (index: number, field: string, value: any) => void;
  onConditionReplace?: (index: number, condition: SwitchRuleCondition) => void;
  onConditionTypeChange?: (index: number, type: string) => void;
  onIpConditionInputChange?: (index: number, value: string) => void;
  onNoteChange?: (index: number, note: string) => void;
  onProfileChange?: (index: number, name: string) => void;
  onRemoveRule?: (index: number) => void;
  onWeekdayChange?: (index: number, dayIndex: number, selected: boolean) => void;
  options?: Options | null;
  resultProfiles?: Profile[];
  rule: SwitchRuleModel;
  showNotes?: boolean;
  weekdayList?: boolean[];
};

type SwitchRuleRowsProps = {
  onAddNote?: (index: number) => void;
  onCloneRule?: (index: number) => void;
  onConditionFieldChange?: (index: number, field: string, value: any) => void;
  onConditionReplace?: (index: number, condition: SwitchRuleCondition) => void;
  onConditionTypeChange?: (index: number, type: string) => void;
  onIpConditionInputChange?: (index: number, value: string) => void;
  onNoteChange?: (index: number, note: string) => void;
  onProfileChange?: (index: number, name: string) => void;
  onRemoveRule?: (index: number) => void;
  onWeekdayChange?: (index: number, dayIndex: number, selected: boolean) => void;
  options?: Options | null;
  profile?: Profile | null;
  rules?: SwitchRuleModel[];
  showConditionTypes?: number;
  showNotes?: boolean;
  visibleRuleCount?: number;
};

type SwitchRuleFooterProps = {
  attached?: RuleListProfileModel | null;
  attachedOptions?: {
    defaultProfileName?: string;
    enabled?: boolean;
  };
  onAddRule?: () => void;
  onAttachedEnabledChange?: (enabled: boolean) => void;
  onAttachedMatchProfileChange?: (name: string) => void;
  onDefaultProfileChange?: (name: string) => void;
  onRemoveAttached?: () => void;
  onResetRules?: () => void;
  options?: Options | null;
  profile?: Profile | null;
  ruleListIcon?: string;
  showNotes?: boolean;
};

type ProfileShellProps = {
  exportRuleListAvailable?: boolean;
  exportRuleListWarning?: boolean;
  onColorChange?: (color: string) => void;
  onDelete?: () => void;
  onExportRuleList?: () => void;
  onExportScript?: () => void;
  onRename?: () => void;
  profile?: Profile & {
    syncError?: {
      reason?: string;
    };
    syncOptions?: string;
  } | null;
  profileColor?: string;
  scriptable?: boolean;
};

function normalizeColor(color?: string) {
  if (!color) {
    return '#000000';
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return '#' + color.charAt(1) + color.charAt(1) + color.charAt(2) + color.charAt(2) + color.charAt(3) + color.charAt(3);
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }
  return '#000000';
}

function ProfileShell({
  exportRuleListAvailable = false,
  exportRuleListWarning = false,
  onColorChange,
  onDelete,
  onExportRuleList,
  onExportScript,
  onRename,
  profile,
  profileColor,
  scriptable = false
}: ProfileShellProps) {
  const color = normalizeColor(profileColor || profile?.color);
  const isVirtual = profile?.profileType === 'VirtualProfile';

  return (
    <>
      <div className="page-header">
        <div className="profile-actions">
          {exportRuleListAvailable && (
            <>
              <button
                type="button"
                className={`btn ${exportRuleListWarning ? 'btn-warning' : 'btn-default'}`}
                title={message('options_profileExportRuleListHelp', 'Export the rule list in this profile.')}
                onClick={onExportRuleList}
              >
                <span className="glyphicon glyphicon-list" /> {message('options_profileExportRuleList', 'Export Rule List')}
              </button>{' '}
            </>
          )}
          {scriptable && (
            <>
              <button
                type="button"
                className="btn btn-default"
                title={message('options_exportPacFileHelp', 'Export this profile as a PAC file.')}
                onClick={onExportScript}
              >
                <span className="glyphicon glyphicon-download" /> {message('options_profileExportPac', 'Export PAC')}
              </button>{' '}
            </>
          )}
          <button type="button" className="btn btn-default" onClick={onRename}>
            <span className="glyphicon glyphicon-edit" /> {message('options_renameProfile', 'Rename')}
          </button>{' '}
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            <span className="glyphicon glyphicon-trash" /> {message('options_deleteProfile', 'Delete Profile')}
          </button>
        </div>
        <span className="profile-color-editor">
          {isVirtual ? (
            <span className="profile-color-editor-fake" style={{backgroundColor: color}} />
          ) : (
            <input type="color" value={color} onChange={(event) => onColorChange?.(event.currentTarget.value)} />
          )}
        </span>
        <h2 className="profile-name">{message('options_profileTabPrefix', 'Profile :: ')}{profile?.name}</h2>
      </div>
      {profile?.syncOptions === 'disabled' && (
        <section className="settings-group">
          {!profile.syncError && (
            <p className="alert alert-info width-limit">
              <span className="glyphicon glyphicon-info-sign" /> Syncing is disabled for this profile.
            </p>
          )}
          {profile.syncError && (
            <p className="alert alert-danger width-limit">
              <span className="glyphicon glyphicon-remove" /> {message(`options_profileSyncDisabled_${profile.syncError.reason}`, profile.syncError.reason || '')}
            </p>
          )}
        </section>
      )}
    </>
  );
}

function groupedConditionTypes(conditionTypes: ConditionTypeOption[] = []) {
  const groups: Record<string, ConditionTypeOption[]> = {};
  const order: string[] = [];
  for (const conditionType of conditionTypes) {
    if (!groups[conditionType.group]) {
      groups[conditionType.group] = [];
      order.push(conditionType.group);
    }
    groups[conditionType.group].push(conditionType);
  }
  return order.map((group) => ({group, types: groups[group]}));
}

function conditionTypesForMode(showConditionTypes = 0): ConditionTypeOption[] {
  const groups = showConditionTypes === 0
    ? OmegaSwitchProfileRules.getBasicConditionGroups()
    : OmegaSwitchProfileRules.getAdvancedConditionGroups();
  return OmegaSwitchProfileRules.expandConditionGroups(groups);
}

const switchRuleKeys = new WeakMap<object, number>();
let nextSwitchRuleKey = 1;

function switchRuleKey(rule: SwitchRuleModel) {
  if (!switchRuleKeys.has(rule)) {
    switchRuleKeys.set(rule, nextSwitchRuleKey++);
  }
  return switchRuleKeys.get(rule);
}

function messageWithNodes(
  key: string,
  fallback: string,
  substitutions: string[],
  nodes: Record<string, React.ReactNode>
) {
  const text = message(key, fallback, substitutions);
  const tokens = Object.keys(nodes);
  if (!tokens.length) {
    return text;
  }
  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text.split(pattern).map((part, index) => nodes[part] ? (
    <React.Fragment key={`${part}-${index}`}>{nodes[part]}</React.Fragment>
  ) : part);
}

function ClearableInput({
  onChange,
  type,
  value
}: {
  onChange: (value: string) => void;
  type: string;
  value: string;
}) {
  const [oldValue, setOldValue] = useState('');

  function toggleClear() {
    onChange(oldValue);
    setOldValue(value);
  }

  function updateValue(nextValue: string) {
    onChange(nextValue);
    if (nextValue) {
      setOldValue('');
    }
  }

  return (
    <div className="input-group">
      <input
        className="form-control"
        type={type}
        value={value}
        onChange={(event) => updateValue(event.currentTarget.value)}
      />
      <span className="input-group-btn">
        <button
          type="button"
          className="btn btn-default input-group-clear-btn"
          disabled={!value && !oldValue}
          title={oldValue ? message('inputClear_restore', 'Restore') : message('inputClear_clear', 'Clear')}
          onClick={toggleClear}
        >
          <span className={`glyphicon ${oldValue ? 'glyphicon-repeat' : 'glyphicon-remove'}`} />
        </button>
      </span>
    </div>
  );
}

function DraftInput({
  disabled = false,
  max,
  min,
  onChange,
  placeholder,
  required = false,
  title,
  type = 'text',
  value
}: {
  disabled?: boolean;
  max?: number;
  min?: number;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  title?: string;
  type?: string;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(value);
    }
  }, [value]);

  function change(nextValue: string) {
    setDraft(nextValue);
    onChange?.(nextValue);
  }

  return (
    <input
      ref={inputRef}
      className="form-control"
      type={type}
      min={min}
      max={max}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      spellCheck={false}
      title={title}
      value={draft}
      onChange={(event) => change(event.currentTarget.value)}
    />
  );
}

function SwitchRuleRow({
  conditionTypes = [],
  index,
  onAddNote,
  onCloneRule,
  onConditionFieldChange,
  onConditionTypeChange,
  onIpConditionInputChange,
  onNoteChange,
  onProfileChange,
  onRemoveRule,
  onWeekdayChange,
  options,
  resultProfiles,
  rule,
  showNotes = false,
  weekdayList = []
}: SwitchRuleRowProps) {
  const condition = rule.condition || {};
  const conditionType = condition.conditionType || '';
  const conditionGroups = groupedConditionTypes(conditionTypes);
  const isUrlConditionType = OmegaSwitchProfileRules.getUrlConditionTypeMap();
  const hasUrlIcon = !!isUrlConditionType[conditionType];
  const hasWarning = OmegaSwitchProfileRules.conditionHasWarning(condition);

  function formatIpCondition(condition: SwitchRuleCondition) {
    if (condition?.ip) {
      return OmegaPac.Conditions.str(condition).split(' ', 2)[1];
    }
    return '';
  }

  function changeField(field: string, value: any) {
    onConditionFieldChange?.(index, field, value);
  }

  function renderConditionDetails() {
    switch (conditionType) {
      case 'FalseCondition':
        return condition.pattern ? (
          <span>
            <DraftInput
              value={condition.pattern || ''}
              disabled
              title={message('condition_details_FalseCondition', 'Never')}
            />
          </span>
        ) : (
          <span>{message('condition_details_FalseCondition', 'Never')}</span>
        );
      case 'HostLevelsCondition':
        return (
          <span className="host-levels-details">
            <DraftInput
              type="number"
              min={1}
              max={99}
              required
              value={String(condition.minValue ?? '')}
              onChange={(value) => changeField('minValue', value)}
            />{' '}
            <span>{message('options_hostLevelsBetween', 'to')}</span>{' '}
            <DraftInput
              type="number"
              min={1}
              max={99}
              required
              value={String(condition.maxValue ?? '')}
              onChange={(value) => changeField('maxValue', value)}
            />
          </span>
        );
      case 'IpCondition':
        return (
          <span>
            <DraftInput
              type="text"
              required
              placeholder="127.0.0.1/8"
              value={formatIpCondition?.(condition) || ''}
              onChange={(value) => onIpConditionInputChange?.(index, value)}
            />
          </span>
        );
      case 'TimeCondition':
        return (
          <span className="host-levels-details">
            <DraftInput
              type="number"
              min={0}
              max={23}
              required
              value={String(condition.startHour ?? '')}
              onChange={(value) => changeField('startHour', value)}
            />{' '}
            <span>{message('options_hourBetween', 'to')}</span>{' '}
            <DraftInput
              type="number"
              min={0}
              max={23}
              required
              value={String(condition.endHour ?? '')}
              onChange={(value) => changeField('endHour', value)}
            />
          </span>
        );
      case 'WeekdayCondition':
        return (
          <span className="host-levels-details">
            {weekdayList.map((selected, dayIndex) => (
              <label className="checkbox-inline" key={dayIndex}>
                <input
                  type="checkbox"
                  checked={!!selected}
                  onChange={(event) => onWeekdayChange?.(index, dayIndex, event.currentTarget.checked)}
                />
                {message(`options_weekDayShort_${dayIndex}`, String(dayIndex))}
              </label>
            ))}
          </span>
        );
      default:
        return (
          <DraftInput
            value={condition.pattern || ''}
            required
            onChange={(value) => changeField('pattern', value)}
          />
        );
    }
  }

  return (
    <tr className="switch-rule-row">
      <td className="sort-bar">
        <span className="glyphicon glyphicon-sort" />
      </td>
      <td className={hasUrlIcon ? 'has-icon' : undefined}>
        <select
          className="form-control"
          value={conditionType}
          onChange={(event) => onConditionTypeChange?.(index, event.currentTarget.value)}
        >
          {conditionGroups.map(({group, types}) => (
            <optgroup key={group} label={message(group, group)}>
              {types.map((type) => (
                <option key={type.type} value={type.type}>
                  {message(`condition_${type.type}`, type.type)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {hasUrlIcon && (
          <a className="icon-wrapper" href={message('condition_alert_fullUrlLimitationLink', '#')} target="_blank" rel="noreferrer">
            <span className="glyphicon glyphicon-alert text-danger" />
          </a>
        )}
      </td>
      <td className={hasWarning ? 'has-warning' : undefined}>{renderConditionDetails()}</td>
      <td className="switch-rule-row-target">
        <div className={conditionType === 'NeverCondition' ? 'disabled' : undefined}>
          <ProfileSelect
            name={rule.profileName || ''}
            onChange={(name) => onProfileChange?.(index, name)}
            options={options}
            profiles={resultProfiles}
          />
        </div>
      </td>
      <td>
        <button type="button" className="btn btn-danger btn-sm" title={message('options_deleteRule', 'Delete rule')} onClick={() => onRemoveRule?.(index)}>
          <span className="glyphicon glyphicon-trash" />
        </button>{' '}
        <button type="button" className="btn btn-default btn-sm" title={message('options_cloneRule', 'Clone rule')} onClick={() => onCloneRule?.(index)}>
          <span className="glyphicon glyphicon-duplicate" />
        </button>{' '}
        {!showNotes && (
          <button type="button" className="btn btn-default btn-sm" title={message('options_ruleNote', 'Note')} onClick={() => onAddNote?.(index)}>
            <span className="glyphicon glyphicon-comment" />
          </button>
        )}
      </td>
      {showNotes && (
        <td>
          <DraftInput
            value={rule.note || ''}
            onChange={(value) => onNoteChange?.(index, value)}
          />
        </td>
      )}
    </tr>
  );
}

function SwitchRuleRows({
  onAddNote,
  onCloneRule,
  onConditionFieldChange,
  onConditionReplace,
  onConditionTypeChange,
  onIpConditionInputChange,
  onNoteChange,
  onProfileChange,
  onRemoveRule,
  onWeekdayChange,
  options,
  profile,
  rules = [],
  showConditionTypes = 0,
  showNotes = false,
  visibleRuleCount = rules.length
}: SwitchRuleRowsProps) {
  const conditionTypes = conditionTypesForMode(showConditionTypes);
  const resultProfiles = resultProfilesFor(options, profile);

  return (
    <>
      {rules.slice(0, visibleRuleCount).map((rule, index) => (
        <SwitchRuleRow
          conditionTypes={conditionTypes}
          index={index}
          key={switchRuleKey(rule)}
          onAddNote={onAddNote}
          onCloneRule={onCloneRule}
          onConditionFieldChange={onConditionFieldChange}
          onConditionReplace={onConditionReplace}
          onConditionTypeChange={onConditionTypeChange}
          onIpConditionInputChange={onIpConditionInputChange}
          onNoteChange={onNoteChange}
          onProfileChange={onProfileChange}
          onRemoveRule={onRemoveRule}
          onWeekdayChange={onWeekdayChange}
          options={options}
          resultProfiles={resultProfiles}
          rule={rule}
          showNotes={showNotes}
          weekdayList={OmegaPac.Conditions.getWeekdayList(rule.condition) || []}
        />
      ))}
    </>
  );
}

function UnsupportedProfile({profile}: UnsupportedProfileProps) {
  const profileType = profile?.profileType || '';
  return (
    <>
      <div className="lead">
        {message('options_profileUnsupported', `Unsupported profile type ${profileType}!`, profileType)}
      </div>
      <p>{message('options_profileUnsupportedHelp', 'The options could be broken, or from a newer version of this program.')}</p>
    </>
  );
}

const PAC_URL_REGEX = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?$/;
const PAC_URL_WITH_FILE_REGEX = /^(ftp|http|https|file):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?$/;

function isFileUrl(url: string) {
  return /^file:\/\//i.test(url || '');
}

function formatMediumDate(value?: string | number | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    second: '2-digit',
    year: 'numeric'
  }).format(date);
}

function PacProfile({
  onDownload,
  onEditProxyAuth,
  onProfileChange,
  pacProfilesUnsupported = false,
  profile,
  referenced = false,
  updating = false
}: PacProfileProps) {
  const formattedLastUpdate = formatMediumDate(profile?.lastUpdate);
  const [draft, setDraft] = useState({
    pacScript: profile?.pacScript || '',
    pacUrl: profile?.pacUrl || ''
  });

  useEffect(() => {
    setDraft({
      pacScript: profile?.pacScript || '',
      pacUrl: profile?.pacUrl || ''
    });
  }, [profile?.name, profile?.pacScript, profile?.pacUrl]);

  function changeField(field: keyof PacProfileModel, value: string) {
    setDraft((current) => ({...current, [field]: value}));
    onProfileChange?.(field, value);
  }

  const pacUrl = draft.pacUrl;
  const pacUrlIsFile = isFileUrl(pacUrl);
  const pacUrlPattern = referenced ? PAC_URL_REGEX : PAC_URL_WITH_FILE_REGEX;
  const pacUrlInvalid = !!pacUrl && !pacUrlPattern.test(pacUrl);
  const authAll = !!profile?.auth?.all;

  return (
    <div>
      {pacProfilesUnsupported && (
        <p className="alert alert-danger width-limit">
          <span className="glyphicon glyphicon-remove" /> {message('options_pac_profile_unsupported_moz', 'PAC Profiles WILL NOT work in Mozilla Firefox due to technical limitations!')}
        </p>
      )}
      <section className="settings-group">
        <h3>{message('options_group_pacUrl', 'PAC URL')}</h3>
        <div className="width-limit">
          <ClearableInput
            type="text"
            value={pacUrl}
            onChange={(value) => changeField('pacUrl', value)}
          />
        </div>
        <p className="help-block">{message('options_pacUrlHelp', 'The PAC script will be downloaded from this URL.')}</p>
        {pacUrlIsFile && !referenced && (
          <div className="has-warning">
            <p className="help-block">
              <span className="glyphicon glyphicon-warning-sign" /> {message('options_pacUrlFile', 'Loading PAC scripts from file: URLs is not recommended.')}
            </p>
          </div>
        )}
        {pacUrlIsFile && referenced && (
          <div className="has-error">
            <p className="help-block">
              <span className="glyphicon glyphicon-remove-sign" /> {message('options_pacUrlFile', 'Loading PAC scripts from file: URLs is not recommended.')}
            </p>
            <p className="help-block">{message('options_pacUrlFileDisabled', 'File URLs are disabled for referenced PAC profiles.')}</p>
          </div>
        )}
        {pacUrl && !pacUrlIsFile && (
          <p>
            <button
              type="button"
              className={`btn ${pacUrl && !profile?.lastUpdate ? 'btn-primary' : 'btn-default'}`}
              disabled={updating}
              onClick={() => onDownload?.(profile?.name || '')}
            >
              <span className="glyphicon glyphicon-download-alt" /> {message('options_downloadProfileNow', 'Download Profile Now')}
            </button>
          </p>
        )}
      </section>
      <section className="settings-group">
        <h3>
          {message('options_group_pacScript', 'PAC Script')}{' '}
          <button
            type="button"
            role="button"
            className={`btn btn-xs proxy-auth-toggle ${authAll ? 'btn-success' : 'btn-default'}`}
            title={message('options_proxy_auth', 'Proxy Authentication')}
            onClick={() => onEditProxyAuth?.()}
          >
            <span className="glyphicon glyphicon-lock" />
          </button>
        </h3>
        {authAll && (
          <div className="alert alert-warning width-limit">
            <p>{message('options_proxy_authAllWarningPac', 'Proxy authentication will be applied to all proxies returned by this PAC profile.')}</p>
            {pacUrl ? (
              <p>{message('options_proxy_authAllWarningPacUrl', 'Make sure the downloaded PAC script only returns proxies that share these credentials.')}</p>
            ) : (
              <p>{message('options_proxy_authAllWarningPacScript', 'Make sure the PAC script only returns proxies that share these credentials.')}</p>
            )}
            {referenced && (
              <p>
                <span className="glyphicon glyphicon-warning-sign" /> {message('options_proxy_authReferencedWarning', 'This profile is referenced by other profiles.')}
              </p>
            )}
          </div>
        )}
        {!pacUrlIsFile && (
          <div>
            {pacUrl && profile?.lastUpdate && (
              <p className="alert alert-success width-limit">
                {message('options_pacScriptLastUpdate', 'Last update: $1', formattedLastUpdate)}
              </p>
            )}
            {pacUrl && !profile?.lastUpdate && (
              <p className="alert alert-danger width-limit">{message('options_pacScriptObsolete', 'PAC script is obsolete. Please download it now.')}</p>
            )}
            <textarea
              className="monospace form-control width-limit"
              rows={20}
              value={draft.pacScript}
              disabled={pacUrlInvalid || !!pacUrl}
              onChange={(event) => changeField('pacScript', event.currentTarget.value)}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function cloneProxyEditors(proxyEditors?: Record<string, ProxyEditor>) {
  const cloned: Record<string, ProxyEditor> = {};
  for (const scheme of Object.keys(proxyEditors || {})) {
    cloned[scheme] = {...proxyEditors?.[scheme]};
  }
  return cloned;
}

function FixedProfileContent({
  bypassList = '',
  isProxyAuthActive,
  onBypassListChange,
  onEditProxyAuth,
  onProxyEditorChange,
  onShowAdvanced,
  optionsForScheme = {},
  proxyEditors = {},
  schemeDisp = {},
  showAdvanced = false,
  urlSchemes = []
}: FixedProfileProps) {
  const [draftEditors, setDraftEditors] = useState<Record<string, ProxyEditor>>(() => cloneProxyEditors(proxyEditors));
  const [draftBypassList, setDraftBypassList] = useState(bypassList || '');

  useEffect(() => {
    setDraftEditors(cloneProxyEditors(proxyEditors));
  }, [proxyEditors]);

  useEffect(() => {
    setDraftBypassList(bypassList || '');
  }, [bypassList]);

  function changeProxyEditor(scheme: string, field: keyof ProxyEditor, value?: string | number) {
    const nextValue = field === 'scheme' && value === '' ? undefined : value;
    setDraftEditors((current) => ({
      ...current,
      [scheme]: {
        ...(current[scheme] || {}),
        [field]: nextValue
      }
    }));
    onProxyEditorChange?.(scheme, field, nextValue);
  }

  const defaultEditor = draftEditors[''] || {};
  const visibleSchemes = urlSchemes.filter((scheme) => scheme === '' || showAdvanced);

  return (
    <div>
      <section className="settings-group settings-group-fixed-servers">
        <h3>{message('options_group_proxyServers', 'Proxy Servers')}</h3>
        <div className="table-responsive">
          <table className="fixed-servers table table-bordered table-striped width-limit-lg">
            <thead>
              <tr>
                <th>{message('options_proxy_scheme', 'Scheme')}</th>
                <th>{message('options_proxy_protocol', 'Protocol')}</th>
                <th>{message('options_proxy_server', 'Server')}</th>
                <th>{message('options_proxy_port', 'Port')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleSchemes.map((scheme) => {
                const editor = draftEditors[scheme] || {};
                const hasScheme = !!editor.scheme;
                return (
                  <tr key={scheme || 'default'}>
                    <td>{schemeDisp[scheme] || message('options_scheme_default', 'Default')}</td>
                    <td>
                      <select
                        className="form-control"
                        value={editor.scheme || ''}
                        onChange={(event) => changeProxyEditor(scheme, 'scheme', event.currentTarget.value)}
                      >
                        {(optionsForScheme[scheme] || []).map((option) => (
                          <option key={option.value || ''} value={option.value || ''}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {hasScheme ? (
                        <input
                          className="form-control"
                          type="text"
                          required
                          value={editor.host || ''}
                          onChange={(event) => changeProxyEditor(scheme, 'host', event.currentTarget.value)}
                        />
                      ) : (
                        <input className="form-control" type="text" value="" placeholder={defaultEditor.host || ''} disabled />
                      )}
                    </td>
                    <td>
                      {hasScheme ? (
                        <input
                          className="form-control"
                          type="number"
                          min={1}
                          required
                          value={editor.port ?? ''}
                          onChange={(event) => changeProxyEditor(scheme, 'port', event.currentTarget.value ? Number(event.currentTarget.value) : undefined)}
                        />
                      ) : (
                        <input className="form-control" type="number" value="" placeholder={defaultEditor.port != null ? String(defaultEditor.port) : ''} disabled />
                      )}
                    </td>
                    <td className="proxy-actions">
                      <button
                        type="button"
                        role="button"
                        className={`btn btn-xs proxy-auth-toggle ${isProxyAuthActive?.(scheme) ? 'btn-success' : 'btn-default'}`}
                        title={message('options_proxy_auth', 'Proxy Authentication')}
                        onClick={() => onEditProxyAuth?.(scheme)}
                      >
                        <span className="glyphicon glyphicon-lock" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {!showAdvanced && (
              <tbody>
                <tr className="fixed-show-advanced">
                  <td colSpan={7}>
                    <button type="button" className="btn btn-link" onClick={() => onShowAdvanced?.()}>
                      <span className="glyphicon glyphicon-chevron-down" /> {message('options_proxy_expand', 'Show Advanced')}
                    </button>
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </section>
      <section className="settings-group">
        <h3>{message('options_group_bypassList', 'Bypass List')}</h3>
        <p className="help-block">{message('options_bypassListHelp', 'Requests matching the bypass list will not use the proxy.')}</p>
        <p className="help-block">
          <a href="https://developer.chrome.com/extensions/proxy#bypass_list" target="_blank" rel="noreferrer">
            {message('options_bypassListHelpLinkText', 'Learn more about bypass list syntax.')}
          </a>
        </p>
        <textarea
          className="monospace form-control width-limit"
          rows={10}
          value={draftBypassList}
          onChange={(event) => setDraftBypassList(event.currentTarget.value)}
          onBlur={() => onBypassListChange?.(draftBypassList)}
        />
      </section>
    </div>
  );
}

function SwitchAttachedProfile({
  attached,
  attachedRuleListError,
  onAttachNew,
  onAttachedChange,
  onDownload,
  ruleListFormats = [],
  updating = false
}: SwitchAttachedProfileProps) {
  const formattedLastUpdate = formatMediumDate(attached?.lastUpdate);
  const [draft, setDraft] = useState({
    format: attached?.format || '',
    ruleList: attached?.ruleList || '',
    sourceUrl: attached?.sourceUrl || ''
  });

  useEffect(() => {
    setDraft({
      format: attached?.format || '',
      ruleList: attached?.ruleList || '',
      sourceUrl: attached?.sourceUrl || ''
    });
  }, [attached?.name, attached?.format, attached?.ruleList, attached?.sourceUrl]);

  function changeField(field: keyof RuleListProfileModel, value: string) {
    setDraft((current) => ({...current, [field]: value}));
    onAttachedChange?.(field, value);
  }

  if (!attached) {
    return (
      <section className="settings-group">
        <h3>{message('options_group_attachProfile', 'Attach Profile')}</h3>
        <p className="help-block">{message('options_attachProfileHelp', 'Attach a rule list profile to import rules from a URL or text.')}</p>
        <button type="button" className="btn btn-default" onClick={() => onAttachNew?.()}>
          <span className="glyphicon glyphicon-plus" /> {message('options_attachProfile', 'Attach Profile')}
        </button>
      </section>
    );
  }

  return (
    <div>
      <section className="settings-group">
        <h3>{message('options_group_ruleListConfig', 'Rule List Config')}</h3>
        <form>
          <div className="form-group">
            <label>{message('options_ruleListFormat', 'Rule List Format')}</label>
            {ruleListFormats.map((format) => (
              <div key={format} className="radio inline-form-control no-min-width">
                <label>
                  <input
                    type="radio"
                    name="formatInput"
                    value={format}
                    checked={draft.format === format}
                    onChange={(event) => changeField('format', event.currentTarget.value)}
                  />
                  {message(`ruleListFormat_${format}`, format)}
                </label>
              </div>
            ))}
          </div>
          <div className="form-group">
            <label>{message('options_group_ruleListUrl', 'Rule List URL')}</label>{' '}
            <div className="width-limit inline-form-control" style={{verticalAlign: 'middle'}}>
              <ClearableInput
                type="url"
                value={draft.sourceUrl}
                onChange={(value) => changeField('sourceUrl', value)}
              />
            </div>
          </div>
          <p className="help-block">{message('options_ruleListUrlHelp', 'The rule list will be downloaded from this URL.')}</p>
        </form>
        <p>
          <button
            type="button"
            className={`btn ${draft.sourceUrl && !attached.lastUpdate ? 'btn-primary' : 'btn-default'}`}
            disabled={!draft.sourceUrl || updating}
            onClick={() => onDownload?.(attached.name || '')}
          >
            <span className="glyphicon glyphicon-download-alt" /> {message('options_downloadProfileNow', 'Download Profile Now')}
          </button>
        </p>
      </section>
      <section className="settings-group">
        <h3>{message('options_group_ruleListText', 'Rule List Text')}</h3>
        {draft.sourceUrl && attached.lastUpdate && (
          <p className="alert alert-success width-limit">
            {message('options_ruleListLastUpdate', 'Last update: $1', formattedLastUpdate)}
          </p>
        )}
        {draft.sourceUrl && !attached.lastUpdate && (
          <p className="alert alert-danger width-limit">{message('options_ruleListObsolete', 'Rule list is obsolete. Please download it now.')}</p>
        )}
        {attachedRuleListError && (
          <p className="alert alert-danger width-limit">
            <span className="glyphicon glyphicon-remove" /> {attachedRuleListError.message}
          </p>
        )}
        <textarea
          id="attached-rulelist"
          className="monospace form-control width-limit"
          rows={20}
          value={draft.ruleList}
          disabled={!!draft.sourceUrl}
          onChange={(event) => changeField('ruleList', event.currentTarget.value)}
        />
      </section>
    </div>
  );
}

function htmlMessage(key: string, fallback = key) {
  return {__html: message(key, fallback)};
}

function SwitchConditionHelp({
  onClose,
  show = false,
  showConditionTypes = 0
}: SwitchConditionHelpProps) {
  const [expandedId, setExpandedId] = useState(0);
  const groups = showConditionTypes === 0
    ? OmegaSwitchProfileRules.getBasicConditionGroups()
    : OmegaSwitchProfileRules.getAdvancedConditionGroups();
  const isUrlConditionType = OmegaSwitchProfileRules.getUrlConditionTypeMap();

  if (!show) {
    return null;
  }

  return (
    <section className="condition-help-section settings-group">
      <h3>
        {message('options_group_conditionHelp', 'Condition Help')}
        <button type="button" className="close close-condition-help" onClick={() => onClose?.()}>
          <span aria-hidden="true">{'\u00d7'}</span>
          <span className="sr-only">{message('dialog_close', 'Close')}</span>
        </button>
      </h3>
      {groups.map((group, groupIndex) => {
        const groupTitle = message(`condition_group_${group.group}`, '');
        return (
          <div className="condition-help" key={group.group}>
            {!!groupTitle && (
              <h4>
                <a role="button" onClick={() => setExpandedId(groupIndex)}>
                  <span className={`glyphicon ${expandedId === groupIndex ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right'}`} /> {groupTitle}
                </a>
              </h4>
            )}
            {expandedId === groupIndex && (
              <dl>
                {group.types.map((type) => (
                  <React.Fragment key={type}>
                    <dt>{message(`condition_${type}`, type)}</dt>
                    <dd>
                      <div dangerouslySetInnerHTML={htmlMessage(`condition_help_${type}`, '')} />
                      {isUrlConditionType[type] && (
                        <div className="text-danger">
                          <span className="glyphicon glyphicon-alert" />{' '}
                          <span dangerouslySetInnerHTML={htmlMessage('condition_alert_fullUrlLimitation', '')} />
                        </div>
                      )}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </section>
  );
}

function SwitchRulesHeader({
  editSource = false,
  onSourceChange,
  onToggleSource,
  rules = [],
  source
}: SwitchRulesHeaderProps) {
  const [sourceCode, setSourceCode] = useState(source?.code || '');
  const isUrlConditionType = OmegaSwitchProfileRules.getUrlConditionTypeMap();
  const hasUrlConditions = rules.some((rule) => {
    const conditionType = rule?.condition?.conditionType;
    return !!(conditionType && isUrlConditionType[conditionType]);
  });

  useEffect(() => {
    setSourceCode(source?.code || '');
  }, [source?.code]);

  function changeSource(code: string) {
    setSourceCode(code);
    onSourceChange?.(code);
  }

  return (
    <>
      <h3>
        {message('options_group_switchRules', 'Switch Rules')}{' '}
        <button
          type="button"
          className={`btn ${editSource ? 'btn-primary active' : 'btn-default'}`}
          onClick={() => onToggleSource?.()}
        >
          <span className="glyphicon glyphicon-edit" /> {message('options_profileEditSource', 'Edit Source')}
        </button>{' '}
        {editSource && (
          <a
            className="btn btn-link btn-sm clear-padding toggle-condition-help"
            target="_blank"
            rel="noreferrer"
            title={message('options_profileEditSourceHelp', 'Edit source help')}
            href={message('options_profileEditSourceHelpUrl', '#')}
          >
            <span className="glyphicon glyphicon-question-sign" />
          </a>
        )}
      </h3>
      {source?.error && (
        <div className="alert alert-danger width-limit">
          <span className="glyphicon glyphicon-remove" /> {source.error.message}
        </div>
      )}
      {hasUrlConditions && (
        <div className="alert alert-danger">
          <span className="glyphicon glyphicon-alert" />{' '}
          <span dangerouslySetInnerHTML={htmlMessage('condition_alert_fullUrlLimitation', '')} />
        </div>
      )}
      {editSource && (
        <div className="rules-source">
          <textarea
            className="monospace form-control width-limit"
            rows={20}
            value={sourceCode}
            onChange={(event) => changeSource(event.currentTarget.value)}
          />
        </div>
      )}
    </>
  );
}

function SwitchRuleTableHeader({
  onToggleConditionHelp,
  showNotes = false
}: SwitchRuleTableHeaderProps) {
  return (
    <tr>
      <th style={{whiteSpace: 'nowrap'}}>{message('options_sort', 'Sort')}</th>
      <th className="condition-type-th">
        {message('options_conditionType', 'Condition Type')}{' '}
        <button
          type="button"
          className="btn btn-link btn-sm clear-padding toggle-condition-help"
          title={message('options_showConditionTypeHelp', 'Show condition type help')}
          onClick={() => onToggleConditionHelp?.()}
        >
          <span className="glyphicon glyphicon-question-sign" />
        </button>
      </th>
      <th>{message('options_conditionDetails', 'Condition Details')}</th>
      <th>{message('options_resultProfile', 'Result Profile')}</th>
      <th>{message('options_conditionActions', 'Actions')}</th>
      {showNotes && <th>{message('options_ruleNote', 'Note')}</th>}
    </tr>
  );
}

function SwitchRuleFooter({
  attached,
  attachedOptions = {},
  onAddRule,
  onAttachedEnabledChange,
  onAttachedMatchProfileChange,
  onDefaultProfileChange,
  onRemoveAttached,
  onResetRules,
  options,
  profile,
  ruleListIcon = 'glyphicon-list',
  showNotes = false
}: SwitchRuleFooterProps) {
  const resultProfiles = resultProfilesFor(options, profile);

  return (
    <>
      <tr>
        <td style={{borderRight: 'none'}} />
        <td style={{borderLeft: 'none'}} colSpan={showNotes ? 5 : 4}>
          <button type="button" className="btn btn-default btn-sm" onClick={() => onAddRule?.()}>
            <span className="glyphicon glyphicon-plus" /> <span>{message('options_addCondition', 'Add Condition')}</span>
          </button>
        </td>
      </tr>
      {attached && (
        <tr className="switch-attached">
          <td style={{borderRight: 'none'}}>
            <span className={`glyphicon ${ruleListIcon}`} />
          </td>
          <td style={{borderLeft: 'none'}}>
            <span className="checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={!!attachedOptions.enabled}
                  onChange={(event) => onAttachedEnabledChange?.(event.currentTarget.checked)}
                />
                {message('options_switchAttachedProfileInCondition', 'Use attached rule list in conditions')}
              </label>
            </span>
          </td>
          <td>
            {attachedOptions.enabled ? (
              <span>{message('options_switchAttachedProfileInConditionDetails', 'Rules from the attached profile are included.')}</span>
            ) : (
              <span>{message('options_switchAttachedProfileInConditionDisabled', 'Rules from the attached profile are disabled.')}</span>
            )}
          </td>
          <td>
            <div className={!attachedOptions.enabled ? 'disabled' : ''}>
              <ProfileSelect
                name={attached.matchProfileName || ''}
                onChange={(name) => onAttachedMatchProfileChange?.(name)}
                options={options}
                profiles={resultProfiles}
              />
            </div>
          </td>
          <td>
            <button type="button" className="btn btn-danger btn-sm" title={message('options_deleteAttached', 'Delete attached profile')} onClick={() => onRemoveAttached?.()}>
              <span className="glyphicon glyphicon-trash" />
            </button>
          </td>
          {showNotes && <td />}
        </tr>
      )}
      <tr className="switch-default-row">
        <td />
        <td colSpan={2}>{message('options_switchDefaultProfile', 'Default Profile')}</td>
        <td>
          <ProfileSelect
            name={attachedOptions.defaultProfileName || ''}
            onChange={(name) => onDefaultProfileChange?.(name)}
            options={options}
            profiles={resultProfiles}
          />
        </td>
        <td>
          <button type="button" className="btn btn-info btn-sm" title={message('options_resetRules_help', 'Reset rules')} onClick={() => onResetRules?.()}>
            <span className="glyphicon glyphicon-chevron-up" />
          </button>
        </td>
        {showNotes && <td />}
      </tr>
    </>
  );
}

function RuleListProfile({
  onDownload,
  onProfileChange,
  options,
  profile,
  ruleListFormats = [],
  updating = false
}: RuleListProfileProps) {
  const resultProfiles = resultProfilesFor(options, profile);
  const [draft, setDraft] = useState({
    defaultProfileName: profile?.defaultProfileName || '',
    format: profile?.format || '',
    matchProfileName: profile?.matchProfileName || '',
    ruleList: profile?.ruleList || '',
    sourceUrl: profile?.sourceUrl || ''
  });

  useEffect(() => {
    setDraft({
      defaultProfileName: profile?.defaultProfileName || '',
      format: profile?.format || '',
      matchProfileName: profile?.matchProfileName || '',
      ruleList: profile?.ruleList || '',
      sourceUrl: profile?.sourceUrl || ''
    });
  }, [
    profile?.name,
    profile?.defaultProfileName,
    profile?.format,
    profile?.matchProfileName,
    profile?.ruleList,
    profile?.sourceUrl
  ]);

  function changeField(field: keyof RuleListProfileModel, value: string) {
    setDraft((current) => ({...current, [field]: value}));
    onProfileChange?.(field, value);
  }

  return (
    <div>
      <section className="settings-group">
        <h3>{message('options_group_ruleListConfig', 'Rule List Config')}</h3>
        <div className="form-group">
          <label>{message('options_ruleListMatchProfile', 'Match Profile')}</label>{' '}
          <ProfileSelect
            name={draft.matchProfileName}
            onChange={(name) => changeField('matchProfileName', name)}
            options={options}
            profiles={resultProfiles}
          />
        </div>
        <div className="form-group">
          <label>{message('options_ruleListDefaultProfile', 'Default Profile')}</label>{' '}
          <ProfileSelect
            name={draft.defaultProfileName}
            onChange={(name) => changeField('defaultProfileName', name)}
            options={options}
            profiles={resultProfiles}
          />
        </div>
        <form className="form-group">
          <label>{message('options_ruleListFormat', 'Rule List Format')}</label>
          {ruleListFormats.map((format) => (
            <div key={format} className="radio inline-form-control no-min-width">
              <label>
                <input
                  type="radio"
                  name="formatInput"
                  value={format}
                  checked={draft.format === format}
                  onChange={(event) => changeField('format', event.currentTarget.value)}
                />
                {message(`ruleListFormat_${format}`, format)}
              </label>
            </div>
          ))}
        </form>
      </section>
      <section className="settings-group">
        <h3>{message('options_group_ruleListUrl', 'Rule List URL')}</h3>
        <div className="width-limit">
          <ClearableInput
            type="url"
            value={draft.sourceUrl}
            onChange={(value) => changeField('sourceUrl', value)}
          />
        </div>
        <p className="help-block">{message('options_ruleListUrlHelp', 'The rule list will be downloaded from this URL.')}</p>
      </section>
      <section className="settings-group">
        <h3>{message('options_group_ruleListText', 'Rule List Text')}</h3>
        <p>
          <button
            type="button"
            className="btn btn-default"
            disabled={!draft.sourceUrl || updating}
            onClick={() => onDownload?.(profile?.name || '')}
          >
            <span className="glyphicon glyphicon-download-alt" /> {message('options_downloadProfileNow', 'Download Profile Now')}
          </button>
        </p>
        <textarea
          className="monospace form-control width-limit"
          rows={20}
          value={draft.ruleList}
          disabled={!!draft.sourceUrl}
          onChange={(event) => changeField('ruleList', event.currentTarget.value)}
        />
      </section>
    </div>
  );
}

function VirtualProfile({onReplaceProfile, onTargetChange, options, profile}: VirtualProfileProps) {
  const [targetName, setTargetName] = useState(profile?.defaultProfileName || '');
  useEffect(() => {
    setTargetName(profile?.defaultProfileName || '');
  }, [profile?.defaultProfileName]);
  const targetProfile = profileByName(options, targetName);
  const targetProfiles = resultProfilesFor(options, profile as Profile | null);

  function changeTarget(name: string) {
    setTargetName(name);
    onTargetChange?.(name);
  }

  return (
    <div>
      <section className="settings-group">
        <h3>{message('options_group_virtualProfile', 'Virtual Profile')}</h3>
        <p className="help-block">
          {message('options_virtualProfileTargetHelp', 'When this profile is applied, it acts exactly the same as the profile selected below.')}
        </p>
        <div className="form-group">
          <label>{message('options_virtualProfileTarget', 'Target')}</label>{' '}
          <ProfileSelect
            name={targetName}
            onChange={changeTarget}
            options={options}
            profiles={targetProfiles}
          />
        </div>
      </section>
      <section className="settings-group">
        <h3>{message('options_group_virtualProfileReplace', 'Migrate to Virtual Profile')}</h3>
        <p className="help-block">
          {messageWithNodes(
            'options_virtualProfileReplaceHelp',
            'You can migrate existing options to use this virtual profile instead of __PROFILE__. Doing so will update all existing rules concerning __PROFILE__ and point them to this virtual profile, so that their result profile can be controlled here.',
            ['__PROFILE__'],
            {
              __PROFILE__: <ProfileInline profile={targetProfile} />
            }
          )}
        </p>
        <div className="form-group">
          <button type="button" className="btn btn-default" onClick={() => onReplaceProfile?.(targetName, profile?.name || '')}>
            <span className="glyphicon glyphicon-search" /> {message('options_virtualProfileReplace', 'Replace target profile')}
          </button>
        </div>
      </section>
    </div>
  );
}

function mountUnsupportedProfile(element: Element, props: UnsupportedProfileProps = {}) {
  const root = createRoot(element);
  root.render(<UnsupportedProfile {...props} />);
  return {
    render(nextProps: UnsupportedProfileProps = {}) {
      root.render(<UnsupportedProfile {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountProfileShell(element: Element, props: ProfileShellProps = {}) {
  const root = createRoot(element);
  root.render(<ProfileShell {...props} />);
  return {
    render(nextProps: ProfileShellProps = {}) {
      root.render(<ProfileShell {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountVirtualProfile(element: Element, props: VirtualProfileProps = {}) {
  const root = createRoot(element);
  root.render(<VirtualProfile {...props} />);
  return {
    render(nextProps: VirtualProfileProps = {}) {
      root.render(<VirtualProfile {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountRuleListProfile(element: Element, props: RuleListProfileProps = {}) {
  const root = createRoot(element);
  root.render(<RuleListProfile {...props} />);
  return {
    render(nextProps: RuleListProfileProps = {}) {
      root.render(<RuleListProfile {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountPacProfile(element: Element, props: PacProfileProps = {}) {
  const root = createRoot(element);
  root.render(<PacProfile {...props} />);
  return {
    render(nextProps: PacProfileProps = {}) {
      root.render(<PacProfile {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountFixedProfile(element: Element, props: FixedProfileProps = {}) {
  const root = createRoot(element);
  root.render(<FixedProfileContent {...props} />);
  return {
    render(nextProps: FixedProfileProps = {}) {
      root.render(<FixedProfileContent {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountSwitchAttachedProfile(element: Element, props: SwitchAttachedProfileProps = {}) {
  const root = createRoot(element);
  flushSync(() => {
    root.render(<SwitchAttachedProfile {...props} />);
  });
  return {
    render(nextProps: SwitchAttachedProfileProps = {}) {
      root.render(<SwitchAttachedProfile {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountSwitchConditionHelp(element: Element, props: SwitchConditionHelpProps = {}) {
  const root = createRoot(element);
  flushSync(() => {
    root.render(<SwitchConditionHelp {...props} />);
  });
  return {
    render(nextProps: SwitchConditionHelpProps = {}) {
      root.render(<SwitchConditionHelp {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountSwitchRulesHeader(element: Element, props: SwitchRulesHeaderProps = {}) {
  const root = createRoot(element);
  flushSync(() => {
    root.render(<SwitchRulesHeader {...props} />);
  });
  return {
    render(nextProps: SwitchRulesHeaderProps = {}) {
      root.render(<SwitchRulesHeader {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountSwitchRuleTableHeader(element: Element, props: SwitchRuleTableHeaderProps = {}) {
  const root = createRoot(element);
  flushSync(() => {
    root.render(<SwitchRuleTableHeader {...props} />);
  });
  return {
    render(nextProps: SwitchRuleTableHeaderProps = {}) {
      root.render(<SwitchRuleTableHeader {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountSwitchRuleRows(element: Element, props: SwitchRuleRowsProps = {}) {
  const root = createRoot(element);
  flushSync(() => {
    root.render(<SwitchRuleRows {...props} />);
  });
  return {
    render(nextProps: SwitchRuleRowsProps = {}) {
      flushSync(() => {
        root.render(<SwitchRuleRows {...nextProps} />);
      });
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountSwitchRuleFooter(element: Element, props: SwitchRuleFooterProps = {}) {
  const root = createRoot(element);
  flushSync(() => {
    root.render(<SwitchRuleFooter {...props} />);
  });
  return {
    render(nextProps: SwitchRuleFooterProps = {}) {
      root.render(<SwitchRuleFooter {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactProfileContent = {
  mountFixedProfile,
  mountPacProfile,
  mountProfileShell,
  mountRuleListProfile,
  mountSwitchAttachedProfile,
  mountSwitchConditionHelp,
  mountSwitchRuleFooter,
  mountSwitchRuleRows,
  mountSwitchRuleTableHeader,
  mountSwitchRulesHeader,
  mountUnsupportedProfile,
  mountVirtualProfile
};
