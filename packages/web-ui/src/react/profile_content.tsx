import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {ConfirmModal} from './confirm_modals';
import {Options} from './options_client';
import {message} from './options_client';
import {richMessage} from './rich_message';
import {Profile, ProfileInline, ProfileSelect, PROFILE_ICONS, isVirtualProfile, profileByName, resultProfilesFor} from './profile_widgets';
import {
  conditionHasWarning,
  composeSource,
  getAdvancedConditionGroups,
  getBasicConditionGroups,
  getUrlConditionTypeMap,
  hasNotes
} from './switch_profile_runtime';
import type {
  ConditionTypeOption,
  NamedSwitchProfileModel,
  SwitchRule,
  SwitchRuleCondition,
  SwitchRuleEditableConditionField,
  SwitchRuleEditableConditionType,
  SwitchRuleEditableConditionValue,
  SwitchRuleSourceState
} from './switch_profile_runtime';
import {
  FIXED_PROFILE_DEFAULT_PORT,
  FIXED_PROFILE_PROTOCOLS,
  FIXED_PROFILE_PROXY_FIELDS,
  FIXED_PROFILE_SCHEME_DISP,
  FIXED_PROFILE_SCHEMES,
  cloneProxyEditors,
  cloneSourceState,
  conditionTypeFromSelectValue,
  conditionTypesForMode,
  fixedProfileAuthActive,
  fixedProfileAuthSupported,
  fixedProfileBypassList,
  fixedProfileBypassListEquals,
  fixedProfileBypassText,
  fixedProfileEditors,
  fixedProfileHasAdvancedProxy,
  formatMediumDate,
  getRuleListFormats,
  groupedConditionTypes,
  isFixedProfileProxyProtocol,
  moveIndex,
  normalizeColor,
  pacProfileUrlState
} from './profile_content_logic';
import type {
  FixedProfileBypassCondition,
  FixedProfileProxyChangeOptions,
  FixedProfileProxyEditorField,
  FixedProfileProxyEditors,
  FixedProfileProxyField,
  FixedProfileScheme,
  NamedFixedProfileModel,
  NamedPacProfileModel,
  NamedRuleListProfileModel,
  NamedVirtualProfileModel,
  PacProfileField,
  RuleListProfileAttachedField,
  ProfileType,
  ProxyEditor,
  RuleListProfileField,
  RuleListProfileSourceField
} from './profile_types';

const INITIAL_SWITCH_RULE_BATCH_SIZE = 15;
const SWITCH_RULE_BATCH_SIZE = 8;
const SWITCH_RULE_BATCH_DELAY_MS = 32;

export type UnsupportedProfileProps = {
  profile?: {
    profileType?: ProfileType;
  } | null;
};

export type VirtualProfileProps = {
  onReplaceProfile?: (fromName: string, toName: string) => void;
  onTargetChange?: (name: string) => void;
  options?: Options | null;
  profile: NamedVirtualProfileModel;
};

export type RuleListProfileProps = {
  onDownload?: (name: string) => void;
  onProfileChange?: (field: RuleListProfileField, value: NamedRuleListProfileModel[RuleListProfileField]) => void;
  options?: Options | null;
  profile: NamedRuleListProfileModel;
  updating?: boolean;
};

export type PacProfileProps = {
  onDownload?: (name: string) => void;
  onEditProxyAuth?: () => void;
  onProfileChange?: (field: PacProfileField, value: string) => void;
  pacProfilesUnsupported?: boolean;
  profile: NamedPacProfileModel;
  referenced?: boolean;
  updating?: boolean;
};

export type FixedProfileProps = {
  onBypassListChange?: (value: FixedProfileBypassCondition[]) => void;
  onEditProxyAuth?: (scheme: FixedProfileScheme) => void;
  onProxyChange?: (field: FixedProfileProxyField, value?: ProxyEditor, options?: FixedProfileProxyChangeOptions) => void;
  profile: NamedFixedProfileModel;
};

export type SwitchAttachedProfileProps = {
  attached?: NamedRuleListProfileModel | null;
  attachedRuleListError?: {message?: string} | null;
  onAttachNew?: () => void;
  onAttachedChange?: (field: RuleListProfileAttachedField, value: NamedRuleListProfileModel[RuleListProfileAttachedField]) => void;
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
  rules?: SwitchRule[];
  source?: SwitchRuleSourceState | null;
};

export type SwitchRuleTableHeaderProps = {
  onToggleConditionHelp?: () => void;
  showNotes?: boolean;
};

export type SwitchRuleRowProps = {
  cellWidths?: number[];
  conditionTypes?: ConditionTypeOption[];
  isDragging?: boolean;
  index: number;
  onAddNote?: (index: number) => void;
  onCloneRule?: (index: number) => void;
  onConditionFieldChange?: (index: number, field: SwitchRuleEditableConditionField, value: SwitchRuleEditableConditionValue) => void;
  onConditionReplace?: (index: number, condition: SwitchRuleCondition) => void;
  onConditionTypeChange?: (index: number, type: SwitchRuleEditableConditionType) => void;
  onIpConditionInputChange?: (index: number, value: string) => void;
  onNoteChange?: (index: number, note: string) => void;
  onProfileChange?: (index: number, name: string) => void;
  onRemoveRule?: (index: number) => void;
  onSortPointerDown?: (index: number, event: React.PointerEvent<HTMLTableCellElement>) => void;
  onWeekdayChange?: (index: number, dayIndex: number, selected: boolean) => void;
  options?: Options | null;
  resultProfiles?: Profile[];
  rule: SwitchRule;
  selectConditionDetailsIndex?: number;
  selectConditionDetailsKey?: number;
  showNotes?: boolean;
  weekdayList?: boolean[];
};

