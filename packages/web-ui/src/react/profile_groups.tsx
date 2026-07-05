import React, {useMemo, useRef, useState} from 'react';
import {useOutsidePointer} from './dom_event_hooks';
import {message} from './i18n_client';
import type {Options} from './options_client_types';
import {cloneOptions} from './options_logic';
import {PROFILE_COLOR_SWATCHES} from './profile_content_logic';
import {ProfileInline, profilesForFilter, type Profile} from './profile_widgets';

export type ProfileGroup = {
  color?: string;
  icon?: string;
  id: string;
  name: string;
  order?: number;
};

export type ProfileGroupDraft = {
  color?: string;
  icon?: string;
  name: string;
};

export type ProfileGroupSurface = 'contextMenu' | 'options' | 'popup';

export type ProfileGroupProfile = {
  hiddenInContextMenu?: boolean;
  hiddenInOptions?: boolean;
  hiddenInPopup?: boolean;
  name: string;
  profileGroupEnabled?: boolean;
  profileGroupId?: string;
};

export type ProfileDisplayGroup<TProfile extends ProfileGroupProfile> = ProfileGroup & {
  profiles: TProfile[];
};

export type ProfileDisplayGroups<TProfile extends ProfileGroupProfile> = {
  groups: Array<ProfileDisplayGroup<TProfile>>;
  hidden: TProfile[];
  visible: TProfile[];
};

const GROUP_ID_PREFIX = 'group-';
const RESERVED_GROUP_NAMES = new Set(['default', 'hidden']);
export const DEFAULT_PROFILE_GROUP_ICON = 'glyphicon-folder-close';
export const PROFILE_GROUP_ICON_OPTIONS = [
  'glyphicon-glass',
  'glyphicon-music',
  'glyphicon-film',
  'glyphicon-home',
  'glyphicon-headphones',
  'glyphicon-facetime-video',
  'glyphicon-phone',
  'glyphicon-cutlery',
  'glyphicon-bishop'
];
const PROFILE_GROUP_ICON_CHOICES = [DEFAULT_PROFILE_GROUP_ICON, ...PROFILE_GROUP_ICON_OPTIONS];
const PROFILE_GROUP_COLOR_CHOICES = PROFILE_COLOR_SWATCHES;
const DEFAULT_PROFILE_GROUP_COLOR = PROFILE_GROUP_COLOR_CHOICES[0];

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function cleanGroupName(value: unknown) {
  return String(value || '').trim();
}

function cleanProfileGroupIcon(value: unknown) {
  return typeof value === 'string' && PROFILE_GROUP_ICON_CHOICES.includes(value) ? value : DEFAULT_PROFILE_GROUP_ICON;
}

function cleanProfileGroupColor(value: unknown) {
  const color = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) ? color : '';
}

function compareProfileGroup(a: ProfileGroup, b: ProfileGroup) {
  return a.name.localeCompare(b.name);
}

function normalizedGroupName(name: string) {
  return cleanGroupName(name).toLowerCase();
}

export function profileGroupNameError(name: string, groups: ProfileGroup[], currentGroupId?: string) {
  const normalized = normalizedGroupName(name);
  if (!normalized) {
    return message('options_profileGroupNameRequired', 'Group name is required.');
  }
  if (RESERVED_GROUP_NAMES.has(normalized)) {
    return message('options_profileGroupNameReserved', 'Default and Hidden are reserved group names.');
  }
  if (groups.some((group) => group.id !== currentGroupId && normalizedGroupName(group.name) === normalized)) {
    return message('options_profileGroupNameTaken', 'A profile group with this name already exists.');
  }
  return '';
}

export function profileGroupsEnabled(options?: Options | null) {
  return options?.['-profileGroupsEnabled'] === true;
}

export function profileGroupsForOptions(options?: Options | null): ProfileGroup[] {
  const rawGroups = options?.['-profileGroups'];
  if (!Array.isArray(rawGroups)) {
    return [];
  }
  const seen = new Set<string>();
  const groups: ProfileGroup[] = [];
  rawGroups.forEach((rawGroup, index) => {
    if (!isRecordValue(rawGroup)) {
      return;
    }
    const id = typeof rawGroup.id === 'string' ? rawGroup.id.trim() : '';
    const name = cleanGroupName(rawGroup.name);
    if (!id || !name || seen.has(id)) {
      return;
    }
    seen.add(id);
    groups.push({
      color: cleanProfileGroupColor(rawGroup.color) || undefined,
      icon: cleanProfileGroupIcon(rawGroup.icon),
      id,
      name,
      order: typeof rawGroup.order === 'number' ? rawGroup.order : index
    });
  });
  return groups.sort(compareProfileGroup);
}

