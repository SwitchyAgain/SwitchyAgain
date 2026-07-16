import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useOutsidePointer} from './dom_event_hooks';
import {message} from './i18n_client';
import {PROFILE_COLOR_SWATCHES} from './profile_content_logic';
import {PROFILE_ICONS, Profile, ProfileSelect} from './profile_widgets';
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
  duplicatableProfiles?: Profile[];
  isProfileNameHidden?: (name: string) => boolean;
  isProfileNameReserved?: (name: string) => boolean;
  onClose?: (profile: NewProfileSpec) => void;
  onDismiss?: () => void;
  pacProfilesUnsupported?: boolean;
  profileByName?: (name: string) => Profile | null;
};

export type NewProfileSpec =
  | {
      color?: string;
      name: string;
      profileType: ProfileType;
    }
  | {
      color?: string;
      duplicateProfileName: string;
      name: string;
    };

export type ProxyAuth = {
  password?: string;
  username?: string;
};

export type ProxyAuthProps = {
  auth?: ProxyAuth | null;
  onClose?: (auth: ProxyAuth) => void;
  onDismiss?: () => void;
};

function ProfileNameField({
  fromName = '',
  isProfileNameHidden,
  isProfileNameReserved,
  label,
  name,
  onChange,
  trailingControl,
  profileByName
}: {
  fromName?: string;
  isProfileNameHidden?: (name: string) => boolean;
  isProfileNameReserved?: (name: string) => boolean;
  label: string;
  name: string;
  onChange: (name: string) => void;
  trailingControl?: React.ReactNode;
  profileByName?: (name: string) => Profile | null;
}) {
  const errors = useMemo(
    () => profileNameErrors(name, fromName, isProfileNameReserved, profileByName),
    [fromName, isProfileNameReserved, name, profileByName]
  );
  const valid = profileNameValid(errors);
  const hidden = valid && Boolean(name && isProfileNameHidden?.(name));

  return (
    <div className={`form-group ${valid ? '' : 'has-error'}`}>
      <label htmlFor="profile-new-name">{label}</label>
      {trailingControl ? (
        <div className="input-group profile-name-input-group">
          <input
            id="profile-new-name"
            className="form-control"
            type="text"
            name="profileNewName"
            required
            value={name}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <span className="input-group-btn">{trailingControl}</span>
        </div>
      ) : (
        <input
          id="profile-new-name"
          className="form-control"
          type="text"
          name="profileNewName"
          required
          value={name}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}
      {errors.required && (
        <div className="help-block">{message('options_profileNameEmpty', 'The name of the profile must not be empty.')}</div>
      )}
      {errors.reserved && (
        <div className="help-block">
          {message('options_profileNameReserved', 'Profile names beginning with double-underscore are reserved.')}
        </div>
      )}
      {!errors.reserved && errors.conflict && (
        <div className="help-block">{message('options_profileNameConflict', 'A profile with this name already exists.')}</div>
      )}
      {hidden && (
        <div className="help-block">
          <div className="text-info">
            <span className="glyphicon glyphicon-info-sign" />{' '}
            {message(
              'options_profileNameHidden',
              'Profiles with names starting with underscore will be hidden on the popup menu. However, they can still be used in places like switch profile results.'
            )}
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

  const errors = useMemo(
    () => profileNameErrors(trimmedName, fromName, isProfileNameReserved, profileByName),
    [fromName, isProfileNameReserved, profileByName, trimmedName]
  );
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
        <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} />
        <span className="profile-type">
          <span className={`glyphicon ${icon} ${value === 'VirtualProfile' ? 'virtual-profile-icon' : ''}`} /> <span>{title}</span>
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

function NewProfileColorControl({color, onChange}: {color: string; onChange: (color: string) => void}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  useOutsidePointer(rootRef, () => setOpen(false), open);

  function choose(nextColor: string) {
    onChange(nextColor);
    setOpen(false);
  }

  return (
    <span ref={rootRef} className={`profile-new-color-control ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="btn btn-default profile-new-color-button"
        title={message('options_profileColor', 'Profile color')}
        aria-label={message('options_profileColor', 'Profile color')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <span
          className={`profile-new-color-swatch ${color ? '' : 'profile-new-color-swatch-auto'}`}
          style={color ? {backgroundColor: color} : undefined}
        />
      </button>
      {open && (
        <div className="profile-new-color-popover" role="dialog" aria-label={message('options_profileColor', 'Profile color')}>
          <button
            type="button"
            className={`profile-new-color-auto-option${color ? '' : ' active'}`}
            title={message('options_profileAutomaticColor', 'Automatic')}
            aria-label={message('options_profileAutomaticColor', 'Automatic')}
            onClick={() => choose('')}
          >
            <span className="profile-new-color-auto-swatch" />
          </button>
          <div className="profile-new-color-swatch-grid">
            {PROFILE_COLOR_SWATCHES.map((choice) => (
              <button
                key={choice}
                type="button"
                className={`profile-color-swatch-option${choice === color ? ' active' : ''}`}
                style={{backgroundColor: choice}}
                title={choice}
                aria-label={message('options_profileUseColor', `Use color ${choice}`, choice)}
                onClick={() => choose(choice)}
              />
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

export function NewProfileModal({
  duplicatableProfiles = [],
  isProfileNameHidden,
  isProfileNameReserved,
  onClose,
  onDismiss,
  pacProfilesUnsupported = false,
  profileByName
}: NewProfileProps) {
  const [name, setName] = useState('');
  const [createMode, setCreateMode] = useState<'profile' | 'duplicate'>('profile');
  const [duplicateProfileName, setDuplicateProfileName] = useState('');
  const [profileColor, setProfileColor] = useState('');
  const [profileType, setProfileType] = useState<ProfileType>('FixedProfile');
  const errors = useMemo(
    () => profileNameErrors(name, '', isProfileNameReserved, profileByName),
    [isProfileNameReserved, name, profileByName]
  );
  const duplicateSelected = createMode === 'duplicate';
  const duplicateProfileSelected = !duplicateSelected || Boolean(duplicateProfileName);
  const duplicateProfilesAvailable = duplicatableProfiles.length > 0;
  const duplicateSourceLabel = message('options_profileDuplicateSource', 'Profile');
  const duplicateSourcePlaceholder = message('options_profileDuplicateSourcePlaceholder', 'Select a profile');
  const valid = profileNameValid(errors) && duplicateProfileSelected;

  function selectProfileType(type: ProfileType) {
    setCreateMode('profile');
    setProfileType(type);
  }

  function selectDuplicateProfile() {
    if (duplicateProfilesAvailable) {
      setCreateMode('duplicate');
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (valid) {
      if (duplicateSelected) {
        onClose?.({
          ...(profileColor ? {color: profileColor} : {}),
          duplicateProfileName,
          name
        });
        return;
      }
      onClose?.({
        ...(profileColor ? {color: profileColor} : {}),
        name,
        profileType
      });
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
          trailingControl={<NewProfileColorControl color={profileColor} onChange={setProfileColor} />}
        />
        <label>{message('options_profileType', 'Please select the type of the profile:')}</label>
        <ProfileTypeOption
          checked={!duplicateSelected && profileType === 'FixedProfile'}
          description={message('options_profileDescFixedProfile', 'Tunneling traffic through proxy servers.')}
          icon={PROFILE_ICONS.FixedProfile}
          name="profile-new-type"
          onChange={selectProfileType}
          title={message('options_profileTypeFixedProfile', 'Proxy Profile')}
          value="FixedProfile"
        />
        <ProfileTypeOption
          checked={!duplicateSelected && profileType === 'SwitchProfile'}
          description={message(
            'options_profileDescSwitchProfile',
            'Applying different profiles automatically on various conditions such as domains or patterns.\n You can also import rules published online for easier switching. (Replaces AutoSwitch mode + Rule List.)'
          )}
          icon={PROFILE_ICONS.SwitchProfile}
          name="profile-new-type"
          onChange={selectProfileType}
          title={message('options_profileTypeSwitchProfile', 'Switch Profile')}
          value="SwitchProfile"
        />
        <ProfileTypeOption
          checked={!duplicateSelected && profileType === 'PacProfile'}
          description={message('options_profileDescPacProfile', 'Choosing proxies using an online/local PAC script.')}
          disabled={pacProfilesUnsupported}
          extraHelp={
            !pacProfilesUnsupported
              ? message(
                  'options_profileDescMorePacProfile',
                  "You will only need this if you have a PAC script or a URL to it. Don't try to create one unless you have knowledge about PAC."
                )
              : undefined
          }
          icon={PROFILE_ICONS.PacProfile}
          name="profile-new-type"
          onChange={selectProfileType}
          title={message('options_profileTypePacProfile', 'PAC Profile')}
          value="PacProfile"
          warning={
            pacProfilesUnsupported
              ? message(
                  'options_pac_profile_unsupported_moz',
                  'PAC Profiles WILL NOT work in Mozilla Firefox due to technical limitations!'
                )
              : undefined
          }
        />
        <ProfileTypeOption
          checked={!duplicateSelected && profileType === 'VirtualProfile'}
          description={message(
            'options_profileDescVirtualProfile',
            'A virtual profile can act as any of the other profiles on demand. It works well with SwitchProfile, allowing you to change the result of multiple conditions by one click.'
          )}
          icon={PROFILE_ICONS.VirtualProfile}
          name="profile-new-type"
          onChange={selectProfileType}
          title={message('options_profileTypeVirtualProfile', 'Virtual Profile')}
          value="VirtualProfile"
        />
        <div className="radio">
          <label className={duplicateProfilesAvailable ? '' : 'text-muted'}>
            <input
              type="radio"
              name="profile-new-type"
              value="DuplicateProfile"
              checked={duplicateSelected}
              disabled={!duplicateProfilesAvailable}
              onChange={selectDuplicateProfile}
            />
            <span className="profile-type">
              <span className="glyphicon glyphicon-duplicate" /> <span>{message('options_profileTypeDuplicate', 'Duplicate')}</span>
            </span>
            <div className="help-block profile-duplicate-description">
              {message('options_profileDescDuplicate', 'Create a new profile by copying an existing profile.')}
            </div>
            {!duplicateProfilesAvailable && (
              <div className="help-block">{message('options_profileDuplicateEmpty', 'No profiles available to duplicate.')}</div>
            )}
          </label>
          {duplicateSelected && duplicateProfilesAvailable && (
            <div className="profile-duplicate-source">
              <span className="profile-duplicate-source-label">{duplicateSourceLabel}</span>{' '}
              <ProfileSelect
                ariaLabel={duplicateSourceLabel}
                autoDropup
                defaultIcon="glyphicon-question-sign"
                defaultText={duplicateSourcePlaceholder}
                inline
                name={duplicateProfileName}
                onChange={setDuplicateProfileName}
                profiles={duplicatableProfiles}
              />
              {!duplicateProfileName && (
                <div className="help-block">
                  {message('options_profileDuplicateSourceRequired', 'Please select a profile to duplicate.')}
                </div>
              )}
            </div>
          )}
        </div>
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

export function ProxyAuthModal({auth, onClose, onDismiss}: ProxyAuthProps) {
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
                title={
                  showPassword
                    ? message('options_proxyAuthHidePassword', 'Hide password')
                    : message('options_proxyAuthShowPassword', 'Show password')
                }
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
          {message('dialog_save', 'Save changes')}
        </button>
      </div>
    </form>
  );
}