export type SwitchRuleRowsProps = {
  draggingRuleIndex?: number;
  onAddNote?: (index: number) => void;
  onCloneRule?: (index: number) => void;
  onConditionFieldChange?: (index: number, field: SwitchRuleEditableConditionField, value: SwitchRuleEditableConditionValue) => void;
  onConditionReplace?: (index: number, condition: SwitchRuleCondition) => void;
  onConditionTypeChange?: (index: number, type: SwitchRuleEditableConditionType) => void;
  onIpConditionInputChange?: (index: number, value: string) => void;
  onNoteChange?: (index: number, note: string) => void;
  onProfileChange?: (index: number, name: string) => void;
  onRemoveRule?: (index: number) => void;
  onSortPointerDown?: (index: number, event: React.PointerEvent<HTMLTableCellElement>) => void;
  onWeekdayChange?: (index: number, dayIndex: number, selected: boolean) => void;
  options?: Options | null;
  profile: NamedSwitchProfileModel;
  ruleKeys?: number[];
  rules?: SwitchRule[];
  selectConditionDetailsIndex?: number;
  selectConditionDetailsKey?: number;
  showConditionTypes?: number;
  showNotes?: boolean;
  visualRuleIndices?: number[];
  visibleRuleCount?: number;
};

export type SwitchRuleFooterProps = {
  attached?: NamedRuleListProfileModel | null;
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
  profile: NamedSwitchProfileModel;
  showNotes?: boolean;
};

export type SwitchRulesSectionProps = SwitchConditionHelpProps &
  SwitchRulesHeaderProps &
  SwitchRuleTableHeaderProps &
  SwitchRuleRowsProps &
  SwitchRuleFooterProps & {
    loadRules?: boolean;
    onMoveRule?: (fromIndex: number, toIndex: number) => void;
  };

export type SwitchProfileContentProps = SwitchRulesSectionProps & SwitchAttachedProfileProps;

type SwitchSourceApplyResult =
  | boolean
  | void
  | {
      ok?: boolean;
      source?: SwitchRuleSourceState | null;
    };

export type SwitchProfileStatefulContentProps = Omit<
  SwitchProfileContentProps,
  'onAddNote' | 'onClose' | 'onSourceChange' | 'onToggleConditionHelp' | 'onToggleSource'
> & {
  confirmDeletion?: boolean;
  onAddNote?: (index: number) => void;
  onApplySource?: (source: SwitchRuleSourceState) => SwitchSourceApplyResult;
  onConditionHelpChange?: (shown: boolean) => void;
  onCreateSource?: () => SwitchRuleSourceState | null | undefined;
  onEditorModeChange?: (editSource: boolean) => void;
  onEditorStateChange?: (state: {editSource: boolean; source?: SwitchRuleSourceState | null}) => void;
  onRulesLoaded?: () => void;
  onSourceDraftChange?: (source: SwitchRuleSourceState) => void;
};

export type ProfileShellProps = {
  exportRuleListAvailable?: boolean;
  exportRuleListWarning?: boolean;
  onColorChange?: (color: string) => void;
  onDelete?: () => void;
  onExportRuleList?: () => void;
  onExportScript?: () => void;
  onPopupHiddenChange?: (hidden: boolean) => void;
  onRename?: () => void;
  profile: Profile & {
    hiddenInPopup?: boolean;
    syncError?: {
      reason?: string;
    };
    syncOptions?: string;
  };
  profileColor?: string;
  scriptable?: boolean;
};

export function ProfileShell({
  exportRuleListAvailable = false,
  exportRuleListWarning = false,
  onColorChange,
  onDelete,
  onExportRuleList,
  onExportScript,
  onPopupHiddenChange,
  onRename,
  profile,
  profileColor,
  scriptable = false
}: ProfileShellProps) {
  const color = normalizeColor(profileColor || profile.color);
  const isVirtual = isVirtualProfile(profile);

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
          <h2 className="profile-name">
            {message('options_profileTabPrefix', 'Profile :: ')}
            {profile.name}
          </h2>
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
      {!profile.builtin && (
        <section className="settings-group profile-options">
          <h3>{message('options_group_profileOptions', 'Profile Options')}</h3>
          <label className="profile-switch-label">
            <input
              type="checkbox"
              role="switch"
              checked={!!profile.hiddenInPopup}
              onChange={(event) => onPopupHiddenChange?.(event.currentTarget.checked)}
            />
            <span className="profile-switch" aria-hidden="true">
              <span className="profile-switch-knob" />
            </span>
            <span>{message('options_hideFromPopupMenu', 'Hide from popup menu')}</span>
          </label>
          <p className="help-block profile-switch-help">
            {message(
              'options_hideFromPopupMenuHelp',
              'When enabled, this profile is moved to the hidden profiles section in the popup menu.'
            )}
          </p>
        </section>
      )}
      {profile.syncOptions === 'disabled' && (
        <section className="settings-group">
          {!profile.syncError && (
            <p className="alert alert-info width-limit">
              <span className="glyphicon glyphicon-info-sign" /> Syncing is disabled for this profile.
            </p>
          )}
          {profile.syncError && (
            <p className="alert alert-danger width-limit">
              <span className="glyphicon glyphicon-remove" />{' '}
              {message(`options_profileSyncDisabled_${profile.syncError.reason}`, profile.syncError.reason || '')}
            </p>
          )}
        </section>
      )}
    </>
  );
}

type RuleDragState = {
  cellWidths: number[];
  clientY: number;
  pointerId: number;
  pointerOffsetY: number;
  rowLeft: number;
  rowWidth: number;
  startIndex: number;
  targetIndex: number;
};

function messageWithNodes(key: string, fallback: string, substitutions: string[], nodes: Record<string, React.ReactNode>) {
  const text = message(key, fallback, substitutions);
  const tokens = Object.keys(nodes);
  if (!tokens.length) {
    return text;
  }
  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text
    .split(pattern)
    .map((part, index) => (nodes[part] ? <React.Fragment key={`${part}-${index}`}>{nodes[part]}</React.Fragment> : part));
}

