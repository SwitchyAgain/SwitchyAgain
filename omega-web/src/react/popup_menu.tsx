import React from 'react';
import {createRoot} from 'react-dom/client';
import {ProfileSelect} from './profile_widgets';

type Profile = {
  color?: string;
  defaultProfileName?: string;
  name?: string;
  profileType?: string;
};

type ProfileMap = Record<string, Profile | undefined>;

type PopupProfileLabelProps = {
  dispName?: (profile: Profile) => string;
  icon?: string;
  options?: ProfileMap | null;
  profile?: Profile | null;
  text?: string;
};

type PopupActionLabelProps = {
  caret?: boolean;
  icon?: string;
  iconClass?: string;
  text?: string;
  textClass?: string;
};

type ConditionTypeOption = {
  label: string;
  value: string;
};

type PopupConditionFormProps = {
  availableProfiles?: ProfileMap | null;
  conditionTypes?: ConditionTypeOption[];
  currentProfile?: Profile | null;
  dispName?: (profile: Profile) => string;
  messages?: Record<string, string>;
  onCancel?: () => void;
  onConditionTypeChange?: (value: string) => void;
  onHelp?: () => void;
  onPatternChange?: (value: string) => void;
  onProfileNameChange?: (value: string) => void;
  onSubmit?: () => void;
  resultProfiles?: Profile[];
  rule?: {
    condition?: {
      conditionType?: string;
      pattern?: string;
    };
    profileName?: string;
  } | null;
  shown?: boolean;
};

const PROFILE_ICONS: Record<string, string> = {
  AutoDetectProfile: 'glyphicon-file',
  DirectProfile: 'glyphicon-transfer',
  FixedProfile: 'glyphicon-globe',
  PacProfile: 'glyphicon-file',
  RuleListProfile: 'glyphicon-list',
  SwitchProfile: 'glyphicon-retweet',
  SystemProfile: 'glyphicon-off',
  VirtualProfile: 'glyphicon-question-sign'
};

function getVirtualTarget(profile?: Profile | null, options?: ProfileMap | null) {
  if (profile?.profileType !== 'VirtualProfile') {
    return null;
  }
  return options?.['+' + profile.defaultProfileName] || null;
}

function getIconProfile(profile?: Profile | null, options?: ProfileMap | null) {
  return getVirtualTarget(profile, options) || profile || null;
}

function getProfileColor(profile?: Profile | null, options?: ProfileMap | null) {
  let current = profile || null;
  let color = current?.color;
  while (current) {
    color = current.color || color;
    current = getVirtualTarget(current, options);
  }
  return color;
}

function profileName(profile?: Profile | null, dispName?: (profile: Profile) => string) {
  if (!profile) {
    return '';
  }
  return dispName ? dispName(profile) : profile.name || '';
}

function PopupProfileLabel({dispName, icon, options, profile, text}: PopupProfileLabelProps) {
  const iconProfile = getIconProfile(profile, options);
  const iconClass = icon || PROFILE_ICONS[iconProfile?.profileType || ''] || 'glyphicon-question-sign';
  const isVirtual = !!getVirtualTarget(profile, options);
  const label = text != null ? text : profileName(profile, dispName);

  return (
    <>
      <span
        className={`glyphicon ${iconClass}${isVirtual ? ' virtual-profile-icon' : ''}`}
        style={{color: getProfileColor(profile, options)}}
      />
      {label && <> {label}</>}
    </>
  );
}

function PopupActionLabel({caret = false, icon, iconClass, text = '', textClass}: PopupActionLabelProps) {
  return (
    <>
      {icon && <span className={`glyphicon ${icon}${iconClass ? ` ${iconClass}` : ''}`} />}
      {icon && ' '}
      {textClass ? <span className={textClass}>{text}</span> : <span>{text}</span>}
      {caret && <span className="caret" />}
    </>
  );
}

function PopupConditionForm({
  availableProfiles,
  conditionTypes = [],
  currentProfile,
  dispName,
  messages = {},
  onCancel,
  onConditionTypeChange,
  onHelp,
  onPatternChange,
  onProfileNameChange,
  onSubmit,
  resultProfiles = [],
  rule,
  shown = false
}: PopupConditionFormProps) {
  if (!shown || !rule) {
    return null;
  }
  const condition = rule.condition || {};
  const conditionType = condition.conditionType || conditionTypes[0]?.value || '';
  const pattern = condition.pattern || '';

  return (
    <form
      className="condition-form"
      name="conditionForm"
      onSubmit={(event) => {
        event.preventDefault();
        if (pattern) {
          onSubmit?.();
        }
      }}
    >
      <fieldset>
        <legend>
          {messages.addConditionTo}{' '}
          <span className="profile-inline">
            <PopupProfileLabel profile={currentProfile} options={availableProfiles} dispName={dispName} />
          </span>
        </legend>
        <div className="form-group">
          <label>
            {messages.conditionType}{' '}
            <button type="button" className="btn btn-link btn-sm clear-padding" onClick={onHelp}>
              {messages.showConditionTypeHelp}{' '}
              <span className="glyphicon glyphicon-new-window" />
            </button>
          </label>
          <select className="form-control" value={conditionType} onChange={(event) => onConditionTypeChange?.(event.currentTarget.value)}>
            {conditionTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{messages.conditionDetails}</label>
          <input
            autoFocus
            className="form-control condition-details"
            onChange={(event) => onPatternChange?.(event.currentTarget.value)}
            required
            type="text"
            value={pattern}
          />
        </div>
        <div className="form-group">
          <label>{messages.resultProfile}</label>
          <ProfileSelect
            dispName={dispName}
            name={rule.profileName || ''}
            onChange={(name) => onProfileNameChange?.(name)}
            options={availableProfiles as any}
            profiles={resultProfiles}
          />
        </div>
        <div className="condition-controls">
          <button type="button" className="btn btn-default" onClick={onCancel}>
            {messages.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!pattern}>
            {messages.addCondition}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function mountPopupProfileLabel(element: Element, props: PopupProfileLabelProps = {}) {
  const root = createRoot(element);
  root.render(<PopupProfileLabel {...props} />);
  return {
    render(nextProps: PopupProfileLabelProps = {}) {
      root.render(<PopupProfileLabel {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountPopupActionLabel(element: Element, props: PopupActionLabelProps = {}) {
  const root = createRoot(element);
  root.render(<PopupActionLabel {...props} />);
  return {
    render(nextProps: PopupActionLabelProps = {}) {
      root.render(<PopupActionLabel {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountPopupConditionForm(element: Element, props: PopupConditionFormProps = {}) {
  const root = createRoot(element);
  root.render(<PopupConditionForm {...props} />);
  return {
    render(nextProps: PopupConditionFormProps = {}) {
      root.render(<PopupConditionForm {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactPopupMenu = {
  mountPopupActionLabel,
  mountPopupConditionForm,
  mountPopupProfileLabel
};