export function profileGroupMap(groups: ProfileGroup[]) {
  const map: Record<string, ProfileGroup | undefined> = {};
  groups.forEach((group) => {
    map[group.id] = group;
  });
  return map;
}

export function profileGroupIdForProfile(profile: ProfileGroupProfile, groups: ProfileGroup[], enabled: boolean) {
  if (!enabled || profile.profileGroupEnabled !== true || typeof profile.profileGroupId !== 'string') {
    return '';
  }
  return profileGroupMap(groups)[profile.profileGroupId] ? profile.profileGroupId : '';
}

function profileHiddenInSurface(profile: ProfileGroupProfile, surface: ProfileGroupSurface) {
  switch (surface) {
    case 'contextMenu':
      return profile.hiddenInContextMenu === true;
    case 'options':
      return profile.hiddenInOptions === true;
    case 'popup':
    default:
      return profile.hiddenInPopup === true;
  }
}

export function splitProfilesByGroup<TProfile extends ProfileGroupProfile>(
  profiles: TProfile[],
  groups: ProfileGroup[],
  enabled: boolean,
  surface: ProfileGroupSurface,
  activeProfileName?: string
): ProfileDisplayGroups<TProfile> {
  const visible: TProfile[] = [];
  const hidden: TProfile[] = [];
  const groupedProfiles: Record<string, TProfile[]> = {};
  const groupLookup = profileGroupMap(groups);
  for (const profile of profiles) {
    const groupId = profileGroupIdForProfile(profile, groups, enabled);
    if (groupId) {
      (groupedProfiles[groupId] ||= []).push(profile);
      continue;
    }
    if (profileHiddenInSurface(profile, surface) && profile.name !== activeProfileName) {
      hidden.push(profile);
    } else {
      visible.push(profile);
    }
  }
  return {
    visible,
    hidden,
    groups: groups
      .filter((group) => groupLookup[group.id] && groupedProfiles[group.id]?.length)
      .map((group) => ({
        ...group,
        profiles: groupedProfiles[group.id]
      }))
  };
}

export function profileGroupDisplayName(group?: ProfileGroup | null) {
  return group?.name || '';
}

export function profileGroupIcon(group?: ProfileGroup | null) {
  return cleanProfileGroupIcon(group?.icon);
}

export function profileGroupColor(group?: ProfileGroup | null) {
  return cleanProfileGroupColor(group?.color);
}

export function createProfileGroupId(name: string, existingGroups: ProfileGroup[]) {
  const existing = new Set(existingGroups.map((group) => group.id));
  const base =
    cleanGroupName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'profile-group';
  let id = `${GROUP_ID_PREFIX}${base}`;
  let index = 2;
  while (existing.has(id)) {
    id = `${GROUP_ID_PREFIX}${base}-${index}`;
    index++;
  }
  return id;
}

function groupDraftFromInput(input: string | ProfileGroupDraft): ProfileGroupDraft {
  return typeof input === 'string' ? {name: input} : input;
}

export function addProfileGroup(options: Options, input: string | ProfileGroupDraft) {
  const draft = groupDraftFromInput(input);
  const groups = profileGroupsForOptions(options);
  const nextGroup: ProfileGroup = {
    color: cleanProfileGroupColor(draft.color) || DEFAULT_PROFILE_GROUP_COLOR,
    icon: cleanProfileGroupIcon(draft.icon),
    id: createProfileGroupId(draft.name, groups),
    name: cleanGroupName(draft.name)
  };
  options['-profileGroups'] = groups.concat(nextGroup);
  return nextGroup;
}

export function ProfileGroupIcon({group}: {group?: ProfileGroup | null}) {
  const color = profileGroupColor(group);
  return <span className={`glyphicon ${profileGroupIcon(group)}`} style={color ? {color} : undefined} />;
}