function ClearableInput({onChange, type, value}: {onChange: (value: string) => void; type: string; value: string}) {
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
      <input className="form-control" type={type} value={value} onChange={(event) => updateValue(event.currentTarget.value)} />
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
  cellWidths,
  conditionTypes = [],
  isDragging = false,
  index,
  onAddNote,
  onCloneRule,
  onConditionFieldChange,
  onConditionTypeChange,
  onIpConditionInputChange,
  onNoteChange,
  onProfileChange,
  onRemoveRule,
  onSortPointerDown,
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
  const cellStyle = (cellIndex: number): React.CSSProperties | undefined =>
    cellWidths?.[cellIndex] != null ? {width: `${cellWidths[cellIndex]}px`} : undefined;

  function formatIpCondition(condition: SwitchRuleCondition) {
    if (condition?.ip) {
      return OmegaPac.Conditions.str(condition).split(' ', 2)[1];
    }
    return '';
  }

  function changeField(field: SwitchRuleEditableConditionField, value: SwitchRuleEditableConditionValue) {
    onConditionFieldChange?.(index, field, value);
  }

  function changeConditionType(value: string) {
    const nextType = conditionTypeFromSelectValue(conditionTypes, value);
    if (nextType) {
      onConditionTypeChange?.(index, nextType);
    }
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
    <tr className={`switch-rule-row ${isDragging ? 'switch-rule-row-dragging' : ''}`} data-rule-index={index}>
      <td className="sort-bar" style={cellStyle(0)} onPointerDown={(event) => onSortPointerDown?.(index, event)}>
        <span className="glyphicon glyphicon-sort" />
      </td>
      <td className={hasUrlIcon ? 'has-icon' : undefined} style={cellStyle(1)}>
        <select className="form-control" value={conditionType} onChange={(event) => changeConditionType(event.currentTarget.value)}>
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
      <td className={hasWarning ? 'has-warning' : undefined} style={cellStyle(2)}>
        {renderConditionDetails()}
      </td>
      <td className="switch-rule-row-target" style={cellStyle(3)}>
        <div className={conditionType === 'NeverCondition' ? 'disabled' : undefined}>
          <ProfileSelect
            name={rule.profileName || ''}
            onChange={(name) => onProfileChange?.(index, name)}
            options={options}
            profiles={resultProfiles}
          />
        </div>
      </td>
      <td style={cellStyle(4)}>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          title={message('options_deleteRule', 'Delete rule')}
          onClick={() => onRemoveRule?.(index)}
        >
          <span className="glyphicon glyphicon-trash" />
        </button>{' '}
        <button
          type="button"
          className="btn btn-default btn-sm"
          title={message('options_cloneRule', 'Clone rule')}
          onClick={() => onCloneRule?.(index)}
        >
          <span className="glyphicon glyphicon-duplicate" />
        </button>{' '}
        {!showNotes && (
          <button
            type="button"
            className="btn btn-default btn-sm"
            title={message('options_ruleNote', 'Note')}
            onClick={() => onAddNote?.(index)}
          >
            <span className="glyphicon glyphicon-comment" />
          </button>
        )}
      </td>
      {showNotes && (
        <td style={cellStyle(5)}>
          <DraftInput value={rule.note || ''} onChange={(value) => onNoteChange?.(index, value)} />
        </td>
      )}
    </tr>
  );
}

function SwitchRuleRows({
  draggingRuleIndex,
  onAddNote,
  onCloneRule,
  onConditionFieldChange,
  onConditionReplace,
  onConditionTypeChange,
  onIpConditionInputChange,
  onNoteChange,
  onProfileChange,
  onRemoveRule,
  onSortPointerDown,
  onWeekdayChange,
  options,
  profile,
  ruleKeys,
  rules = [],
  selectConditionDetailsIndex,
  selectConditionDetailsKey,
  showConditionTypes = 0,
  showNotes = false,
  visualRuleIndices,
  visibleRuleCount = 0
}: SwitchRuleRowsProps) {
  const conditionTypes = conditionTypesForMode(showConditionTypes);
  const resultProfiles = resultProfilesFor(options, profile);
  const visibleIndices = visualRuleIndices || rules.slice(0, visibleRuleCount).map((_rule, index) => index);

  return (
    <>
      {visibleIndices.map((index) => {
        const rule = rules[index];
        if (!rule) {
          return null;
        }
        return (
          <SwitchRuleRow
            conditionTypes={conditionTypes}
            index={index}
            isDragging={draggingRuleIndex === index}
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
            onSortPointerDown={onSortPointerDown}
            onWeekdayChange={onWeekdayChange}
            options={options}
            resultProfiles={resultProfiles}
            rule={rule}
            selectConditionDetailsIndex={selectConditionDetailsIndex}
            selectConditionDetailsKey={selectConditionDetailsKey}
            showNotes={showNotes}
            weekdayList={OmegaPac.Conditions.getWeekdayList(rule.condition) || []}
          />
        );
      })}
    </>
  );
}

function SwitchRuleDragPreview({
  drag,
  options,
  profile,
  rules = [],
  showConditionTypes = 0,
  showNotes = false
}: {
  drag?: RuleDragState | null;
  options?: Options | null;
  profile: NamedSwitchProfileModel;
  rules?: SwitchRule[];
  showConditionTypes?: number;
  showNotes?: boolean;
}) {
  if (!drag) {
    return null;
  }
  const rule = rules[drag.startIndex];
  if (!rule) {
    return null;
  }
  const conditionTypes = conditionTypesForMode(showConditionTypes);
  const resultProfiles = resultProfilesFor(options, profile);
  const style: React.CSSProperties = {
    left: `${drag.rowLeft}px`,
    top: `${drag.clientY - drag.pointerOffsetY}px`,
    width: `${drag.rowWidth}px`
  };
  return (
    <table className="switch-rules switch-rule-drag-helper table table-bordered table-condensed" style={style}>
      <tbody>
        <SwitchRuleRow
          cellWidths={drag.cellWidths}
          conditionTypes={conditionTypes}
          index={drag.startIndex}
          options={options}
          resultProfiles={resultProfiles}
          rule={rule}
          showNotes={showNotes}
          weekdayList={OmegaPac.Conditions.getWeekdayList(rule.condition) || []}
        />
      </tbody>
    </table>
  );
}

