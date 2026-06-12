import React, {useEffect, useMemo, useState} from 'react';
import {message} from './options_client';
import {PROFILE_ICONS, Profile} from './profile_widgets';
import {profileNameErrors, profileNameValid} from './profile_modals_logic';
import type {ProfileType} from './profile_types';

export type RenameProfileProps = {
  fromName?: string;
  isProfileNameHidden?: (name: string) => boolean;
  isProfileNameReserved?: (name: string) => boolean;
  onClose?: (name: string) => void;
  onDismiss?: () => void;
  profileByName?: (name: string) => Profile | null;
};

export type NewProfileProps = {
  isProfileNameHidden?: (name: string) => boolean;
  isProfileNameReserved?: (name: string) => boolean;
  onClose?: (profile: {name: string; profileType: ProfileType}) => void;
  onDismiss?: () => void;
  pacProfilesUnsupported?: boolean;
  profileByName?: (name: string) => Profile | null;
};

export type ProxyAuth = {
  password?: string;
  username?: string;
};

export type ProxyAuthProps = {
  auth?: ProxyAuth | null;
  authSupported?: boolean;
  onClose?: (auth: ProxyAuth) => void;
  onDismiss?: () => void;
  protocolDisp?: string;
};

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
  profileByName?: (name: string) => Profile | null;
}) {
  const errors = useMemo(() => profileNameErrors(name, fromName, isProfileNameReserved, profileByName), [
    fromName,
    isProfileNameReserved,
    name,
    profileByName
  ]);
  const valid = profileNameValid(errors);
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

export function RenameProfileModal({
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
  const valid = profileNameValid(errors);

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
  onChange: (type: ProfileType) => void;
  title: string;
  value: ProfileType;
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

export function NewProfileModal({
  isProfileNameHidden,
  isProfileNameReserved,
  onClose,
  onDismiss,
  pacProfilesUnsupported = false,
  profileByName
}: NewProfileProps) {
  const [name, setName] = useState('');
  const [profileType, setProfileType] = useState<ProfileType>('FixedProfile');
  const errors = useMemo(() => profileNameErrors(name, '', isProfileNameReserved, profileByName), [
    isProfileNameReserved,
    name,
    profileByName
  ]);
  const valid = profileNameValid(errors);

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

function ClearableInput({
  onChange,
  placeholder,
  type,
  value
}: {
  onChange: (value: string) => void;
  placeholder: string;
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
        placeholder={placeholder}
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

export function ProxyAuthModal({
  auth,
  authSupported = true,
  onClose,
  onDismiss,
  protocolDisp = ''
}: ProxyAuthProps) {
  const [username, setUsername] = useState(auth?.username || '');
  const [password, setPassword] = useState(auth?.password || '');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setUsername(auth?.username || '');
    setPassword(auth?.password || '');
  }, [auth]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onClose?.({username, password});
  }

  return (
    <form onSubmit={submit}>
      <div className="modal-header">
        <button type="button" className="close" onClick={onDismiss}>
          <span aria-hidden="true">{'\u00d7'}</span>
          <span className="sr-only">{message('dialog_close', 'Close')}</span>
        </button>
        <h4 className="modal-title">{message('options_modalHeader_proxyAuth', 'Proxy Authentication')}</h4>
      </div>
      <div className="modal-body" style={{paddingBottom: 0}}>
        {!authSupported && (
          <div className="form-group">
            <div className="alert alert-danger">
              <span className="glyphicon glyphicon-warning-sign" />{' '}
              {message(
                'options_proxy_authNotSupported',
                `Your browser DOES NOT support ${protocolDisp} proxy authentication! Please do not report this issue to SwitchyAgain. Contact the support for your browser instead.`,
                protocolDisp
              )}
            </div>
          </div>
        )}
        <div className="form-group">
          <label className="sr-only">{message('options_proxyAuthUsername', 'Username')}</label>
          <ClearableInput
            type="text"
            value={username}
            placeholder={message('options_proxyAuthUsername', 'Username')}
            onChange={setUsername}
          />
        </div>
        <div className="form-group">
          <label className="sr-only">{message('options_proxyAuthPassword', 'Password')}</label>
          <div className="input-group">
            {username ? (
              <input
                className="form-control"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                placeholder={message('options_proxyAuthPassword', 'Password')}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
            ) : (
              <input
                className="form-control"
                type="text"
                value=""
                placeholder={message('options_proxyAuthNone', 'No Authentication')}
                disabled
              />
            )}
            <span className="input-group-btn">
              <button
                type="button"
                className="btn btn-default"
                title={showPassword ? message('options_proxyAuthHidePassword', 'Hide password') : message('options_proxyAuthShowPassword', 'Show password')}
                disabled={!username}
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className={`glyphicon ${showPassword ? 'glyphicon-eye-open' : 'glyphicon-eye-close'}`} />
              </button>
            </span>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-default" onClick={onDismiss}>
          {message('dialog_cancel', 'Cancel')}
        </button>
        <button type="submit" className="btn btn-primary">
          {message('dialog_save', 'Save')}
        </button>
      </div>
    </form>
  );
}
