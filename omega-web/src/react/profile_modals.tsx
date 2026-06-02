import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {message} from './options_client';

type RenameProfileProps = {
  fromName?: string;
  isProfileNameHidden?: (name: string) => boolean;
  isProfileNameReserved?: (name: string) => boolean;
  onClose?: (name: string) => void;
  onDismiss?: () => void;
  profileByName?: (name: string) => any;
};

type NewProfileProps = {
  isProfileNameHidden?: (name: string) => boolean;
  isProfileNameReserved?: (name: string) => boolean;
  onClose?: (profile: {name: string; profileType: string}) => void;
  onDismiss?: () => void;
  pacProfilesUnsupported?: boolean;
  profileByName?: (name: string) => any;
};

const PROFILE_ICONS: Record<string, string> = {
  FixedProfile: 'glyphicon-globe',
  PacProfile: 'glyphicon-file',
  SwitchProfile: 'glyphicon-retweet',
  VirtualProfile: 'glyphicon-question-sign'
};

function profileNameErrors(
  name: string,
  fromName: string,
  isProfileNameReserved?: (name: string) => boolean,
  profileByName?: (name: string) => any
) {
  return {
    conflict: Boolean(name && name !== fromName && profileByName?.(name)),
    required: !name,
    reserved: Boolean(name && isProfileNameReserved?.(name))
  };
}

function ProfileNameField({
  fromName = '',
  isProfileNameHidden,
  isProfileNameReserved,
  label,
  name,
  onChange,
  profileByName
}: {
  fromName?: string;
  isProfileNameHidden?: (name: string) => boolean;
  isProfileNameReserved?: (name: string) => boolean;
  label: string;
  name: string;
  onChange: (name: string) => void;
  profileByName?: (name: string) => any;
}) {
  const errors = useMemo(() => profileNameErrors(name, fromName, isProfileNameReserved, profileByName), [
    fromName,
    isProfileNameReserved,
    name,
    profileByName
  ]);
  const valid = !errors.required && !errors.reserved && !errors.conflict;
  const hidden = valid && Boolean(name && isProfileNameHidden?.(name));

  return (
    <div className={`form-group ${valid ? '' : 'has-error'}`}>
      <label htmlFor="profile-new-name">{label}</label>
      <input
        id="profile-new-name"
        className="form-control"
        type="text"
        name="profileNewName"
        required
        value={name}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {errors.required && (
        <div className="help-block">{message('options_profileNameEmpty', 'The name of the profile must not be empty.')}</div>
      )}
      {errors.reserved && (
        <div className="help-block">{message('options_profileNameReserved', 'Profile names beginning with double-underscore are reserved.')}</div>
      )}
      {!errors.reserved && errors.conflict && (
        <div className="help-block">{message('options_profileNameConflict', 'A profile with this name already exists.')}</div>
      )}
      {hidden && (
        <div className="help-block">
          <div className="text-info">
            <span className="glyphicon glyphicon-info-sign" />{' '}
            {message('options_profileNameHidden', 'Profiles with names starting with underscore will be hidden on the popup menu. However, they can still be used in places like switch profile results.')}
          </div>
        </div>
      )}
    </div>
  );
}