export function UnsupportedProfile({profile}: UnsupportedProfileProps) {
  const profileType = profile?.profileType || '';
  return (
    <>
      <div className="lead">{message('options_profileUnsupported', `Unsupported profile type ${profileType}!`, profileType)}</div>
      <p>{message('options_profileUnsupportedHelp', 'The options could be broken, or from a newer version of this program.')}</p>
    </>
  );
}

type PacProfileDraft = Record<PacProfileField, string>;
type RuleListProfileDraft = Record<Exclude<RuleListProfileField, 'omitRuleListFromExport'>, string> & {
  omitRuleListFromExport: boolean;
};
type RuleListProfileAttachedDraft = Record<RuleListProfileSourceField, string> & {
  omitRuleListFromExport: boolean;
};

function RuleListExportContentSwitch({
  checked,
  disabled = false,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <>
      <label className="profile-switch-label">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span className="profile-switch" aria-hidden="true">
          <span className="profile-switch-knob" />
        </span>
        <span>{message('options_ruleListOmitDownloadedContent', 'Exclude downloaded rule list content from exported config.')}</span>
      </label>
      <p className="help-block profile-switch-help">
        {message(
          'options_ruleListOmitDownloadedContentHelp',
          'This can significantly reduce exported config size for large rule lists. Download the rules again after import.'
        )}
      </p>
    </>
  );
}

