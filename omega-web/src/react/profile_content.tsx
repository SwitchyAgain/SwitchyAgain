import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {ConfirmModal} from './confirm_modals';
import {Options} from './options_client';
import {message} from './options_client';
import {
  Profile,
  ProfileInline,
  ProfileSelect,
  PROFILE_ICONS,
  profileByName,
  resultProfilesFor
} from './profile_widgets';
import {
  conditionHasWarning,
  conditionTypesForMode as switchConditionTypesForMode,
  composeSource,
  getAdvancedConditionGroups,
  getBasicConditionGroups,
  getUrlConditionTypeMap,
  hasNotes
} from './switch_profile_runtime';

const INITIAL_SWITCH_RULE_BATCH_SIZE = 15;
const SWITCH_RULE_BATCH_SIZE = 8;
const SWITCH_RULE_BATCH_DELAY_MS = 32;

export type UnsupportedProfileProps = {
  profile?: {
    profileType?: string;
  } | null;
};

type VirtualProfileModel = Profile & {
  defaultProfileName?: string;
};

export type VirtualProfileProps = {
  onReplaceProfile?: (fromName: string, toName: string) => void;
  onTargetChange?: (name: string) => void;
  options?: Options | null;
  profile?: VirtualProfileModel | null;
};

type RuleListProfileModel = Profile & {
  defaultProfileName?: string;
  format?: string;
  lastUpdate?: string;
  matchProfileName?: string;
  ruleList?: string;
  sourceUrl?: string;
};

export type RuleListProfileProps = {
  onDownload?: (name: string) => void;
  onProfileChange?: (field: keyof RuleListProfileModel, value: string) => void;
  options?: Options | null;
  profile?: RuleListProfileModel | null;
  updating?: boolean;
};

type PacProfileModel = Profile & {
  auth?: Record<string, any>;
  lastUpdate?: string;
  pacScript?: string;
  pacUrl?: string;
};

