import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Options} from './options_client';
import {message} from './options_client';
import {
  Profile,
  ProfileInline,
  ProfileSelect,
  profileByName
} from './profile_widgets';

type UnsupportedProfileProps = {
  profile?: {
    profileType?: string;
  } | null;
};

type VirtualProfileProps = {
  dispName?: (profile: Profile) => string;
  onReplaceProfile?: (fromName: string, toName: string) => void;
  onTargetChange?: (name: string) => void;
  options?: Options | null;
  profile?: {
    defaultProfileName?: string;
    name?: string;
  } | null;
  targetProfiles?: Profile[];
};

type RuleListProfileModel = Profile & {
  defaultProfileName?: string;
  format?: string;
  matchProfileName?: string;
  ruleList?: string;
  sourceUrl?: string;
};

type RuleListProfileProps = {
  dispName?: (profile: Profile) => string;
  onDownload?: (name: string) => void;
  onProfileChange?: (field: keyof RuleListProfileModel, value: string) => void;
  options?: Options | null;
  profile?: RuleListProfileModel | null;
  resultProfiles?: Profile[];
  ruleListFormats?: string[];
  updating?: boolean;
};

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

function RuleListProfile({
  dispName,
  onDownload,
  onProfileChange,
  options,
  profile,
  resultProfiles,
  ruleListFormats = [],
  updating = false
}: RuleListProfileProps) {
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
            dispName={dispName}
            name={draft.matchProfileName}
            onChange={(name) => changeField('matchProfileName', name)}
            options={options}
            profiles={resultProfiles}
          />
        </div>
        <div className="form-group">
          <label>{message('options_ruleListDefaultProfile', 'Default Profile')}</label>{' '}
          <ProfileSelect
            dispName={dispName}
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

function VirtualProfile({dispName, onReplaceProfile, onTargetChange, options, profile, targetProfiles}: VirtualProfileProps) {
  const [targetName, setTargetName] = useState(profile?.defaultProfileName || '');
  useEffect(() => {
    setTargetName(profile?.defaultProfileName || '');
  }, [profile?.defaultProfileName]);
  const targetProfile = profileByName(options, targetName);

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
            dispName={dispName}
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
              __PROFILE__: <ProfileInline profile={targetProfile} dispName={dispName} />
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

const globalWindow = window as any;
globalWindow.OmegaReactProfileContent = {
  mountRuleListProfile,
  mountUnsupportedProfile,
  mountVirtualProfile
};