function DownloadedRuleListContentToggle({shown, onToggle}: {shown: boolean; onToggle: () => void}) {
  return (
    <button type="button" className="btn btn-default btn-sm" onClick={onToggle}>
      <span className={`glyphicon ${shown ? 'glyphicon-eye-close' : 'glyphicon-eye-open'}`} />{' '}
      {shown
        ? message('options_ruleListHideDownloadedContent', 'Hide downloaded rule list content')
        : message('options_ruleListShowDownloadedContent', 'Show downloaded rule list content')}
    </button>
  );
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
  const formattedLastUpdate = formatMediumDate(profile.lastUpdate);
  const [draft, setDraft] = useState<PacProfileDraft>({
    pacScript: profile.pacScript || '',
    pacUrl: profile.pacUrl || ''
  });

  useEffect(() => {
    setDraft({
      pacScript: profile.pacScript || '',
      pacUrl: profile.pacUrl || ''
    });
  }, [profile.name, profile.pacScript, profile.pacUrl]);

  function changeField(field: PacProfileField, value: string) {
    setDraft((current) => ({...current, [field]: value}));
    onProfileChange?.(field, value);
  }

  const pacUrl = draft.pacUrl;
  const {invalid: pacUrlInvalid, isFile: pacUrlIsFile} = pacProfileUrlState(pacUrl, referenced);
  const authAll = !!profile.auth?.all;

  return (
    <div>
      {pacProfilesUnsupported && (
        <p className="alert alert-danger width-limit">
          <span className="glyphicon glyphicon-remove" />{' '}
          {message('options_pac_profile_unsupported_moz', 'PAC Profiles WILL NOT work in Mozilla Firefox due to technical limitations!')}
        </p>
      )}
      <section className="settings-group">
        <h3>{message('options_group_pacUrl', 'PAC URL')}</h3>
        <div className="width-limit">
          <ClearableInput type="text" value={pacUrl} onChange={(value) => changeField('pacUrl', value)} />
        </div>
        <p className="help-block">{message('options_pacUrlHelp', 'The PAC script will be downloaded from this URL.')}</p>
        {pacUrlIsFile && !referenced && (
          <div className="has-warning">
            <p className="help-block">
              <span className="glyphicon glyphicon-warning-sign" />{' '}
              {message('options_pacUrlFile', 'Loading PAC scripts from file: URLs is not recommended.')}
            </p>
          </div>
        )}
        {pacUrlIsFile && referenced && (
          <div className="has-error">
            <p className="help-block">
              <span className="glyphicon glyphicon-remove-sign" />{' '}
              {message('options_pacUrlFile', 'Loading PAC scripts from file: URLs is not recommended.')}
            </p>
            <p className="help-block">{message('options_pacUrlFileDisabled', 'File URLs are disabled for referenced PAC profiles.')}</p>
          </div>
        )}
        {pacUrl && !pacUrlIsFile && (
          <p>
            <button
              type="button"
              className={`btn ${pacUrl && !profile.lastUpdate ? 'btn-primary' : 'btn-default'}`}
              disabled={updating}
              onClick={() => onDownload?.(profile.name)}
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
            <p>
              {message(
                'options_proxy_authAllWarningPac',
                'Proxy authentication will be applied to all proxies returned by this PAC profile.'
              )}
            </p>
            {pacUrl ? (
              <p>
                {message(
                  'options_proxy_authAllWarningPacUrl',
                  'Make sure the downloaded PAC script only returns proxies that share these credentials.'
                )}
              </p>
            ) : (
              <p>
                {message(
                  'options_proxy_authAllWarningPacScript',
                  'Make sure the PAC script only returns proxies that share these credentials.'
                )}
              </p>
            )}
            {referenced && (
              <p>
                <span className="glyphicon glyphicon-warning-sign" />{' '}
                {message('options_proxy_authReferencedWarning', 'This profile is referenced by other profiles.')}
              </p>
            )}
          </div>
        )}
        {!pacUrlIsFile && (
          <div>
            {pacUrl && profile.lastUpdate && (
              <p className="alert alert-success width-limit">
                {message('options_pacScriptLastUpdate', 'Last update: $1', formattedLastUpdate)}
              </p>
            )}
            {pacUrl && !profile.lastUpdate && (
              <p className="alert alert-danger width-limit">
                {message('options_pacScriptObsolete', 'PAC script is obsolete. Please download it now.')}
              </p>
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

function fixedProfileOptionsForScheme(scheme: FixedProfileScheme) {
  const defaultLabel = scheme ? message('options_protocol_useDefault', 'Use default') : message('options_protocol_direct', 'Direct');
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

export function FixedProfileContent({profile, onBypassListChange, onEditProxyAuth, onProxyChange}: FixedProfileProps) {
  const {bypassList, fallbackProxy, name: profileName, proxyForHttp, proxyForHttps} = profile;
  const initialEditors = fixedProfileEditors(profile);
  const [draftEditors, setDraftEditors] = useState<FixedProfileProxyEditors>(() => cloneProxyEditors(initialEditors));
  const [draftBypassList, setDraftBypassList] = useState(fixedProfileBypassText(profile));
  const [showAdvanced, setShowAdvanced] = useState(() => fixedProfileHasAdvancedProxy(initialEditors));
  const previousProfileNameRef = useRef(profileName);

  useEffect(() => {
    const editors = fixedProfileEditors({fallbackProxy, proxyForHttp, proxyForHttps});
    const hasAdvancedProxy = fixedProfileHasAdvancedProxy(editors);
    const profileChanged = previousProfileNameRef.current !== profileName;
    previousProfileNameRef.current = profileName;
    setDraftEditors(cloneProxyEditors(editors));
    if (profileChanged) {
      setShowAdvanced(hasAdvancedProxy);
    } else if (hasAdvancedProxy) {
      setShowAdvanced(true);
    }
  }, [profileName, fallbackProxy, proxyForHttp, proxyForHttps]);

  useEffect(() => {
    setDraftBypassList(fixedProfileBypassText({bypassList}));
  }, [profileName, bypassList]);

  function commitProxyEditor(
    scheme: FixedProfileScheme,
    editor: ProxyEditor,
    previousEditor: ProxyEditor,
    editors: FixedProfileProxyEditors
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
      if (nextEditor.port == null && isFixedProfileProxyProtocol(nextEditor.scheme)) {
        nextEditor.port = FIXED_PROFILE_DEFAULT_PORT[nextEditor.scheme];
      }
      if (nextEditor.host == null) {
        nextEditor.host = defaultEditor.host || 'example.com';
      }
    }

    editors[scheme] = nextEditor;
    onProxyChange?.(field, nextEditor, {clearAuth});
  }

  function changeProxyEditor(scheme: FixedProfileScheme, field: FixedProfileProxyEditorField, value?: string | number) {
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

  function commitBypassList() {
    const nextBypassList = fixedProfileBypassList(draftBypassList);
    if (!fixedProfileBypassListEquals(bypassList || [], nextBypassList)) {
      onBypassListChange?.(nextBypassList);
    }
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
                          onChange={(event) =>
                            changeProxyEditor(scheme, 'port', event.currentTarget.value ? Number(event.currentTarget.value) : undefined)
                          }
                        />
                      ) : (
                        <input
                          className="form-control"
                          type="number"
                          value=""
                          placeholder={defaultEditor.port != null ? String(defaultEditor.port) : ''}
                          disabled
                        />
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
          onBlur={commitBypassList}
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
  const [showDownloadedContent, setShowDownloadedContent] = useState(false);
  const [draft, setDraft] = useState<RuleListProfileAttachedDraft>({
    format: attached?.format || '',
    omitRuleListFromExport: attached?.omitRuleListFromExport === true,
    ruleList: attached?.ruleList || '',
    sourceUrl: attached?.sourceUrl || ''
  });

  useEffect(() => {
    setDraft({
      format: attached?.format || '',
      omitRuleListFromExport: attached?.omitRuleListFromExport === true,
      ruleList: attached?.ruleList || '',
      sourceUrl: attached?.sourceUrl || ''
    });
  }, [attached?.name, attached?.format, attached?.omitRuleListFromExport, attached?.ruleList, attached?.sourceUrl]);

  useEffect(() => {
    setShowDownloadedContent(false);
  }, [attached?.name, attached?.sourceUrl]);

  function changeField<TField extends RuleListProfileAttachedField>(field: TField, value: RuleListProfileAttachedDraft[TField]) {
    setDraft((current) => ({...current, [field]: value}));
    onAttachedChange?.(field, value);
  }

  if (!attached) {
    return (
      <section className="settings-group">
        <h3>{message('options_group_attachProfile', 'Attach Profile')}</h3>
        <p className="help-block">
          {message('options_attachProfileHelp', 'Attach a rule list profile to import rules from a URL or text.')}
        </p>
        <button type="button" className="btn btn-default" onClick={() => onAttachNew?.()}>
          <span className="glyphicon glyphicon-plus" /> {message('options_attachProfile', 'Attach Profile')}
        </button>
      </section>
    );
  }

  const downloadedContent = !!draft.sourceUrl;
  const showRuleListContent = !downloadedContent || showDownloadedContent;

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
              <ClearableInput type="url" value={draft.sourceUrl} onChange={(value) => changeField('sourceUrl', value)} />
            </div>{' '}
            <button
              type="button"
              className={`btn ${draft.sourceUrl && !attached.lastUpdate ? 'btn-primary' : 'btn-default'}`}
              disabled={!draft.sourceUrl || updating}
              onClick={() => onDownload?.(attached.name)}
            >
              <span className="glyphicon glyphicon-download-alt" /> {message('options_downloadProfileNow', 'Download Profile Now')}
            </button>
          </div>
          <p className="help-block">{message('options_ruleListUrlHelp', 'The rule list will be downloaded from this URL.')}</p>
          <RuleListExportContentSwitch
            checked={draft.omitRuleListFromExport}
            disabled={!draft.sourceUrl}
            onChange={(checked) => changeField('omitRuleListFromExport', checked)}
          />
        </form>
      </section>
      <section className="settings-group">
        <h3>{message('options_group_ruleListText', 'Rule List Content')}</h3>
        {draft.sourceUrl && attached.lastUpdate && (
          <p className="alert alert-success width-limit">{message('options_ruleListLastUpdate', 'Last update: $1', formattedLastUpdate)}</p>
        )}
        {draft.sourceUrl && !attached.lastUpdate && (
          <p className="alert alert-danger width-limit">
            {message('options_ruleListObsolete', 'Rule list is obsolete. Please download it now.')}
          </p>
        )}
        {attachedRuleListError && (
          <p className="alert alert-danger width-limit">
            <span className="glyphicon glyphicon-remove" /> {attachedRuleListError.message}
          </p>
        )}
        {downloadedContent && (
          <p>
            <DownloadedRuleListContentToggle shown={showDownloadedContent} onToggle={() => setShowDownloadedContent((shown) => !shown)} />
          </p>
        )}
        {showRuleListContent && (
          <textarea
            id="attached-rulelist"
            className="monospace form-control width-limit"
            rows={20}
            value={draft.ruleList}
            disabled={!!draft.sourceUrl}
            onChange={(event) => changeField('ruleList', event.currentTarget.value)}
          />
        )}
      </section>
    </div>
  );
}

export function SwitchConditionHelp({onClose, show = false, showConditionTypes = 0}: SwitchConditionHelpProps) {
  const [expandedId, setExpandedId] = useState(0);
  const groups = showConditionTypes === 0 ? getBasicConditionGroups() : getAdvancedConditionGroups();
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
                  <span className={`glyphicon ${expandedId === groupIndex ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right'}`} />{' '}
                  {groupTitle}
                </a>
              </h4>
            )}
            {expandedId === groupIndex && (
              <dl>
                {group.types.map((type) => (
                  <React.Fragment key={type}>
                    <dt>{message(`condition_${type}`, type)}</dt>
                    <dd>
                      <div>{richMessage(`condition_help_${type}`, '')}</div>
                      {isUrlConditionType[type] && (
                        <div className="text-danger">
                          <span className="glyphicon glyphicon-alert" /> <span>{richMessage('condition_alert_fullUrlLimitation', '')}</span>
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

export function SwitchRulesHeader({editSource = false, onSourceChange, onToggleSource, rules = [], source}: SwitchRulesHeaderProps) {
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
        <button type="button" className={`btn ${editSource ? 'btn-primary active' : 'btn-default'}`} onClick={() => onToggleSource?.()}>
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
          <span className="glyphicon glyphicon-alert" /> <span>{richMessage('condition_alert_fullUrlLimitation', '')}</span>
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

export function SwitchRuleTableHeader({onToggleConditionHelp, showNotes = false}: SwitchRuleTableHeaderProps) {
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
            <button
              type="button"
              className="btn btn-danger btn-sm"
              title={message('options_deleteAttached', 'Delete attached profile')}
              onClick={() => onRemoveAttached?.()}
            >
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
          <button
            type="button"
            className="btn btn-info btn-sm"
            title={message('options_resetRules_help', 'Reset rules')}
            onClick={() => onResetRules?.()}
          >
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
  visibleRuleCount: _visibleRuleCount = 0
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
  const ruleDragRef = useRef<RuleDragState | null>(null);
  const [cloneSelectTarget, setCloneSelectTarget] = useState<{expectedLength: number; index: number; key: number} | null>(null);
  const [ruleDrag, setRuleDrag] = useState<RuleDragState | null>(null);
  const [renderedRuleCount, setRenderedRuleCount] = useState(0);
  const activeRuleDragPointerId = ruleDrag?.pointerId;
  const ruleDragTargetIndexRef = useRef(ruleDragTargetIndex);

  useEffect(() => {
    moveRuleRef.current = onMoveRule;
  }, [onMoveRule]);

  function createRuleKey() {
    return nextRuleKeyRef.current++;
  }

  function syncRuleKeys() {
    const profileName = profile.name;
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

  function updateRuleDrag(nextDrag: RuleDragState | null) {
    ruleDragRef.current = nextDrag;
    setRuleDrag(nextDrag);
  }

  function visibleRuleIndicesForDrag() {
    const count = Math.min(displayRuleCount, rules.length);
    const indices = Array.from({length: count}, (_value, index) => index);
    if (!ruleDrag || ruleDrag.startIndex >= count || ruleDrag.targetIndex >= count) {
      return indices;
    }
    return moveIndex(indices, ruleDrag.startIndex, ruleDrag.targetIndex);
  }

  function ruleDragTargetIndex(clientY: number) {
    const body = rulesBodyRef.current;
    const visibleCount = Math.min(displayRuleCount, rules.length);
    if (!body || visibleCount <= 0) {
      return 0;
    }
    const rows = Array.from(body.querySelectorAll<HTMLTableRowElement>('.switch-rule-row'));
    if (!rows.length) {
      return 0;
    }
    let targetIndex = rows.length - 1;
    for (let index = 0; index < rows.length; index++) {
      const rect = rows[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        targetIndex = index;
        break;
      }
    }
    return Math.max(0, Math.min(targetIndex, visibleCount - 1));
  }
  ruleDragTargetIndexRef.current = ruleDragTargetIndex;

  function beginRuleDrag(index: number, event: React.PointerEvent<HTMLTableCellElement>) {
    if (editSource || !loadRules || rules.length < 2) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    const visibleCount = Math.min(displayRuleCount, rules.length);
    if (index < 0 || index >= visibleCount) {
      return;
    }
    const row = event.currentTarget.closest<HTMLTableRowElement>('.switch-rule-row');
    if (!row) {
      return;
    }
    const rowRect = row.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateRuleDrag({
      cellWidths: Array.from(row.cells).map((cell) => cell.getBoundingClientRect().width),
      clientY: event.clientY,
      pointerId: event.pointerId,
      pointerOffsetY: event.clientY - rowRect.top,
      rowLeft: rowRect.left,
      rowWidth: rowRect.width,
      startIndex: index,
      targetIndex: index
    });
  }

  useEffect(() => {
    if (!loadRules || editSource) {
      previousProfileNameRef.current = profile.name;
      setRenderedRuleCount(0);
      return;
    }
    setRenderedRuleCount((current) => {
      const profileChanged = previousProfileNameRef.current !== profile.name;
      previousProfileNameRef.current = profile.name;
      if (profileChanged || current === 0 || current > rules.length) {
        return Math.min(INITIAL_SWITCH_RULE_BATCH_SIZE, rules.length);
      }
      return current;
    });
  }, [editSource, loadRules, profile.name, rules.length]);

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
    if (activeRuleDragPointerId == null) {
      return;
    }

    document.body.classList.add('switch-rule-dragging-active');

    const updateTarget = (event: PointerEvent) => {
      const current = ruleDragRef.current;
      if (!current || event.pointerId !== current.pointerId) {
        return;
      }
      event.preventDefault();
      const targetIndex = ruleDragTargetIndexRef.current(event.clientY);
      updateRuleDrag({
        ...current,
        clientY: event.clientY,
        targetIndex
      });
    };

    const finishDrag = (event: PointerEvent) => {
      const current = ruleDragRef.current;
      if (!current || event.pointerId !== current.pointerId) {
        return;
      }
      event.preventDefault();
      updateRuleDrag(null);
      if (current.startIndex !== current.targetIndex) {
        moveRule(current.startIndex, current.targetIndex);
      }
    };

    const cancelDrag = (event: PointerEvent) => {
      const current = ruleDragRef.current;
      if (!current || event.pointerId !== current.pointerId) {
        return;
      }
      updateRuleDrag(null);
    };

    window.addEventListener('pointermove', updateTarget, {passive: false});
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', cancelDrag);
    return () => {
      document.body.classList.remove('switch-rule-dragging-active');
      window.removeEventListener('pointermove', updateTarget);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', cancelDrag);
    };
  }, [activeRuleDragPointerId]);

  useEffect(() => {
    if (!cloneSelectTarget || rules.length < cloneSelectTarget.expectedLength) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setCloneSelectTarget((current) => (current?.key === cloneSelectTarget.key ? null : current));
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [cloneSelectTarget, rules.length]);

  const initialVisibleRuleCount = Math.min(INITIAL_SWITCH_RULE_BATCH_SIZE, rules.length);
  const displayRuleCount = !editSource && loadRules && renderedRuleCount === 0 ? initialVisibleRuleCount : renderedRuleCount;
  const reserveInitialRulesSpace = !editSource && rules.length > 0 && displayRuleCount < initialVisibleRuleCount;
  const rulesWrapperMinHeight = reserveInitialRulesSpace ? 96 + initialVisibleRuleCount * 42 : undefined;
  const ruleKeys = syncRuleKeys();
  const activeCloneSelectTarget =
    cloneSelectTarget &&
    rules.length >= cloneSelectTarget.expectedLength &&
    cloneSelectTarget.index < displayRuleCount &&
    cloneSelectTarget.index < rules.length
      ? cloneSelectTarget
      : null;
  const visualRuleIndices = visibleRuleIndicesForDrag();

  return (
    <>
      <SwitchConditionHelp onClose={onClose} show={show} showConditionTypes={showConditionTypes} />
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
                  <SwitchRuleTableHeader onToggleConditionHelp={onToggleConditionHelp} showNotes={showNotes} />
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
                    onSortPointerDown={beginRuleDrag}
                    onWeekdayChange={onWeekdayChange}
                    options={options}
                    profile={profile}
                    draggingRuleIndex={ruleDrag?.startIndex}
                    ruleKeys={ruleKeys}
                    rules={rules}
                    selectConditionDetailsIndex={activeCloneSelectTarget?.index}
                    selectConditionDetailsKey={activeCloneSelectTarget?.key}
                    showConditionTypes={showConditionTypes}
                    showNotes={showNotes}
                    visualRuleIndices={visualRuleIndices}
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
            <SwitchRuleDragPreview
              drag={ruleDrag}
              options={options}
              profile={profile}
              rules={rules}
              showConditionTypes={showConditionTypes}
              showNotes={showNotes}
            />
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

type SwitchProfileConfirmState =
  | {
      index: number;
      kind: 'ruleRemove';
      rule: SwitchRule;
    }
  | {
      kind: 'ruleReset';
    }
  | {
      kind: 'deleteAttached';
    }
  | null;

function SwitchProfileModalFrame({children, onDismiss}: {children: React.ReactNode; onDismiss: () => void}) {
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
  const [source, setSource] = useState<SwitchRuleSourceState | undefined>(() => cloneSourceState(externalSource));
  const [notesForcedVisible, setNotesForcedVisible] = useState(!!externalShowNotes || hasNotes(rules));
  const [confirmState, setConfirmState] = useState<SwitchProfileConfirmState>(null);
  const [, setLocalRevision] = useState(0);

  useEffect(() => {
    setConditionHelpShown(!!externalConditionHelpShown);
  }, [externalConditionHelpShown]);

  useEffect(() => {
    setEditSource(!!externalEditSource);
  }, [externalEditSource]);

  useEffect(() => {
    setSource(cloneSourceState(externalSource));
  }, [externalSource]);

  useEffect(() => {
    if (externalShowNotes || hasNotes(rules)) {
      setNotesForcedVisible(true);
    }
  }, [externalShowNotes, rules]);

  function forceLocalRender() {
    setLocalRevision((revision) => revision + 1);
  }

  function runAction<T extends unknown[]>(action: ((...args: T) => void) | undefined, ...args: T) {
    action?.(...args);
    forceLocalRender();
  }

  function updateConditionHelp(shown: boolean) {
    setConditionHelpShown(shown);
    onConditionHelpChange?.(shown);
  }

  function updateEditorState(nextEditSource: boolean, nextSource?: SwitchRuleSourceState | null) {
    onEditorStateChange?.({
      editSource: nextEditSource,
      source: nextSource || null
    });
  }

  function openSourceEditor() {
    const nextSource = cloneSourceState(onCreateSource?.()) || {
      code: composeSource(profile || {}, props.attachedOptions?.defaultProfileName)
    };
    setSource(nextSource);
    setEditSource(true);
    updateEditorState(true, nextSource);
    onEditorModeChange?.(true);
  }

  function closeSourceEditor() {
    const currentSource = source || {code: ''};
    if (!currentSource.touched) {
      setSource(undefined);
      setEditSource(false);
      updateEditorState(false, null);
      onEditorModeChange?.(false);
      onRulesLoaded?.();
      forceLocalRender();
      return;
    }

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

export function RuleListProfile({onDownload, onProfileChange, options, profile, updating = false}: RuleListProfileProps) {
  const resultProfiles = resultProfilesFor(options, profile);
  const ruleListFormats = getRuleListFormats();
  const [showDownloadedContent, setShowDownloadedContent] = useState(false);
  const [draft, setDraft] = useState<RuleListProfileDraft>({
    defaultProfileName: profile.defaultProfileName || '',
    format: profile.format || '',
    matchProfileName: profile.matchProfileName || '',
    omitRuleListFromExport: profile.omitRuleListFromExport === true,
    ruleList: profile.ruleList || '',
    sourceUrl: profile.sourceUrl || ''
  });

  useEffect(() => {
    setDraft({
      defaultProfileName: profile.defaultProfileName || '',
      format: profile.format || '',
      matchProfileName: profile.matchProfileName || '',
      omitRuleListFromExport: profile.omitRuleListFromExport === true,
      ruleList: profile.ruleList || '',
      sourceUrl: profile.sourceUrl || ''
    });
  }, [
    profile.name,
    profile.defaultProfileName,
    profile.format,
    profile.matchProfileName,
    profile.omitRuleListFromExport,
    profile.ruleList,
    profile.sourceUrl
  ]);

  useEffect(() => {
    setShowDownloadedContent(false);
  }, [profile.name, profile.sourceUrl]);

  function changeField(field: RuleListProfileField, value: NamedRuleListProfileModel[RuleListProfileField]) {
    setDraft((current) => ({...current, [field]: value}));
    onProfileChange?.(field, value);
  }

  const downloadedContent = !!draft.sourceUrl;
  const showRuleListContent = !downloadedContent || showDownloadedContent;

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
        <div className="form-group">
          <div className="width-limit inline-form-control" style={{marginLeft: 0, verticalAlign: 'middle'}}>
            <ClearableInput type="url" value={draft.sourceUrl} onChange={(value) => changeField('sourceUrl', value)} />
          </div>{' '}
          <button
            type="button"
            className="btn btn-default"
            disabled={!draft.sourceUrl || updating}
            onClick={() => onDownload?.(profile.name)}
          >
            <span className="glyphicon glyphicon-download-alt" /> {message('options_downloadProfileNow', 'Download Profile Now')}
          </button>
        </div>
        <p className="help-block">{message('options_ruleListUrlHelp', 'The rule list will be downloaded from this URL.')}</p>
        <RuleListExportContentSwitch
          checked={draft.omitRuleListFromExport}
          disabled={!draft.sourceUrl}
          onChange={(checked) => changeField('omitRuleListFromExport', checked)}
        />
      </section>
      <section className="settings-group">
        <h3>{message('options_group_ruleListText', 'Rule List Content')}</h3>
        {downloadedContent && (
          <p>
            <DownloadedRuleListContentToggle shown={showDownloadedContent} onToggle={() => setShowDownloadedContent((shown) => !shown)} />
          </p>
        )}
        {showRuleListContent && (
          <textarea
            className="monospace form-control width-limit"
            rows={20}
            value={draft.ruleList}
            disabled={!!draft.sourceUrl}
            onChange={(event) => changeField('ruleList', event.currentTarget.value)}
          />
        )}
      </section>
    </div>
  );
}

export function VirtualProfile({onReplaceProfile, onTargetChange, options, profile}: VirtualProfileProps) {
  const [targetName, setTargetName] = useState(profile.defaultProfileName || '');
  useEffect(() => {
    setTargetName(profile.defaultProfileName || '');
  }, [profile.defaultProfileName]);
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
          {message(
            'options_virtualProfileTargetHelp',
            'When this profile is applied, it acts exactly the same as the profile selected below.'
          )}
        </p>
        <div className="form-group">
          <label>{message('options_virtualProfileTarget', 'Target')}</label>{' '}
          <ProfileSelect name={targetName} onChange={changeTarget} options={options} profiles={targetProfiles} />
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
          <button type="button" className="btn btn-default" onClick={() => onReplaceProfile?.(targetName, profile.name)}>
            <span className="glyphicon glyphicon-search" /> {message('options_virtualProfileReplace', 'Replace target profile')}
          </button>
        </div>
      </section>
    </div>
  );
}