function profileGroupForProfile(profile: ProfileGroupProfile, groups: ProfileGroup[]) {
  if (profile.profileGroupEnabled !== true || typeof profile.profileGroupId !== 'string') {
    return null;
  }
  return profileGroupMap(groups)[profile.profileGroupId] || null;
}

function groupAssignmentLabel(profile: ProfileGroupProfile, groups: ProfileGroup[]) {
  const group = profileGroupForProfile(profile, groups);
  return group ? group.name : message('options_profileGroupUngrouped', 'Ungrouped');
}

function ProfileGroupSelect({groups, value, onChange}: {groups: ProfileGroup[]; value: string; onChange: (value: string) => void}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedGroup = groups.find((group) => group.id === value) || null;
  useOutsidePointer(rootRef, () => setOpen(false), open);

  function choose(groupId: string) {
    onChange(groupId);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`btn-group profile-group-select ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="btn btn-default dropdown-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="true"
        role="listbox"
        onClick={() => setOpen(!open)}
      >
        <span className="glyphicon glyphicon-share-alt" />{' '}
        <span>{selectedGroup ? selectedGroup.name : message('options_profileGroupUngrouped', 'Ungrouped')}</span> <span className="caret" />
      </button>
      {open && (
        <ul className="dropdown-menu" role="listbox">
          <li role="option" className={value ? '' : 'active'}>
            <a onClick={() => choose('')}>
              <span className="glyphicon glyphicon-share-alt" /> {message('options_profileGroupUngrouped', 'Ungrouped')}
            </a>
          </li>
          {groups.map((group) => (
            <li key={group.id} role="option" className={value === group.id ? 'active' : ''}>
              <a onClick={() => choose(group.id)}>
                <span className="glyphicon glyphicon-folder-close" /> {group.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProfileGroupModal({
  initialColor,
  initialIcon = DEFAULT_PROFILE_GROUP_ICON,
  initialName = '',
  title,
  action,
  onCancel,
  groups = [],
  currentGroupId,
  onSubmit
}: {
  action: string;
  currentGroupId?: string;
  groups?: ProfileGroup[];
  initialColor?: string;
  initialIcon?: string;
  initialName?: string;
  onCancel: () => void;
  onSubmit: (group: ProfileGroupDraft) => void;
  title: string;
}) {
  const [color, setColor] = useState(cleanProfileGroupColor(initialColor) || DEFAULT_PROFILE_GROUP_COLOR);
  const [icon, setIcon] = useState(cleanProfileGroupIcon(initialIcon));
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  const error = profileGroupNameError(trimmed, groups, currentGroupId);
  const submit = () => {
    if (!trimmed || error) {
      return;
    }
    onSubmit({
      color,
      icon,
      name: trimmed
    });
  };
  return (
    <>
      <div className="modal-backdrop fade in" />
      <div
        className="modal fade in options-modal"
        role="dialog"
        style={{display: 'flex'}}
        tabIndex={-1}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onCancel();
          }
        }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" aria-label={message('options_modalClose', 'Close')} onClick={onCancel}>
                <span aria-hidden="true">{'\u00d7'}</span>
              </button>
              <h4 className="modal-title">{title}</h4>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{message('options_profileGroupName', 'Group name')}</label>
                <input
                  autoFocus
                  className="form-control"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && trimmed && !error) {
                      submit();
                    }
                  }}
                />
                {error && <p className="help-block text-danger">{error}</p>}
              </div>
              <div className="form-group">
                <label>{message('options_profileGroupIcon', 'Icon')}</label>
                <div className="profile-group-icon-picker">
                  {PROFILE_GROUP_ICON_CHOICES.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      className={`btn btn-default profile-group-icon-option${icon === choice ? ' active' : ''}`}
                      aria-label={choice.replace(/^glyphicon-/, '')}
                      onClick={() => setIcon(choice)}
                    >
                      <span className={`glyphicon ${choice}`} style={{color}} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>{message('options_profileGroupColor', 'Color')}</label>
                <div className="profile-group-color-picker">
                  {PROFILE_GROUP_COLOR_CHOICES.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      className={`profile-color-swatch-option${cleanProfileGroupColor(choice) === color ? ' active' : ''}`}
                      style={{backgroundColor: choice}}
                      title={choice}
                      aria-label={message('options_profileUseColor', `Use ${choice}`, choice)}
                      onClick={() => setColor(choice)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-default" onClick={onCancel}>
                {message('options_cancel', 'Cancel')}
              </button>
              <button type="button" className="btn btn-primary" disabled={!trimmed || !!error} onClick={submit}>
                {action}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

type DeleteState = {
  group: ProfileGroup;
  members: Profile[];
  targetGroupId: string;
} | null;

export function ProfileGroupsPage({onOptionsChange, options}: {onOptionsChange: (options: Options) => void; options: Options}) {
  const groups = profileGroupsForOptions(options);
  const profiles = useMemo(() => profilesForFilter(options, 'sorted'), [options]);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameGroup, setRenameGroup] = useState<ProfileGroup | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);

  function updateOptions(updater: (nextOptions: Options) => void) {
    const nextOptions = cloneOptions(options);
    updater(nextOptions);
    onOptionsChange(nextOptions);
  }

  function updateProfileGroup(profileName: string, groupId: string) {
    updateOptions((nextOptions) => {
      const profile = profilesForFilter(nextOptions).find((candidate) => candidate.name === profileName);
      if (!profile) {
        return;
      }
      if (groupId) {
        profile.profileGroupEnabled = true;
        profile.profileGroupId = groupId;
      } else {
        profile.profileGroupEnabled = false;
      }
    });
  }

  function createGroup(groupDraft: ProfileGroupDraft) {
    updateOptions((nextOptions) => {
      addProfileGroup(nextOptions, groupDraft);
    });
    setCreateOpen(false);
  }

  function renameSelectedGroup(groupDraft: ProfileGroupDraft) {
    if (!renameGroup) {
      return;
    }
    updateOptions((nextOptions) => {
      const nextGroups = profileGroupsForOptions(nextOptions).map((group) =>
        group.id === renameGroup.id
          ? {
              ...group,
              color: cleanProfileGroupColor(groupDraft.color) || group.color,
              icon: cleanProfileGroupIcon(groupDraft.icon),
              name: groupDraft.name
            }
          : group
      );
      nextOptions['-profileGroups'] = nextGroups;
    });
    setRenameGroup(null);
  }

  function groupMembers(groupId: string) {
    return profiles.filter((profile) => profile.profileGroupId === groupId);
  }

  function requestDeleteGroup(group: ProfileGroup) {
    const members = groupMembers(group.id);
    setDeleteState({
      group,
      members,
      targetGroupId: ''
    });
  }

  function confirmDeleteGroup() {
    if (!deleteState) {
      return;
    }
    updateOptions((nextOptions) => {
      nextOptions['-profileGroups'] = profileGroupsForOptions(nextOptions).filter((group) => group.id !== deleteState.group.id);
      profilesForFilter(nextOptions).forEach((profile) => {
        if (profile.profileGroupId !== deleteState.group.id) {
          return;
        }
        if (deleteState.targetGroupId) {
          profile.profileGroupId = deleteState.targetGroupId;
          profile.profileGroupEnabled = true;
        } else {
          delete profile.profileGroupId;
          profile.profileGroupEnabled = false;
        }
      });
    });
    setDeleteState(null);
  }

  return (
    <>
      <div className="page-header">
        <h2>{message('options_tab_profileGroups', 'Profile Groups')}</h2>
      </div>

      <section className="settings-group profile-groups-settings-group">
        <div className="profile-scope-section-heading">
          <h3>{message('options_profileGroupsGroupsSection', 'Groups')}</h3>
          <button className="btn btn-default profile-groups-add-button" type="button" onClick={() => setCreateOpen(true)}>
            <span className="glyphicon glyphicon-plus" aria-hidden="true" /> {message('options_profileGroupNew', 'New Group')}
          </button>
        </div>
        {groups.length ? (
          <table className="table table-striped profile-groups-table">
            <thead>
              <tr>
                <th>{message('options_profileGroupColumnGroup', 'Group')}</th>
                <th>{message('options_profileGroupColumnProfiles', 'Profiles')}</th>
                <th>{message('options_profileGroupColumnActions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const members = groupMembers(group.id);
                return (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td>{members.length}</td>
                    <td>
                      <button className="btn btn-default btn-xs" type="button" onClick={() => setRenameGroup(group)}>
                        <span className="glyphicon glyphicon-edit" aria-hidden="true" /> {message('options_rename', 'Rename')}
                      </button>{' '}
                      <button className="btn btn-danger btn-xs" type="button" onClick={() => requestDeleteGroup(group)}>
                        <span className="glyphicon glyphicon-trash" aria-hidden="true" /> {message('options_delete', 'Delete')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">{message('options_profileGroupsEmpty', 'No profile groups have been created.')}</p>
        )}
      </section>

      <section className="settings-group profile-groups-settings-group">
        <h3>{message('options_profileGroupsProfilesSection', 'Profile Assignment')}</h3>
        {profiles.length ? (
          <table className="table table-striped profile-groups-table profile-groups-assignment-table">
            <thead>
              <tr>
                <th>{message('options_profileGroupColumnProfile', 'Profile')}</th>
                <th>{message('options_profileGroupColumnGroup', 'Group')}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.name}>
                  <td>
                    <ProfileInline profile={profile} />
                  </td>
                  <td>
                    <ProfileGroupSelect
                      groups={groups}
                      value={profile.profileGroupEnabled === true && profile.profileGroupId ? profile.profileGroupId : ''}
                      onChange={(groupId) => updateProfileGroup(profile.name, groupId)}
                    />
                    {!profile.profileGroupEnabled && profile.profileGroupId && (
                      <p className="help-block profile-groups-retained-group">
                        {message(
                          'options_profileGroupRetainedGroup',
                          'Previous group is retained: {0}',
                          groupAssignmentLabel(
                            {
                              ...profile,
                              profileGroupEnabled: true
                            },
                            groups
                          )
                        )}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">{message('options_profileGroupsProfilesEmpty', 'No profiles are available.')}</p>
        )}
      </section>

      {createOpen && (
        <ProfileGroupModal
          action={message('options_profileGroupCreate', 'Create')}
          groups={groups}
          title={message('options_profileGroupCreateTitle', 'New Profile Group')}
          onCancel={() => setCreateOpen(false)}
          onSubmit={createGroup}
        />
      )}
      {renameGroup && (
        <ProfileGroupModal
          action={message('options_profileGroupSave', 'Save')}
          currentGroupId={renameGroup.id}
          groups={groups}
          initialColor={renameGroup.color}
          initialIcon={renameGroup.icon}
          initialName={renameGroup.name}
          title={message('options_profileGroupRenameTitle', 'Rename Profile Group')}
          onCancel={() => setRenameGroup(null)}
          onSubmit={renameSelectedGroup}
        />
      )}
      {deleteState && (
        <>
          <div className="modal-backdrop fade in" />
          <div
            className="modal fade in options-modal"
            role="dialog"
            style={{display: 'flex'}}
            tabIndex={-1}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setDeleteState(null);
              }
            }}
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <button
                    type="button"
                    className="close"
                    aria-label={message('options_modalClose', 'Close')}
                    onClick={() => setDeleteState(null)}
                  >
                    <span aria-hidden="true">{'\u00d7'}</span>
                  </button>
                  <h4 className="modal-title">{message('options_profileGroupDeleteTitle', 'Delete Profile Group')}</h4>
                </div>
                <div className="modal-body">
                  <p>
                    {deleteState.members.length
                      ? message(
                          'options_profileGroupDeleteMoveHelp',
                          'This group contains {0} profiles. Move them before deleting the group.',
                          String(deleteState.members.length)
                        )
                      : message('options_profileGroupDeleteHelp', 'Delete this empty profile group?')}
                  </p>
                  {deleteState.members.length > 0 && (
                    <div className="form-group">
                      <label>{message('options_profileGroupMoveTo', 'Move profiles to')}</label>
                      <ProfileGroupSelect
                        groups={groups.filter((group) => group.id !== deleteState.group.id)}
                        value={deleteState.targetGroupId}
                        onChange={(targetGroupId) =>
                          setDeleteState({
                            ...deleteState,
                            targetGroupId
                          })
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-default" onClick={() => setDeleteState(null)}>
                    {message('options_cancel', 'Cancel')}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={confirmDeleteGroup}>
                    {deleteState.members.length
                      ? message('options_profileGroupMoveAndDelete', 'Move and Delete')
                      : message('options_delete', 'Delete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