export type PacProfileProps = {
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

type FixedProfileProxyField = 'fallbackProxy' | 'proxyForHttp' | 'proxyForHttps';

type FixedProfileScheme = '' | 'http' | 'https';

type FixedProfileBypassCondition = {
  conditionType: 'BypassCondition';
  pattern: string;
};

type FixedProfileModel = Profile & {
  auth?: Record<string, any>;
  bypassList?: FixedProfileBypassCondition[];
  fallbackProxy?: ProxyEditor;
  proxyForHttp?: ProxyEditor;
  proxyForHttps?: ProxyEditor;
};

export type FixedProfileProps = {
  onBypassListChange?: (value: FixedProfileBypassCondition[]) => void;
  onEditProxyAuth?: (scheme: FixedProfileScheme) => void;
  onProxyChange?: (field: FixedProfileProxyField, value?: ProxyEditor, options?: {clearAuth?: boolean}) => void;
  profile?: FixedProfileModel | null;
};

export type SwitchAttachedProfileProps = {
  attached?: RuleListProfileModel | null;
  attachedRuleListError?: {message?: string} | null;
  onAttachNew?: () => void;
  onAttachedChange?: (field: keyof RuleListProfileModel, value: string) => void;
  onDownload?: (name: string) => void;
  updating?: boolean;
};

export type SwitchConditionHelpProps = {
  onClose?: () => void;
  show?: boolean;
  showConditionTypes?: number;
};

export type SwitchRulesHeaderProps = {
  editSource?: boolean;
  onSourceChange?: (code: string) => void;
  onToggleSource?: () => void;
  rules?: SwitchRuleModel[];
  source?: {
    code?: string;
    error?: {
      message?: string;
    };
    touched?: boolean;
  } | null;
};

export type SwitchRuleTableHeaderProps = {
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

export type SwitchRuleRowProps = {
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
  selectConditionDetailsIndex?: number;
  selectConditionDetailsKey?: number;
  showNotes?: boolean;
  weekdayList?: boolean[];
};

export type SwitchRuleRowsProps = {
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
  ruleKeys?: number[];
  rules?: SwitchRuleModel[];
  selectConditionDetailsIndex?: number;
  selectConditionDetailsKey?: number;
  showConditionTypes?: number;
  showNotes?: boolean;
  visibleRuleCount?: number;
};

export type SwitchRuleFooterProps = {
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
  showNotes?: boolean;
};

export type SwitchRulesSectionProps = SwitchConditionHelpProps & SwitchRulesHeaderProps & SwitchRuleTableHeaderProps & SwitchRuleRowsProps & SwitchRuleFooterProps & {
  loadRules?: boolean;
  onMoveRule?: (fromIndex: number, toIndex: number) => void;
};

export type SwitchProfileContentProps = SwitchRulesSectionProps & SwitchAttachedProfileProps;

type SwitchRulesSourceState = {
  code?: string;
  error?: {
    message?: string;
  } | null;
  touched?: boolean;
};

type SwitchSourceApplyResult = boolean | void | {
  ok?: boolean;
  source?: SwitchRulesSourceState | null;
};

export type SwitchProfileStatefulContentProps = Omit<
  SwitchProfileContentProps,
  'onAddNote' | 'onClose' | 'onSourceChange' | 'onToggleConditionHelp' | 'onToggleSource'
> & {
  confirmDeletion?: boolean;
  onAddNote?: (index: number) => void;
  onApplySource?: (source: SwitchRulesSourceState) => SwitchSourceApplyResult;
  onConditionHelpChange?: (shown: boolean) => void;
  onCreateSource?: () => SwitchRulesSourceState | null | undefined;
  onEditorModeChange?: (editSource: boolean) => void;
  onEditorStateChange?: (state: {editSource: boolean; source?: SwitchRulesSourceState | null}) => void;
  onRulesLoaded?: () => void;
  onSourceDraftChange?: (source: SwitchRulesSourceState) => void;
};

export type ProfileShellProps = {
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

export function ProfileShell({
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
      <div className="page-header profile-header">
        <div className="profile-title">
          <span className="profile-color-editor">
            {isVirtual ? (
              <span className="profile-color-editor-fake" style={{backgroundColor: color}} />
            ) : (
              <input type="color" value={color} onChange={(event) => onColorChange?.(event.currentTarget.value)} />
            )}
          </span>
          <h2 className="profile-name">{message('options_profileTabPrefix', 'Profile :: ')}{profile?.name}</h2>
        </div>
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
  return switchConditionTypesForMode(showConditionTypes);
}

function getJQuery() {
  return typeof jQuery === 'undefined' ? null : jQuery;
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
  autoSelectKey,
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
  autoSelectKey?: number;
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
  const cancelledAutoSelectKeyRef = useRef<number | null>(null);
  const [draft, setDraft] = useState(value);

  useLayoutEffect(() => {
    if (autoSelectKey == null || disabled || cancelledAutoSelectKeyRef.current === autoSelectKey) {
      return;
    }
    let cancelled = false;
    let frame: number | undefined;
    const startedAt = window.performance.now();
    const selectInput = (force = false) => {
      const input = inputRef.current;
      if (cancelled || cancelledAutoSelectKeyRef.current === autoSelectKey || !input) {
        return;
      }
      let selected = document.activeElement === input;
      try {
        selected = selected && input.selectionStart === 0 && input.selectionEnd === input.value.length;
      } catch (_error) {
        selected = selected && !force;
      }
      if (!force && selected) {
        return;
      }
      if (document.activeElement !== input) {
        input.focus({
          preventScroll: true
        });
      }
      try {
        if (typeof input.select === 'function') {
          input.select();
        }
      } catch (_error) {
        // Some input types do not expose text selection APIs.
      }
    };
    const cancelAutoSelect = () => {
      cancelledAutoSelectKeyRef.current = autoSelectKey;
    };
    const maintainSelection = () => {
      selectInput();
      if (!cancelled && cancelledAutoSelectKeyRef.current !== autoSelectKey && window.performance.now() - startedAt < 900) {
        frame = window.requestAnimationFrame(maintainSelection);
      }
    };
    document.addEventListener('keydown', cancelAutoSelect, true);
    document.addEventListener('mousedown', cancelAutoSelect, true);
    document.addEventListener('touchstart', cancelAutoSelect, true);
    selectInput(true);
    frame = window.requestAnimationFrame(maintainSelection);
    return () => {
      cancelled = true;
      document.removeEventListener('keydown', cancelAutoSelect, true);
      document.removeEventListener('mousedown', cancelAutoSelect, true);
      document.removeEventListener('touchstart', cancelAutoSelect, true);
      if (frame != null) {
        window.cancelAnimationFrame(frame);
      }
    };
  });

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(value);
    }
  }, [value]);

  function change(nextValue: string) {
    if (autoSelectKey != null) {
      cancelledAutoSelectKeyRef.current = autoSelectKey;
    }
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
  selectConditionDetailsIndex,
  selectConditionDetailsKey,
  showNotes = false,
  weekdayList = []
}: SwitchRuleRowProps) {
  const condition = rule.condition || {};
  const conditionType = condition.conditionType || '';
  const conditionGroups = groupedConditionTypes(conditionTypes);
  const isUrlConditionType = getUrlConditionTypeMap();
  const hasUrlIcon = !!isUrlConditionType[conditionType];
  const hasWarning = conditionHasWarning(condition);

  function formatIpCondition(condition: SwitchRuleCondition) {
    if (condition?.ip) {
      return OmegaPac.Conditions.str(condition).split(' ', 2)[1];
    }
    return '';
  }

  function changeField(field: string, value: any) {
    onConditionFieldChange?.(index, field, value);
  }

  function autoSelectKeyForConditionDetails() {
    return selectConditionDetailsIndex === index ? selectConditionDetailsKey : undefined;
  }

  function renderConditionDetails() {
    const autoSelectKey = autoSelectKeyForConditionDetails();
    switch (conditionType) {
      case 'FalseCondition':
        return condition.pattern ? (
          <span>
            <DraftInput
              autoSelectKey={autoSelectKey}
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
              autoSelectKey={autoSelectKey}
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
              autoSelectKey={autoSelectKey}
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
              autoSelectKey={autoSelectKey}
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
            autoSelectKey={autoSelectKey}
            value={condition.pattern || ''}
            required
            onChange={(value) => changeField('pattern', value)}
          />
        );
    }
  }

  return (
    <tr className="switch-rule-row" data-rule-index={index}>
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
  ruleKeys,
  rules = [],
  selectConditionDetailsIndex,
  selectConditionDetailsKey,
  showConditionTypes = 0,
  showNotes = false,
  visibleRuleCount = 0
}: SwitchRuleRowsProps) {
  const conditionTypes = conditionTypesForMode(showConditionTypes);
  const resultProfiles = resultProfilesFor(options, profile);

  return (
    <>
      {rules.slice(0, visibleRuleCount).map((rule, index) => (
        <SwitchRuleRow
          conditionTypes={conditionTypes}
          index={index}
          key={ruleKeys?.[index] ?? index}
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
          selectConditionDetailsIndex={selectConditionDetailsIndex}
          selectConditionDetailsKey={selectConditionDetailsKey}
          showNotes={showNotes}
          weekdayList={OmegaPac.Conditions.getWeekdayList(rule.condition) || []}
        />
      ))}
    </>
  );
}

export function UnsupportedProfile({profile}: UnsupportedProfileProps) {
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

function getRuleListFormats(): string[] {
  return OmegaPac.Profiles.ruleListFormats || [];
}

export function PacProfile({
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

const FIXED_PROFILE_SCHEMES: FixedProfileScheme[] = ['', 'http', 'https'];
const FIXED_PROFILE_PROXY_FIELDS: Record<FixedProfileScheme, FixedProfileProxyField> = {
  '': 'fallbackProxy',
  http: 'proxyForHttp',
  https: 'proxyForHttps'
};
const FIXED_PROFILE_SCHEME_DISP: Record<FixedProfileScheme, string | null> = {
  '': null,
  http: 'http://',
  https: 'https://'
};
const FIXED_PROFILE_DEFAULT_PORT: Record<string, number> = {
  http: 80,
  https: 443,
  socks4: 1080,
  socks5: 1080
};
const FIXED_PROFILE_PROTOCOLS = ['http', 'https', 'socks4', 'socks5'];

function fixedProfileOptionsForScheme(scheme: FixedProfileScheme) {
  const defaultLabel = scheme
    ? message('options_protocol_useDefault', 'Use default')
    : message('options_protocol_direct', 'Direct');
  return [
    {
      label: defaultLabel,
      value: ''
    },
    ...FIXED_PROFILE_PROTOCOLS.map((protocol) => ({
      label: protocol.toUpperCase(),
      value: protocol
    }))
  ];
}

function cloneProxyEditors(proxyEditors?: Record<string, ProxyEditor>) {
  const cloned: Record<string, ProxyEditor> = {};
  for (const scheme of Object.keys(proxyEditors || {})) {
    cloned[scheme] = {...proxyEditors?.[scheme]};
  }
  return cloned;
}

function fixedProfileEditors(profile?: FixedProfileModel | null) {
  const editors: Record<string, ProxyEditor> = {};
  for (const scheme of FIXED_PROFILE_SCHEMES) {
    const field = FIXED_PROFILE_PROXY_FIELDS[scheme];
    editors[scheme] = {...(profile?.[field] || {})};
  }
  return editors;
}

function fixedProfileBypassText(profile?: FixedProfileModel | null) {
  return (profile?.bypassList || []).map((item) => item.pattern).join('\n');
}

function fixedProfileBypassList(value: string): FixedProfileBypassCondition[] {
  return value.split(/\r?\n/).filter(Boolean).map((pattern) => ({
    conditionType: 'BypassCondition',
    pattern
  }));
}

function fixedProfileHasAdvancedProxy(editors: Record<string, ProxyEditor>) {
  return !!(editors.http?.scheme || editors.https?.scheme);
}

function fixedProfileAuthSupported(protocol?: string) {
  if (protocol === 'http' || protocol === 'https') {
    return true;
  }
  if (protocol === 'socks5') {
    return !!((window as any).browser?.proxy?.register);
  }
  return false;
}

function fixedProfileAuthActive(profile: FixedProfileModel | null | undefined, scheme: FixedProfileScheme) {
  return !!profile?.auth?.[FIXED_PROFILE_PROXY_FIELDS[scheme]];
}

export function FixedProfileContent({
  profile,
  onBypassListChange,
  onEditProxyAuth,
  onProxyChange
}: FixedProfileProps) {
  const initialEditors = fixedProfileEditors(profile);
  const [draftEditors, setDraftEditors] = useState<Record<string, ProxyEditor>>(() => cloneProxyEditors(initialEditors));
  const [draftBypassList, setDraftBypassList] = useState(fixedProfileBypassText(profile));
  const [showAdvanced, setShowAdvanced] = useState(() => fixedProfileHasAdvancedProxy(initialEditors));
  const previousProfileNameRef = useRef(profile?.name);

  useEffect(() => {
    const editors = fixedProfileEditors(profile);
    const hasAdvancedProxy = fixedProfileHasAdvancedProxy(editors);
    const profileChanged = previousProfileNameRef.current !== profile?.name;
    previousProfileNameRef.current = profile?.name;
    setDraftEditors(cloneProxyEditors(editors));
    if (profileChanged) {
      setShowAdvanced(hasAdvancedProxy);
    } else if (hasAdvancedProxy) {
      setShowAdvanced(true);
    }
  }, [
    profile?.name,
    profile?.fallbackProxy?.scheme,
    profile?.fallbackProxy?.host,
    profile?.fallbackProxy?.port,
    profile?.proxyForHttp?.scheme,
    profile?.proxyForHttp?.host,
    profile?.proxyForHttp?.port,
    profile?.proxyForHttps?.scheme,
    profile?.proxyForHttps?.host,
    profile?.proxyForHttps?.port
  ]);

  useEffect(() => {
    setDraftBypassList(fixedProfileBypassText(profile));
  }, [profile?.name, profile?.bypassList]);

  function commitProxyEditor(
    scheme: FixedProfileScheme,
    editor: ProxyEditor,
    previousEditor: ProxyEditor,
    editors: Record<string, ProxyEditor>
  ) {
    const field = FIXED_PROFILE_PROXY_FIELDS[scheme];
    const nextEditor = {...editor};
    const clearAuth = !fixedProfileAuthSupported(nextEditor.scheme);

    if (!nextEditor.scheme) {
      if (!scheme) {
        editors[scheme] = {};
      }
      onProxyChange?.(field, undefined, {clearAuth});
      return;
    }

    if (!previousEditor.scheme) {
      const defaultEditor = editors[''] || {};
      if (nextEditor.scheme === defaultEditor.scheme && nextEditor.port == null) {
        nextEditor.port = defaultEditor.port;
      }
      if (nextEditor.port == null) {
        nextEditor.port = FIXED_PROFILE_DEFAULT_PORT[nextEditor.scheme];
      }
      if (nextEditor.host == null) {
        nextEditor.host = defaultEditor.host || 'example.com';
      }
    }

    editors[scheme] = nextEditor;
    onProxyChange?.(field, nextEditor, {clearAuth});
  }

  function changeProxyEditor(scheme: FixedProfileScheme, field: keyof ProxyEditor, value?: string | number) {
    const nextValue = field === 'scheme' && value === '' ? undefined : value;
    const previousEditor = draftEditors[scheme] || {};
    const nextEditor = {
      ...previousEditor,
      [field]: nextValue
    };
    if (typeof nextValue === 'undefined') {
      delete nextEditor[field];
    }
    const nextEditors = {
      ...draftEditors,
      [scheme]: nextEditor
    };
    commitProxyEditor(scheme, nextEditor, previousEditor, nextEditors);
    setDraftEditors({...nextEditors});
  }

  const defaultEditor = draftEditors[''] || {};
  const visibleSchemes = FIXED_PROFILE_SCHEMES.filter((scheme) => scheme === '' || showAdvanced);

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
                    <td>{FIXED_PROFILE_SCHEME_DISP[scheme] || message('options_scheme_default', 'Default')}</td>
                    <td>
                      <select
                        className="form-control"
                        value={editor.scheme || ''}
                        onChange={(event) => changeProxyEditor(scheme, 'scheme', event.currentTarget.value)}
                      >
                        {fixedProfileOptionsForScheme(scheme).map((option) => (
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
                        className={`btn btn-xs proxy-auth-toggle ${fixedProfileAuthActive(profile, scheme) ? 'btn-success' : 'btn-default'}`}
                        disabled={!hasScheme}
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
                    <button type="button" className="btn btn-link" onClick={() => setShowAdvanced(true)}>
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
          onBlur={() => onBypassListChange?.(fixedProfileBypassList(draftBypassList))}
        />
      </section>
    </div>
  );
}

export function SwitchAttachedProfile({
  attached,
  attachedRuleListError,
  onAttachNew,
  onAttachedChange,
  onDownload,
  updating = false
}: SwitchAttachedProfileProps) {
  const formattedLastUpdate = formatMediumDate(attached?.lastUpdate);
  const ruleListFormats = getRuleListFormats();
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

export function SwitchConditionHelp({
  onClose,
  show = false,
  showConditionTypes = 0
}: SwitchConditionHelpProps) {
  const [expandedId, setExpandedId] = useState(0);
  const groups = showConditionTypes === 0
    ? getBasicConditionGroups()
    : getAdvancedConditionGroups();
  const isUrlConditionType = getUrlConditionTypeMap();

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

export function SwitchRulesHeader({
  editSource = false,
  onSourceChange,
  onToggleSource,
  rules = [],
  source
}: SwitchRulesHeaderProps) {
  const [sourceCode, setSourceCode] = useState(source?.code || '');
  const isUrlConditionType = getUrlConditionTypeMap();
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

export function SwitchRuleTableHeader({
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

export function SwitchRuleFooter({
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
  showNotes = false
}: SwitchRuleFooterProps) {
  const resultProfiles = resultProfilesFor(options, profile);
  const ruleListIcon = PROFILE_ICONS.RuleListProfile || 'glyphicon-list';

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

export function SwitchRulesSection({
  attached,
  attachedOptions,
  editSource = false,
  loadRules = false,
  onAddNote,
  onAddRule,
  onAttachedEnabledChange,
  onAttachedMatchProfileChange,
  onCloneRule,
  onClose,
  onConditionFieldChange,
  onConditionReplace,
  onConditionTypeChange,
  onDefaultProfileChange,
  onIpConditionInputChange,
  onMoveRule,
  onNoteChange,
  onProfileChange,
  onRemoveAttached,
  onRemoveRule,
  onResetRules,
  onSourceChange,
  onToggleConditionHelp,
  onToggleSource,
  onWeekdayChange,
  options,
  profile,
  rules = [],
  show = false,
  showConditionTypes = 0,
  showNotes = false,
  source,
  visibleRuleCount = 0
}: SwitchRulesSectionProps) {
  const rulesBodyRef = useRef<HTMLTableSectionElement>(null);
  const moveRuleRef = useRef(onMoveRule);
  const previousProfileNameRef = useRef<string | undefined>(undefined);
  const nextCloneSelectKeyRef = useRef(1);
  const nextRuleKeyRef = useRef(1);
  const ruleKeyProfileNameRef = useRef<string | undefined>(undefined);
  const ruleKeysRef = useRef<number[]>([]);
  const pendingInsertedRuleIndexRef = useRef<number | null>(null);
  const pendingRemovedRuleIndexRef = useRef<number | null>(null);
  const [cloneSelectTarget, setCloneSelectTarget] = useState<{expectedLength: number; index: number; key: number} | null>(null);
  const [renderedRuleCount, setRenderedRuleCount] = useState(0);

  useEffect(() => {
    moveRuleRef.current = onMoveRule;
  }, [onMoveRule]);

  function createRuleKey() {
    return nextRuleKeyRef.current++;
  }

  function syncRuleKeys() {
    const profileName = profile?.name;
    const profileChanged = ruleKeyProfileNameRef.current !== profileName;
    let keys = ruleKeysRef.current;

    if (profileChanged) {
      ruleKeysRef.current = rules.map(() => createRuleKey());
      keys = ruleKeysRef.current;
      pendingInsertedRuleIndexRef.current = null;
      pendingRemovedRuleIndexRef.current = null;
    } else {
      while (keys.length < rules.length) {
        const index = Math.max(0, Math.min(pendingInsertedRuleIndexRef.current ?? keys.length, keys.length));
        keys.splice(index, 0, createRuleKey());
        pendingInsertedRuleIndexRef.current = null;
      }
      if (keys.length > rules.length) {
        const index = Math.max(0, Math.min(pendingRemovedRuleIndexRef.current ?? rules.length, keys.length - 1));
        keys.splice(index, keys.length - rules.length);
        pendingRemovedRuleIndexRef.current = null;
      }
    }

    ruleKeyProfileNameRef.current = profileName;
    return ruleKeysRef.current;
  }

  function addRule() {
    pendingInsertedRuleIndexRef.current = rules.length;
    onAddRule?.();
  }

  function cloneRule(index: number) {
    const targetIndex = index + 1;
    pendingInsertedRuleIndexRef.current = targetIndex;
    setCloneSelectTarget({
      expectedLength: rules.length + 1,
      key: nextCloneSelectKeyRef.current++,
      index: targetIndex
    });
    setRenderedRuleCount((current) => Math.max(current, targetIndex + 1));
    onCloneRule?.(index);
  }

  function moveRule(fromIndex: number, toIndex: number) {
    const keys = ruleKeysRef.current;
    if (fromIndex >= 0 && fromIndex < keys.length && toIndex >= 0 && toIndex < keys.length) {
      const key = keys.splice(fromIndex, 1)[0];
      keys.splice(toIndex, 0, key);
    }
    moveRuleRef.current?.(fromIndex, toIndex);
  }

  function removeRule(index: number) {
    pendingRemovedRuleIndexRef.current = index;
    onRemoveRule?.(index);
  }

  useEffect(() => {
    if (!loadRules || editSource) {
      previousProfileNameRef.current = profile?.name;
      setRenderedRuleCount(0);
      return;
    }
    setRenderedRuleCount((current) => {
      const profileChanged = previousProfileNameRef.current !== profile?.name;
      previousProfileNameRef.current = profile?.name;
      if (profileChanged || current === 0 || current > rules.length) {
        return Math.min(INITIAL_SWITCH_RULE_BATCH_SIZE, rules.length);
      }
      return current;
    });
  }, [editSource, loadRules, profile?.name, rules.length]);

  useEffect(() => {
    if (!loadRules || editSource || renderedRuleCount >= rules.length) {
      return;
    }
    let timeout: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      timeout = window.setTimeout(() => {
        setRenderedRuleCount((current) => Math.min(rules.length, current + SWITCH_RULE_BATCH_SIZE));
      }, SWITCH_RULE_BATCH_DELAY_MS);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (timeout != null) {
        window.clearTimeout(timeout);
      }
    };
  }, [editSource, loadRules, renderedRuleCount, rules.length]);

  useEffect(() => {
    const body = rulesBodyRef.current;
    const jq = getJQuery();
    if (!body || editSource || !loadRules || !(jq as any)?.fn?.sortable) {
      return;
    }
    const sortableBody = jq(body);
    let sortStartIndex = 0;
    sortableBody.sortable({
      handle: '.sort-bar',
      tolerance: 'pointer',
      axis: 'y',
      forceHelperSize: true,
      forcePlaceholderSize: true,
      containment: 'parent',
      start(_event: any, ui: any) {
        sortStartIndex = ui.item.index();
      },
      stop(_event: any, ui: any) {
        const sortEndIndex = ui.item.index();
        if (sortStartIndex !== sortEndIndex) {
          moveRule(sortStartIndex, sortEndIndex);
        }
      }
    });
    return () => {
      if (sortableBody.data('ui-sortable')) {
        sortableBody.sortable('destroy');
      }
    };
  }, [editSource, loadRules]);

  useEffect(() => {
    const body = rulesBodyRef.current;
    const jq = getJQuery();
    if (!body || !jq) {
      return;
    }
    const sortableBody = jq(body);
    if (sortableBody.data('ui-sortable')) {
      sortableBody.sortable('refresh');
    }
  }, [rules, renderedRuleCount]);

  useEffect(() => {
    if (!cloneSelectTarget || rules.length < cloneSelectTarget.expectedLength) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setCloneSelectTarget((current) => current?.key === cloneSelectTarget.key ? null : current);
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [cloneSelectTarget, rules.length]);

  const initialVisibleRuleCount = Math.min(INITIAL_SWITCH_RULE_BATCH_SIZE, rules.length);
  const displayRuleCount = !editSource && loadRules && renderedRuleCount === 0 ? initialVisibleRuleCount : renderedRuleCount;
  const reserveInitialRulesSpace = !editSource && rules.length > 0 && displayRuleCount < initialVisibleRuleCount;
  const rulesWrapperMinHeight = reserveInitialRulesSpace ? 96 + initialVisibleRuleCount * 42 : undefined;
  const ruleKeys = syncRuleKeys();
  const activeCloneSelectTarget = cloneSelectTarget &&
    rules.length >= cloneSelectTarget.expectedLength &&
    cloneSelectTarget.index < displayRuleCount &&
    cloneSelectTarget.index < rules.length
    ? cloneSelectTarget
    : null;

  return (
    <>
      <SwitchConditionHelp
        onClose={onClose}
        show={show}
        showConditionTypes={showConditionTypes}
      />
      <section className="settings-group">
        <div className="switch-rules-header-host">
          <SwitchRulesHeader
            editSource={editSource}
            onSourceChange={onSourceChange}
            onToggleSource={onToggleSource}
            rules={rules}
            source={source}
          />
        </div>
        {!editSource && (
          <div
            className={`table-responsive switch-rules-wrapper ${!loadRules || reserveInitialRulesSpace ? 'switch-rules-wrapper-loading' : ''}`}
            style={rulesWrapperMinHeight ? {minHeight: `${rulesWrapperMinHeight}px`} : undefined}
          >
            {loadRules && (
              <table className="switch-rules table table-bordered table-condensed width-limit-xl">
                <thead>
                  <SwitchRuleTableHeader
                    onToggleConditionHelp={onToggleConditionHelp}
                    showNotes={showNotes}
                  />
                </thead>
                <tbody ref={rulesBodyRef}>
                  <SwitchRuleRows
                    onAddNote={onAddNote}
                    onCloneRule={cloneRule}
                    onConditionFieldChange={onConditionFieldChange}
                    onConditionReplace={onConditionReplace}
                    onConditionTypeChange={onConditionTypeChange}
                    onIpConditionInputChange={onIpConditionInputChange}
                    onNoteChange={onNoteChange}
                    onProfileChange={onProfileChange}
                    onRemoveRule={removeRule}
                    onWeekdayChange={onWeekdayChange}
                    options={options}
                    profile={profile}
                    ruleKeys={ruleKeys}
                    rules={rules}
                    selectConditionDetailsIndex={activeCloneSelectTarget?.index}
                    selectConditionDetailsKey={activeCloneSelectTarget?.key}
                    showConditionTypes={showConditionTypes}
                    showNotes={showNotes}
                    visibleRuleCount={displayRuleCount}
                  />
                </tbody>
                <tbody>
                  <SwitchRuleFooter
                    attached={attached}
                    attachedOptions={attachedOptions}
                    onAddRule={addRule}
                    onAttachedEnabledChange={onAttachedEnabledChange}
                    onAttachedMatchProfileChange={onAttachedMatchProfileChange}
                    onDefaultProfileChange={onDefaultProfileChange}
                    onRemoveAttached={onRemoveAttached}
                    onResetRules={onResetRules}
                    options={options}
                    profile={profile}
                    showNotes={showNotes}
                  />
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </>
  );
}

export function SwitchProfileContent(props: SwitchProfileContentProps) {
  return (
    <>
      <SwitchRulesSection {...props} />
      <SwitchAttachedProfile
        attached={props.attached}
        attachedRuleListError={props.attachedRuleListError}
        onAttachNew={props.onAttachNew}
        onAttachedChange={props.onAttachedChange}
        onDownload={props.onDownload}
        updating={props.updating}
      />
    </>
  );
}

function sourceErrorMessage(source?: SwitchRulesSourceState | null) {
  return source?.error?.message || '';
}

function cloneSourceState(source?: SwitchRulesSourceState | null): SwitchRulesSourceState | undefined {
  if (!source) {
    return undefined;
  }
  return {
    ...source,
    error: source.error ? {...source.error} : source.error
  };
}

type SwitchProfileConfirmState =
  | {
    index: number;
    kind: 'ruleRemove';
    rule: SwitchRuleModel;
  }
  | {
    kind: 'ruleReset';
  }
  | {
    kind: 'deleteAttached';
  }
  | null;

function SwitchProfileModalFrame({
  children,
  onDismiss
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <>
      <div className="modal-backdrop fade in" />
      <div
        className="modal fade in"
        role="dialog"
        style={{display: 'block'}}
        tabIndex={-1}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onDismiss();
          }
        }}
      >
        <div className="modal-dialog">
          <div className="modal-content">{children}</div>
        </div>
      </div>
    </>
  );
}

export function SwitchProfileStatefulContent({
  confirmDeletion = true,
  editSource: externalEditSource = false,
  onAddNote,
  onAddRule,
  onApplySource,
  onAttachedChange,
  onAttachedEnabledChange,
  onAttachedMatchProfileChange,
  onCloneRule,
  onConditionFieldChange,
  onConditionHelpChange,
  onConditionReplace,
  onConditionTypeChange,
  onCreateSource,
  onDefaultProfileChange,
  onEditorModeChange,
  onEditorStateChange,
  onIpConditionInputChange,
  onMoveRule,
  onNoteChange,
  onProfileChange,
  onRemoveAttached,
  onRemoveRule,
  onResetRules,
  onRulesLoaded,
  onSourceDraftChange,
  onWeekdayChange,
  profile,
  rules = [],
  show: externalConditionHelpShown = false,
  showNotes: externalShowNotes = false,
  source: externalSource,
  ...props
}: SwitchProfileStatefulContentProps) {
  const [conditionHelpShown, setConditionHelpShown] = useState(!!externalConditionHelpShown);
  const [editSource, setEditSource] = useState(!!externalEditSource);
  const [source, setSource] = useState<SwitchRulesSourceState | undefined>(() => cloneSourceState(externalSource));
  const [notesForcedVisible, setNotesForcedVisible] = useState(!!externalShowNotes || hasNotes(rules));
  const [confirmState, setConfirmState] = useState<SwitchProfileConfirmState>(null);
  const [, setLocalRevision] = useState(0);
  const externalSourceError = sourceErrorMessage(externalSource);

  useEffect(() => {
    setConditionHelpShown(!!externalConditionHelpShown);
  }, [externalConditionHelpShown]);

  useEffect(() => {
    setEditSource(!!externalEditSource);
  }, [externalEditSource]);

  useEffect(() => {
    setSource(cloneSourceState(externalSource));
  }, [externalSource?.code, externalSource?.touched, externalSourceError]);

  useEffect(() => {
    if (externalShowNotes || hasNotes(rules)) {
      setNotesForcedVisible(true);
    }
  }, [externalShowNotes, rules]);

  function forceLocalRender() {
    setLocalRevision((revision) => revision + 1);
  }

  function runAction<T extends any[]>(action: ((...args: T) => void) | undefined, ...args: T) {
    action?.(...args);
    forceLocalRender();
  }

  function updateConditionHelp(shown: boolean) {
    setConditionHelpShown(shown);
    onConditionHelpChange?.(shown);
  }

  function updateEditorState(nextEditSource: boolean, nextSource?: SwitchRulesSourceState | null) {
    onEditorStateChange?.({
      editSource: nextEditSource,
      source: nextSource || null
    });
  }

  function openSourceEditor() {
    const nextSource = cloneSourceState(onCreateSource?.()) || {
      code: composeSource(profile as any, props.attachedOptions?.defaultProfileName)
    };
    setSource(nextSource);
    setEditSource(true);
    updateEditorState(true, nextSource);
    onEditorModeChange?.(true);
  }

  function closeSourceEditor() {
    const currentSource = source || {code: ''};
    const result = onApplySource?.(currentSource);
    let ok = true;
    let nextSource = currentSource;

    if (result === false) {
      ok = false;
    } else if (result && typeof result === 'object') {
      ok = result.ok !== false;
      if (result.source !== undefined) {
        nextSource = cloneSourceState(result.source) || currentSource;
      }
    }

    if (!ok) {
      setSource(nextSource);
      setEditSource(true);
      updateEditorState(true, nextSource);
      onEditorModeChange?.(true);
      forceLocalRender();
      return;
    }

    setSource(undefined);
    setEditSource(false);
    updateEditorState(false, null);
    onEditorModeChange?.(false);
    onRulesLoaded?.();
    forceLocalRender();
  }

  function toggleSourceEditor() {
    if (editSource) {
      closeSourceEditor();
    } else {
      openSourceEditor();
    }
  }

  function updateSourceDraft(code: string) {
    const nextSource = {
      ...(source || {}),
      code,
      touched: true
    };
    setSource(nextSource);
    if (onSourceDraftChange) {
      onSourceDraftChange(nextSource);
    } else {
      updateEditorState(editSource, nextSource);
    }
  }

  function showRuleNotes(index: number) {
    setNotesForcedVisible(true);
    onAddNote?.(index);
  }

  function requestRemoveAttached() {
    if (confirmDeletion && props.attached) {
      setConfirmState({kind: 'deleteAttached'});
      return;
    }
    runAction(onRemoveAttached);
  }

  function requestRemoveRule(index: number) {
    if (confirmDeletion) {
      setConfirmState({
        index,
        kind: 'ruleRemove',
        rule: rules[index]
      });
      return;
    }
    runAction(onRemoveRule, index);
  }

  function requestResetRules() {
    setConfirmState({kind: 'ruleReset'});
  }

  function confirmModalProps() {
    if (!confirmState) {
      return null;
    }
    switch (confirmState.kind) {
      case 'deleteAttached':
        return {
          attached: props.attached,
          kind: 'deleteAttached' as const
        };
      case 'ruleRemove':
        return {
          kind: 'ruleRemove' as const,
          rule: confirmState.rule,
          ruleProfile: profileByName(props.options, confirmState.rule?.profileName || '')
        };
      case 'ruleReset':
        return {
          kind: 'ruleReset' as const,
          ruleProfile: profileByName(props.options, props.attachedOptions?.defaultProfileName || '')
        };
    }
  }

  function closeConfirm() {
    if (!confirmState) {
      return;
    }
    switch (confirmState.kind) {
      case 'deleteAttached':
        runAction(onRemoveAttached);
        break;
      case 'ruleRemove':
        runAction(onRemoveRule, confirmState.index);
        break;
      case 'ruleReset':
        runAction(onResetRules);
        break;
    }
    setConfirmState(null);
  }

  const showNotes = notesForcedVisible || hasNotes(rules);
  const activeConfirmModalProps = confirmModalProps();

  return (
    <>
      <SwitchProfileContent
        {...props}
        editSource={editSource}
        onAddNote={showRuleNotes}
        onAddRule={() => runAction(onAddRule)}
        onAttachedChange={(field, value) => runAction(onAttachedChange, field, value)}
        onAttachedEnabledChange={(enabled) => runAction(onAttachedEnabledChange, enabled)}
        onAttachedMatchProfileChange={(name) => runAction(onAttachedMatchProfileChange, name)}
        onCloneRule={(index) => runAction(onCloneRule, index)}
        onClose={() => updateConditionHelp(false)}
        onConditionFieldChange={(index, field, value) => runAction(onConditionFieldChange, index, field, value)}
        onConditionReplace={(index, condition) => runAction(onConditionReplace, index, condition)}
        onConditionTypeChange={(index, type) => runAction(onConditionTypeChange, index, type)}
        onDefaultProfileChange={(name) => runAction(onDefaultProfileChange, name)}
        onIpConditionInputChange={(index, value) => runAction(onIpConditionInputChange, index, value)}
        onMoveRule={(fromIndex, toIndex) => runAction(onMoveRule, fromIndex, toIndex)}
        onNoteChange={(index, note) => runAction(onNoteChange, index, note)}
        onProfileChange={(index, name) => runAction(onProfileChange, index, name)}
        onRemoveAttached={requestRemoveAttached}
        onRemoveRule={requestRemoveRule}
        onResetRules={requestResetRules}
        onSourceChange={updateSourceDraft}
        onToggleConditionHelp={() => updateConditionHelp(!conditionHelpShown)}
        onToggleSource={toggleSourceEditor}
        onWeekdayChange={(index, dayIndex, selected) => runAction(onWeekdayChange, index, dayIndex, selected)}
        profile={profile}
        rules={rules}
        show={conditionHelpShown}
        showNotes={showNotes}
        source={source}
      />
      {activeConfirmModalProps && (
        <SwitchProfileModalFrame onDismiss={() => setConfirmState(null)}>
          <ConfirmModal
            {...activeConfirmModalProps}
            options={props.options}
            onClose={closeConfirm}
            onDismiss={() => setConfirmState(null)}
          />
        </SwitchProfileModalFrame>
      )}
    </>
  );
}

export function RuleListProfile({
  onDownload,
  onProfileChange,
  options,
  profile,
  updating = false
}: RuleListProfileProps) {
  const resultProfiles = resultProfilesFor(options, profile);
  const ruleListFormats = getRuleListFormats();
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

export function VirtualProfile({onReplaceProfile, onTargetChange, options, profile}: VirtualProfileProps) {
  const [targetName, setTargetName] = useState(profile?.defaultProfileName || '');
  useEffect(() => {
    setTargetName(profile?.defaultProfileName || '');
  }, [profile?.defaultProfileName]);
  const targetProfile = profileByName(options, targetName);
  const targetProfiles = resultProfilesFor(options, profile);

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