function RenameProfileModal({
  fromName = '',
  isProfileNameHidden,
  isProfileNameReserved,
  onClose,
  onDismiss,
  profileByName
}: RenameProfileProps) {
  const [newName, setNewName] = useState(fromName);
  const trimmedName = newName;

  useEffect(() => {
    setNewName(fromName);
  }, [fromName]);

  const errors = useMemo(() => profileNameErrors(trimmedName, fromName, isProfileNameReserved, profileByName), [
    fromName,
    isProfileNameReserved,
    profileByName,
    trimmedName
  ]);
  const valid = !errors.required && !errors.reserved && !errors.conflict;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (valid) {
      onClose?.(trimmedName);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="modal-header">
        <button type="button" className="close" onClick={onDismiss}>
          <span aria-hidden="true">{'\u00d7'}</span>
          <span className="sr-only">{message('dialog_close', 'Close')}</span>
        </button>
        <h4 className="modal-title">{message('options_modalHeader_renameProfile', 'Rename Profile')}</h4>
      </div>
      <div className="modal-body">
        <ProfileNameField
          fromName={fromName}
          isProfileNameHidden={isProfileNameHidden}
          isProfileNameReserved={isProfileNameReserved}
          label={message('options_renameProfileName', 'New profile name')}
          name={newName}
          onChange={setNewName}
          profileByName={profileByName}
        />
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-default" onClick={onDismiss}>
          {message('dialog_cancel', 'Cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid}>
          {message('options_renameProfile', 'Rename')}
        </button>
      </div>
    </form>
  );
}

function ProfileTypeOption({
  checked,
  description,
  disabled = false,
  extraHelp,
  icon,
  name,
  onChange,
  title,
  value,
  warning
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  extraHelp?: string;
  icon: string;
  name: string;
  onChange: (type: string) => void;
  title: string;
  value: string;
  warning?: string;
}) {
  return (
    <div className="radio">
      <label>
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => onChange(value)}
        />
        <span className="profile-type">
          <span className={`glyphicon ${icon} ${value === 'VirtualProfile' ? 'virtual-profile-icon' : ''}`} />{' '}
          <span>{title}</span>
        </span>
        <div className="help-block">{description}</div>
        {extraHelp && <div className="help-block">{extraHelp}</div>}
        {warning && (
          <div className="has-error">
            <div className="help-block">
              <span className="glyphicon glyphicon-warning-sign" /> {warning}
            </div>
          </div>
        )}
      </label>
    </div>
  );
}

function NewProfileModal({
  isProfileNameHidden,
  isProfileNameReserved,
  onClose,
  onDismiss,
  pacProfilesUnsupported = false,
  profileByName
}: NewProfileProps) {
  const [name, setName] = useState('');
  const [profileType, setProfileType] = useState('FixedProfile');
  const errors = useMemo(() => profileNameErrors(name, '', isProfileNameReserved, profileByName), [
    isProfileNameReserved,
    name,
    profileByName
  ]);
  const valid = !errors.required && !errors.reserved && !errors.conflict;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (valid) {
      onClose?.({name, profileType});
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="modal-header">
        <button type="button" className="close" onClick={onDismiss}>
          <span aria-hidden="true">{'\u00d7'}</span>
          <span className="sr-only">{message('dialog_close', 'Close')}</span>
        </button>
        <h4 className="modal-title">{message('options_modalHeader_newProfile', 'New Profile')}</h4>
      </div>
      <div className="modal-body">
        <ProfileNameField
          isProfileNameHidden={isProfileNameHidden}
          isProfileNameReserved={isProfileNameReserved}
          label={message('options_newProfileName', 'Profile name')}
          name={name}
          onChange={setName}
          profileByName={profileByName}
        />
        <label>{message('options_profileType', 'Profile type')}</label>
        <ProfileTypeOption
          checked={profileType === 'FixedProfile'}
          description={message('options_profileDescFixedProfile', 'Tunneling traffic through proxy servers.')}
          icon={PROFILE_ICONS.FixedProfile}
          name="profile-new-type"
          onChange={setProfileType}
          title={message('options_profileTypeFixedProfile', 'Proxy Profile')}
          value="FixedProfile"
        />
        <ProfileTypeOption
          checked={profileType === 'SwitchProfile'}
          description={message('options_profileDescSwitchProfile', 'Applying different profiles automatically on various conditions such as domains or patterns.\n You can also import rules published online for easier switching. (Replaces AutoSwitch mode + Rule List.)')}
          icon={PROFILE_ICONS.SwitchProfile}
          name="profile-new-type"
          onChange={setProfileType}
          title={message('options_profileTypeSwitchProfile', 'Switch Profile')}
          value="SwitchProfile"
        />
        <ProfileTypeOption
          checked={profileType === 'PacProfile'}
          description={message('options_profileDescPacProfile', 'Choosing proxies using an online/local PAC script.')}
          disabled={pacProfilesUnsupported}
          extraHelp={!pacProfilesUnsupported ? message('options_profileDescMorePacProfile', "You will only need this if you have a PAC script or a URL to it. Don't try to create one unless you have knowledge about PAC.") : undefined}
          icon={PROFILE_ICONS.PacProfile}
          name="profile-new-type"
          onChange={setProfileType}
          title={message('options_profileTypePacProfile', 'PAC Profile')}
          value="PacProfile"
          warning={pacProfilesUnsupported ? message('options_pac_profile_unsupported_moz', 'PAC Profiles WILL NOT work in Mozilla Firefox due to technical limitations!') : undefined}
        />
        <ProfileTypeOption
          checked={profileType === 'VirtualProfile'}
          description={message('options_profileDescVirtualProfile', 'A virtual profile can act as any of the other profiles on demand. It works well with SwitchProfile, allowing you to change the result of multiple conditions by one click.')}
          icon={PROFILE_ICONS.VirtualProfile}
          name="profile-new-type"
          onChange={setProfileType}
          title={message('options_profileTypeVirtualProfile', 'Virtual Profile')}
          value="VirtualProfile"
        />
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-default" onClick={onDismiss}>
          {message('dialog_cancel', 'Cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid}>
          {message('options_createProfile', 'Create')}
        </button>
      </div>
    </form>
  );
}

function mountRenameProfile(element: Element, props: RenameProfileProps = {}) {
  const root = createRoot(element);
  root.render(<RenameProfileModal {...props} />);
  return {
    render(nextProps: RenameProfileProps = {}) {
      root.render(<RenameProfileModal {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

function mountNewProfile(element: Element, props: NewProfileProps = {}) {
  const root = createRoot(element);
  root.render(<NewProfileModal {...props} />);
  return {
    render(nextProps: NewProfileProps = {}) {
      root.render(<NewProfileModal {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactProfileModals = {
  mountNewProfile,
  mountRenameProfile
};
