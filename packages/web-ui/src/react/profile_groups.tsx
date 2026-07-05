import React, {useMemo, useRef, useState} from 'react';
import {useOutsidePointer} from './dom_event_hooks';
import {message} from './i18n_client';
import type {Options} from './options_client_types';
import {cloneOptions} from './options_logic';
import {PROFILE_COLOR_SWATCHES} from './profile_content_logic';
import {ProfileInline, ProfileSelect, profilesForFilter, type Profile} from './profile_widgets';

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

function ProfileGroupInline({group}: {group?: ProfileGroup | null}) {
  return (
    <span className="profile-groups-group-cell">
      <span className="profile-groups-group-icon" aria-hidden="true">
        {group ? <ProfileGroupIcon group={group} /> : <span className="glyphicon glyphicon-share-alt" />}
      </span>
      <span className="profile-groups-group-name">{group ? group.name : message('options_profileGroupUngrouped', 'Ungrouped')}</span>
    </span>
  );
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

function ProfileGroupSelect({
  ariaLabel,
  disabled = false,
  groups,
  inline = false,
  value,
  onChange
}: {
  ariaLabel?: string;
  disabled?: boolean;
  groups: ProfileGroup[];
  inline?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedGroup = groups.find((group) => group.id === value) || null;
  const selectStyle: React.CSSProperties = inline ? {display: 'inline-block', width: 'auto'} : {display: 'inline-block'};
  useOutsidePointer(rootRef, () => setOpen(false), open);

  function choose(groupId: string) {
    onChange(groupId);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`btn-group profile-group-select ${inline ? 'profile-group-select-inline' : ''} ${open ? 'open' : ''}`}
      style={selectStyle}
    >
      <button
        type="button"
        className="btn btn-default dropdown-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="true"
        aria-label={ariaLabel}
        disabled={disabled}
        role="listbox"
        onClick={() => setOpen(!open)}
      >
        <ProfileGroupInline group={selectedGroup} /> <span className="caret" />
      </button>
      {open && (
        <ul className="dropdown-menu" role="listbox">
          <li role="option" className={value ? '' : 'active'}>
            <a onClick={() => choose('')}>
              <ProfileGroupInline group={null} />
            </a>
          </li>
          {groups.map((group) => (
            <li key={group.id} role="option" className={value === group.id ? 'active' : ''}>
              <a onClick={() => choose(group.id)}>
                <ProfileGroupInline group={group} />
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
  advancedOpen: boolean;
  group: ProfileGroup;
  members: Profile[];
  profileTargetGroupIds: Record<string, string>;
  targetGroupId: string;
} | null;

type MoveGroupState = {
  bulkEnabled: boolean;
  group: ProfileGroup;
  members: Profile[];
  profileTargetGroupIds: Record<string, string>;
  selectedProfileNames: Record<string, boolean>;
  targetGroupId: string;
} | null;

export function ProfileGroupsPage({onOptionsChange, options}: {onOptionsChange: (options: Options) => void; options: Options}) {
  const groups = useMemo(() => profileGroupsForOptions(options), [options]);
  const groupLookup = useMemo(() => profileGroupMap(groups), [groups]);
  const profiles = useMemo(() => profilesForFilter(options, 'sorted'), [options]);
  const [advancedAssignmentsOpen, setAdvancedAssignmentsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameGroup, setRenameGroup] = useState<ProfileGroup | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [moveGroupState, setMoveGroupState] = useState<MoveGroupState>(null);
  const [moveSourceGroupId, setMoveSourceGroupId] = useState('');
  const [moveProfileName, setMoveProfileName] = useState('');
  const [moveTargetGroupId, setMoveTargetGroupId] = useState('');

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

  function currentProfileGroupId(profile: Profile) {
    if (profile.profileGroupEnabled !== true || typeof profile.profileGroupId !== 'string') {
      return '';
    }
    return groupLookup[profile.profileGroupId] ? profile.profileGroupId : '';
  }

  function updateMoveSourceGroup(groupId: string) {
    setMoveSourceGroupId(groupId);
    setMoveProfileName('');
    setMoveTargetGroupId(groupId);
  }

  function updateMoveProfile(profileName: string) {
    setMoveProfileName(profileName);
  }

  const effectiveMoveSourceGroupId = moveSourceGroupId && groupLookup[moveSourceGroupId] ? moveSourceGroupId : '';
  const effectiveMoveTargetGroupId = moveTargetGroupId && groupLookup[moveTargetGroupId] ? moveTargetGroupId : '';
  const moveProfileOptions = profiles.filter((profile) => currentProfileGroupId(profile) === effectiveMoveSourceGroupId);
  const selectedMoveProfile = moveProfileOptions.find((profile) => profile.name === moveProfileName) || moveProfileOptions[0] || null;
  const selectedMoveProfileGroupId = selectedMoveProfile ? currentProfileGroupId(selectedMoveProfile) : effectiveMoveSourceGroupId;
  const canMoveProfile = !!selectedMoveProfile && effectiveMoveTargetGroupId !== selectedMoveProfileGroupId;

  function moveSelectedProfile() {
    if (!selectedMoveProfile || !canMoveProfile) {
      return;
    }
    updateProfileGroup(selectedMoveProfile.name, effectiveMoveTargetGroupId);
    setMoveProfileName('');
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
    return profiles.filter((profile) => profile.profileGroupEnabled === true && profile.profileGroupId === groupId);
  }

  function validMoveGroupTargetId(sourceGroupId: string, targetGroupId: string) {
    return targetGroupId && targetGroupId !== sourceGroupId && groupLookup[targetGroupId] ? targetGroupId : '';
  }

  function requestMoveGroupProfiles(group: ProfileGroup) {
    setMoveGroupState({
      bulkEnabled: false,
      group,
      members: groupMembers(group.id),
      profileTargetGroupIds: {},
      selectedProfileNames: {},
      targetGroupId: ''
    });
  }

  function moveGroupProfileSelected(profileName: string) {
    return moveGroupState?.selectedProfileNames[profileName] === true;
  }

  function moveGroupProfileTargetId(profileName: string) {
    if (!moveGroupState) {
      return '';
    }
    const targetGroupId = moveGroupState.profileTargetGroupIds[profileName] || '';
    return validMoveGroupTargetId(moveGroupState.group.id, targetGroupId);
  }

  function updateMoveGroupBulkEnabled(bulkEnabled: boolean) {
    if (!moveGroupState) {
      return;
    }
    setMoveGroupState({
      ...moveGroupState,
      bulkEnabled
    });
  }

  function updateMoveGroupTargetGroup(targetGroupId: string) {
    if (!moveGroupState) {
      return;
    }
    const nextTargetGroupId = validMoveGroupTargetId(moveGroupState.group.id, targetGroupId);
    setMoveGroupState({
      ...moveGroupState,
      targetGroupId: nextTargetGroupId
    });
  }

  function updateMoveGroupProfileSelected(profileName: string, selected: boolean) {
    if (!moveGroupState) {
      return;
    }
    const nextSelectedProfileNames = {...moveGroupState.selectedProfileNames};
    const nextProfileTargetGroupIds = {...moveGroupState.profileTargetGroupIds};
    if (selected) {
      nextSelectedProfileNames[profileName] = true;
      nextProfileTargetGroupIds[profileName] = nextProfileTargetGroupIds[profileName] || '';
    } else {
      delete nextSelectedProfileNames[profileName];
      delete nextProfileTargetGroupIds[profileName];
    }
    setMoveGroupState({
      ...moveGroupState,
      profileTargetGroupIds: nextProfileTargetGroupIds,
      selectedProfileNames: nextSelectedProfileNames
    });
  }

  function updateMoveGroupProfileTargetGroup(profileName: string, targetGroupId: string) {
    if (!moveGroupState) {
      return;
    }
    setMoveGroupState({
      ...moveGroupState,
      profileTargetGroupIds: {
        ...moveGroupState.profileTargetGroupIds,
        [profileName]: validMoveGroupTargetId(moveGroupState.group.id, targetGroupId)
      }
    });
  }

  const selectedMoveGroupProfileCount = moveGroupState
    ? moveGroupState.members.filter((profile) => moveGroupState.selectedProfileNames[profile.name]).length
    : 0;
  const moveGroupTargetGroups = moveGroupState ? groups.filter((group) => group.id !== moveGroupState.group.id) : [];
  const effectiveMoveGroupTargetId = moveGroupState ? validMoveGroupTargetId(moveGroupState.group.id, moveGroupState.targetGroupId) : '';
  const canConfirmMoveGroupProfiles = !!moveGroupState?.members.length && (moveGroupState.bulkEnabled || selectedMoveGroupProfileCount > 0);

  function confirmMoveGroupProfiles() {
    if (!moveGroupState || !canConfirmMoveGroupProfiles) {
      return;
    }
    const selectedProfileNames = moveGroupState.bulkEnabled
      ? new Set(moveGroupState.members.map((profile) => profile.name))
      : new Set(
          moveGroupState.members.filter((profile) => moveGroupState.selectedProfileNames[profile.name]).map((profile) => profile.name)
        );
    updateOptions((nextOptions) => {
      profilesForFilter(nextOptions).forEach((profile) => {
        if (
          !selectedProfileNames.has(profile.name) ||
          profile.profileGroupEnabled !== true ||
          profile.profileGroupId !== moveGroupState.group.id
        ) {
          return;
        }
        const targetGroupId = moveGroupState.bulkEnabled
          ? effectiveMoveGroupTargetId
          : validMoveGroupTargetId(moveGroupState.group.id, moveGroupProfileTargetId(profile.name));
        if (targetGroupId) {
          profile.profileGroupId = targetGroupId;
          profile.profileGroupEnabled = true;
        } else {
          profile.profileGroupEnabled = false;
        }
      });
    });
    setMoveGroupState(null);
  }

  function requestDeleteGroup(group: ProfileGroup) {
    const members = groupMembers(group.id);
    setDeleteState({
      advancedOpen: false,
      group,
      members,
      profileTargetGroupIds: {},
      targetGroupId: ''
    });
  }

  function deleteTargetGroupId(profileName: string) {
    if (!deleteState) {
      return '';
    }
    return Object.prototype.hasOwnProperty.call(deleteState.profileTargetGroupIds, profileName)
      ? deleteState.profileTargetGroupIds[profileName]
      : deleteState.targetGroupId;
  }

  function updateDeleteProfileTargetGroup(profileName: string, targetGroupId: string) {
    if (!deleteState) {
      return;
    }
    setDeleteState({
      ...deleteState,
      profileTargetGroupIds: {
        ...deleteState.profileTargetGroupIds,
        [profileName]: targetGroupId
      }
    });
  }

  function confirmDeleteGroup() {
    if (!deleteState) {
      return;
    }
    const memberNames = new Set(deleteState.members.map((profile) => profile.name));
    updateOptions((nextOptions) => {
      nextOptions['-profileGroups'] = profileGroupsForOptions(nextOptions).filter((group) => group.id !== deleteState.group.id);
      profilesForFilter(nextOptions).forEach((profile) => {
        if (profile.profileGroupId !== deleteState.group.id) {
          return;
        }
        if (!memberNames.has(profile.name)) {
          delete profile.profileGroupId;
          profile.profileGroupEnabled = false;
          return;
        }
        const targetGroupId = deleteState.advancedOpen ? deleteTargetGroupId(profile.name) : deleteState.targetGroupId;
        if (targetGroupId) {
          profile.profileGroupId = targetGroupId;
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
          <table className="table table-striped profile-groups-table profile-groups-list-table">
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
                    <td>
                      <ProfileGroupInline group={group} />
                    </td>
                    <td className="profile-groups-count-cell">{members.length}</td>
                    <td className="profile-groups-actions-cell">
                      <span className="profile-groups-actions">
                        <button
                          className="btn btn-default btn-sm"
                          type="button"
                          title={message('options_edit', 'Edit')}
                          aria-label={message('options_edit', 'Edit')}
                          onClick={() => setRenameGroup(group)}
                        >
                          <span className="glyphicon glyphicon-edit" aria-hidden="true" />
                        </button>
                        <button
                          className="btn btn-default btn-sm"
                          type="button"
                          title={message('options_profileGroupMoveProfiles', 'Move Profiles')}
                          aria-label={message('options_profileGroupMoveProfiles', 'Move Profiles')}
                          onClick={() => requestMoveGroupProfiles(group)}
                        >
                          <span className="glyphicon glyphicon-arrow-right" aria-hidden="true" />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          title={message('options_delete', 'Delete')}
                          aria-label={message('options_delete', 'Delete')}
                          onClick={() => requestDeleteGroup(group)}
                        >
                          <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                        </button>
                      </span>
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
        <h3>{message('options_profileGroupsMoveSection', 'Move Profiles')}</h3>
        {profiles.length ? (
          <div className="profile-groups-move-body">
            <div className="profile-groups-move-controls">
              <div className="form-group profile-groups-move-field">
                <label>{message('options_profileGroupFromGroup', 'From group')}</label>
                <ProfileGroupSelect
                  ariaLabel={message('options_profileGroupFromGroup', 'From group')}
                  groups={groups}
                  value={effectiveMoveSourceGroupId}
                  onChange={updateMoveSourceGroup}
                />
              </div>
              <div className="form-group profile-groups-move-field">
                <label>{message('options_profileGroupColumnProfile', 'Profile')}</label>
                <ProfileSelect
                  disabled={!moveProfileOptions.length}
                  defaultText={
                    moveProfileOptions.length
                      ? message('options_profileGroupSelectProfile', 'Select profile')
                      : message('options_profileGroupNoProfiles', 'No profiles')
                  }
                  name={selectedMoveProfile?.name || ''}
                  profiles={moveProfileOptions}
                  onChange={updateMoveProfile}
                />
              </div>
              <div className="form-group profile-groups-move-field">
                <label>{message('options_profileGroupMoveTargetGroup', 'Move to')}</label>
                <ProfileGroupSelect
                  ariaLabel={message('options_profileGroupMoveTargetGroup', 'Move to')}
                  groups={groups}
                  value={effectiveMoveTargetGroupId}
                  onChange={setMoveTargetGroupId}
                />
              </div>
              <div className="form-group profile-groups-move-action">
                <button className="btn btn-default" type="button" disabled={!canMoveProfile} onClick={moveSelectedProfile}>
                  <span className="glyphicon glyphicon-arrow-right" aria-hidden="true" /> {message('options_profileGroupMove', 'Move')}
                </button>
              </div>
            </div>
            <div className="profile-groups-assignments-toggle">
              <button
                type="button"
                className="btn btn-link profile-groups-advanced-toggle"
                aria-expanded={advancedAssignmentsOpen}
                onClick={() => setAdvancedAssignmentsOpen(!advancedAssignmentsOpen)}
              >
                <span
                  className={`glyphicon ${advancedAssignmentsOpen ? 'glyphicon-chevron-up' : 'glyphicon-chevron-down'}`}
                  aria-hidden="true"
                />{' '}
                {advancedAssignmentsOpen
                  ? message('options_profileGroupHideAllAssignments', 'Hide All Profile Assignments')
                  : message('options_profileGroupShowAllAssignments', 'Show All Profile Assignments')}
              </button>
            </div>
            {advancedAssignmentsOpen && (
              <table className="table table-striped profile-groups-table profile-groups-assignment-table">
                <thead>
                  <tr>
                    <th>{message('options_profileGroupColumnProfile', 'Profile')}</th>
                    <th>{message('options_profileGroupCurrentGroup', 'Current Group')}</th>
                    <th>{message('options_profileGroupMoveTargetGroup', 'Move to')}</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => {
                    const currentGroupId = currentProfileGroupId(profile);
                    return (
                      <tr key={profile.name}>
                        <td>
                          <ProfileInline profile={profile} />
                        </td>
                        <td className="profile-groups-current-group-cell">
                          <ProfileGroupInline group={groupLookup[currentGroupId] || null} />
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
                        <td className="profile-groups-move-to-cell">
                          <ProfileGroupSelect
                            ariaLabel={message('options_profileGroupMoveTargetGroup', 'Move to')}
                            groups={groups}
                            inline
                            value={currentGroupId}
                            onChange={(groupId) => updateProfileGroup(profile.name, groupId)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
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
      {moveGroupState && (
        <>
          <div className="modal-backdrop fade in" />
          <div
            className="modal fade in options-modal"
            role="dialog"
            style={{display: 'flex'}}
            tabIndex={-1}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setMoveGroupState(null);
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
                    onClick={() => setMoveGroupState(null)}
                  >
                    <span aria-hidden="true">{'\u00d7'}</span>
                  </button>
                  <h4 className="modal-title">
                    {message('options_profileGroupMoveProfilesTitle', 'Move Profiles from "{0}"', moveGroupState.group.name)}
                  </h4>
                </div>
                <div className="modal-body">
                  {moveGroupState.members.length > 0 ? (
                    <>
                      <p>{message('options_profileGroupMoveProfilesHelp', 'Select profiles to move from this group.')}</p>
                      <div className="profile-groups-group-move-bulk">
                        <label className="profile-groups-group-move-bulk-label">
                          <input
                            type="checkbox"
                            checked={moveGroupState.bulkEnabled}
                            onChange={(event) => updateMoveGroupBulkEnabled(event.currentTarget.checked)}
                          />
                          <span>{message('options_profileGroupMoveAllProfilesTo', 'Move all profiles to')}</span>
                        </label>
                        <div className="profile-groups-group-move-bulk-target">
                          <ProfileGroupSelect
                            ariaLabel={message('options_profileGroupMoveAllProfilesTo', 'Move all profiles to')}
                            disabled={!moveGroupState.bulkEnabled}
                            groups={moveGroupTargetGroups}
                            inline
                            value={effectiveMoveGroupTargetId}
                            onChange={updateMoveGroupTargetGroup}
                          />
                        </div>
                      </div>
                      <h5 className="profile-groups-group-move-section-title">
                        {message('options_profileGroupMoveIndividualProfiles', 'Move individual profiles')}
                      </h5>
                      <div className="profile-groups-group-move-targets">
                        <table className="table table-striped profile-groups-group-move-table">
                          <thead>
                            <tr>
                              <th>{message('options_profileGroupColumnMove', 'Move')}</th>
                              <th>{message('options_profileGroupColumnProfile', 'Profile')}</th>
                              <th>{message('options_profileGroupMoveTargetGroup', 'Move to')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {moveGroupState.members.map((profile) => {
                              const selected = moveGroupProfileSelected(profile.name);
                              return (
                                <tr key={profile.name}>
                                  <td className="profile-groups-group-move-check-cell">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      disabled={moveGroupState.bulkEnabled}
                                      aria-label={message('options_profileGroupMoveProfileToggle', 'Move {0}', profile.name)}
                                      onChange={(event) => updateMoveGroupProfileSelected(profile.name, event.currentTarget.checked)}
                                    />
                                  </td>
                                  <td>
                                    <ProfileInline profile={profile} />
                                  </td>
                                  <td className="profile-groups-group-move-target-cell">
                                    <ProfileGroupSelect
                                      ariaLabel={message('options_profileGroupMoveTargetGroup', 'Move to')}
                                      disabled={moveGroupState.bulkEnabled || !selected}
                                      groups={moveGroupTargetGroups}
                                      inline
                                      value={moveGroupProfileTargetId(profile.name)}
                                      onChange={(targetGroupId) => updateMoveGroupProfileTargetGroup(profile.name, targetGroupId)}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted">{message('options_profileGroupMoveProfilesEmpty', 'This group has no profiles to move.')}</p>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-default" onClick={() => setMoveGroupState(null)}>
                    {moveGroupState.members.length ? message('options_cancel', 'Cancel') : message('options_modalClose', 'Close')}
                  </button>
                  {moveGroupState.members.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canConfirmMoveGroupProfiles}
                      onClick={confirmMoveGroupProfiles}
                    >
                      {message('options_profileGroupMoveProfiles', 'Move Profiles')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
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
                    <>
                      <div className="form-group">
                        <label>{message('options_profileGroupMoveTo', 'Move profiles to')}</label>
                        <ProfileGroupSelect
                          groups={groups.filter((group) => group.id !== deleteState.group.id)}
                          inline
                          value={deleteState.targetGroupId}
                          onChange={(targetGroupId) =>
                            setDeleteState({
                              ...deleteState,
                              targetGroupId
                            })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-link profile-groups-advanced-toggle"
                        aria-expanded={deleteState.advancedOpen}
                        onClick={() =>
                          setDeleteState({
                            ...deleteState,
                            advancedOpen: !deleteState.advancedOpen
                          })
                        }
                      >
                        <span
                          className={`glyphicon ${deleteState.advancedOpen ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right'}`}
                          aria-hidden="true"
                        />{' '}
                        {message('options_advanced', 'Advanced')}
                      </button>
                      {deleteState.advancedOpen && (
                        <div className="profile-groups-delete-profile-targets">
                          {deleteState.members.map((profile) => (
                            <div key={profile.name} className="profile-groups-delete-profile-target">
                              <div className="profile-groups-delete-profile">
                                <ProfileInline profile={profile} />
                              </div>
                              <ProfileGroupSelect
                                groups={groups.filter((group) => group.id !== deleteState.group.id)}
                                inline
                                value={deleteTargetGroupId(profile.name)}
                                onChange={(targetGroupId) => updateDeleteProfileTargetGroup(profile.name, targetGroupId)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
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
