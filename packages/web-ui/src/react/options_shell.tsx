import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useOutsidePointer} from './dom_event_hooks';
import {message} from './i18n_client';
import type {Options} from './options_client_types';
import {profileGroupsEnabled, profileGroupsForOptions, splitProfilesByGroup} from './profile_groups';
import {isEditableColor, normalizeColor, PROFILE_COLOR_SWATCHES} from './profile_content_logic';
import type {ProfileActionMenuOptions} from './profile_types';
import {isBuiltinProfile, isVirtualProfile, Profile, ProfileInline, profileName, profilesForFilter} from './profile_widgets';

export type OptionsShellProps = {
  appliedOptions?: Options | null;
  currentProfileName?: string;
  currentState?: string;
  generalHref?: string;
  importExportHref?: string;
  isExperimental?: boolean;
  keepSettingsExpanded?: boolean;
  newProfileHref?: string;
  onApply?: () => void | Promise<unknown>;
  onDiscard?: () => void;
  onDeleteProfile?: (profile: Profile) => void;
  onExportPacProfile?: (profile: Profile) => void;
  onExportRuleListProfile?: (profile: Profile) => void;
  onNavigate?: (state: string, params?: Record<string, string>) => void;
  onNewProfile?: () => void;
  onProfileColorChange?: (profile: Profile, color: string) => void;
  onRenameProfile?: (profile: Profile) => void;
  options?: Options | null;
  optionsDirty?: boolean;
  profileActionMenuOptions?: ProfileActionMenuOptions | null;
  profileGroupsHref?: string;
  profileScopeHref?: string;
  profileHref?: (profile: Profile) => string;
  requestLensHref?: string;
  showProfileGroups?: boolean;
  showProfilesCollapseToggle?: boolean;
  showProfileScope?: boolean;
  showRequestLens?: boolean;
  uiHref?: string;
};

type ProfileActionProps = Pick<
  OptionsShellProps,
  'onDeleteProfile' | 'onExportPacProfile' | 'onExportRuleListProfile' | 'onProfileColorChange' | 'onRenameProfile'
>;
type SettingsNavItem = {
  active?: boolean;
  href: string;
  icon: string;
  key: string;
  label: string;
  onClick?: () => void | Promise<unknown>;
};

export type OptionsAlertProps = {
  alert?: {
    i18n?: string;
    message?: string;
    type?: string;
  } | null;
  onClose?: () => void;
  shown?: boolean;
};

const PROFILE_ACTION_MENU_GAP = 12;
const PROFILE_COLOR_SUBMENU_WIDTH = 212;

const ALERT_ICONS: Record<string, string> = {
  danger: 'glyphicon-danger',
  error: 'glyphicon-remove',
  success: 'glyphicon-ok',
  warning: 'glyphicon-warning-sign'
};

function alertClassForType(type?: string) {
  if (!type) {
    return '';
  }
  return `alert-${type === 'error' ? 'danger' : type}`;
}

function navClick(event: React.MouseEvent, action?: () => void | Promise<unknown>) {
  event.preventDefault();
  Promise.resolve(action?.()).catch(() => undefined);
}

function actionClick(event: React.MouseEvent<HTMLElement>, action?: () => void) {
  event.currentTarget.blur();
  navClick(event, action);
}

function canEditProfileColor(profile: Profile) {
  return !isVirtualProfile(profile);
}

function canExportPacProfile(profile: Profile) {
  return !isBuiltinProfile(profile);
}

function canExportRuleListProfile(profile: Profile) {
  return profile.profileType === 'SwitchProfile';
}

function normalizedProfileActionMenuOptions(options?: ProfileActionMenuOptions | null): Required<ProfileActionMenuOptions> {
  return {
    browserColor: options?.browserColor === true,
    browserExport: options?.browserExport !== false,
    browserMenu: options?.browserMenu !== false,
    sectionMenu: options?.sectionMenu !== false,
    sidebarColor: options?.sidebarColor === true,
    sidebarExport: options?.sidebarExport !== false,
    sidebarMenu: options?.sidebarMenu === true
  };
}

function hasProfileActions(
  {onDeleteProfile, onExportPacProfile, onExportRuleListProfile, onProfileColorChange, onRenameProfile}: ProfileActionProps,
  profile: Profile
) {
  return !!(
    onDeleteProfile ||
    onRenameProfile ||
    (onProfileColorChange && canEditProfileColor(profile)) ||
    (onExportPacProfile && canExportPacProfile(profile)) ||
    (onExportRuleListProfile && canExportRuleListProfile(profile))
  );
}

function SettingsLink({
  active,
  href = '#',
  icon,
  label,
  onClick
}: {
  active?: boolean;
  href?: string;
  icon: string;
  label: string;
  onClick?: () => void | Promise<unknown>;
}) {
  return (
    <li className={active ? 'active' : ''}>
      <a href={href} onClick={(event) => navClick(event, onClick)}>
        <span className={`glyphicon ${icon}`} /> {label}
      </a>
    </li>
  );
}

function SettingsSectionMenuButton({items}: {items: SettingsNavItem[]}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  useOutsidePointer(rootRef, () => setOpen(false), open);

  if (items.length === 0) {
    return null;
  }

  return (
    <span ref={rootRef} className={`options-shell-settings-menu options-shell-profile-menu ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="options-shell-settings-menu-button options-shell-profile-menu-button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={message('options_showSettingsMenu', 'Show settings')}
        onClick={() => setOpen(!open)}
      >
        <span className="glyphicon glyphicon-option-vertical" />
      </button>
      {open && (
        <span
          className="options-shell-profile-menu-panel options-shell-settings-menu-panel"
          role="menu"
          aria-label={message('options_navHeader_setting', 'Settings')}
        >
          {items.map((item) => (
            <a
              key={item.key}
              className={`options-shell-profile-menu-item options-shell-settings-menu-item ${item.active ? 'active' : ''}`}
              href={item.href}
              role="menuitem"
              onClick={(event) => {
                navClick(event, item.onClick);
                setOpen(false);
              }}
            >
              <span className={`glyphicon ${item.icon}`} />
              <span>{item.label}</span>
            </a>
          ))}
        </span>
      )}
    </span>
  );
}

function ProfileColorActionSubmenu({
  fixedPosition = false,
  onClose,
  onColorChange,
  profile
}: {
  fixedPosition?: boolean;
  onClose: () => void;
  onColorChange: (profile: Profile, color: string) => void;
  profile: Profile;
}) {
  const viewportGap = PROFILE_ACTION_MENU_GAP;
  const color = normalizeColor(profile.color).toLowerCase();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(color);
  const [anchorElement, setAnchorElement] = useState<HTMLButtonElement | null>(null);
  const [openLeft, setOpenLeft] = useState(false);
  const [submenuStyle, setSubmenuStyle] = useState<React.CSSProperties | undefined>();
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const submenuRef = useRef<HTMLSpanElement>(null);
  const normalizedDraft = isEditableColor(draft) ? normalizeColor(draft).toLowerCase() : '';

  useLayoutEffect(() => {
    setDraft(color);
  }, [color]);

  const updateSubmenuPosition = useCallback(() => {
    if (!open || !anchorElement) {
      return;
    }
    const anchorRect = anchorElement.getBoundingClientRect();
    const boundary = {
      bottom: window.innerHeight,
      left: 0,
      right: window.innerWidth,
      top: 0
    };
    const boundaryRight = boundary.right - viewportGap;
    setOpenLeft(anchorRect.right + 2 + PROFILE_COLOR_SUBMENU_WIDTH > boundaryRight);
    if (!fixedPosition) {
      setSubmenuStyle(undefined);
      return;
    }
    if (!submenuRef.current) {
      return;
    }
    const maxHeight = Math.max(80, Math.floor((boundary.bottom - boundary.top) * 0.9));
    const width = submenuRef.current.offsetWidth || PROFILE_COLOR_SUBMENU_WIDTH;
    const height = Math.min(submenuRef.current.scrollHeight || 180, maxHeight);
    const boundaryLeft = boundary.left + viewportGap;
    const rightLeft = Math.round(anchorRect.right + 2);
    const leftLeft = Math.round(anchorRect.left - width - 2);
    let left = rightLeft;
    if (rightLeft + width > boundaryRight && leftLeft >= boundaryLeft) {
      left = leftLeft;
    }
    left = Math.max(boundaryLeft, Math.min(left, boundaryRight - width));
    const top = Math.max(boundary.top + viewportGap, Math.min(Math.round(anchorRect.top), boundary.bottom - viewportGap - height));
    setSubmenuStyle({
      left,
      maxHeight,
      maxWidth: Math.max(160, boundaryRight - left),
      top
    });
  }, [anchorElement, fixedPosition, open, viewportGap]);

  useLayoutEffect(() => {
    updateSubmenuPosition();
  }, [updateSubmenuPosition]);

  function openSubmenu(event: React.FocusEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) {
    setAnchorElement(event.currentTarget);
    setOpen(true);
  }

  function closeSubmenu() {
    setOpen(false);
  }

  function commitColor(value: string) {
    if (!isEditableColor(value)) {
      return;
    }
    const nextColor = normalizeColor(value).toLowerCase();
    setDraft(nextColor);
    onColorChange(profile, nextColor);
    closeSubmenu();
    onClose();
  }

  return (
    <span className="options-shell-profile-browser-actions-menu-entry" onMouseLeave={closeSubmenu}>
      <button
        type="button"
        className="options-shell-profile-browser-actions-menu-item options-shell-profile-color-menu-item"
        aria-expanded={open}
        aria-haspopup="dialog"
        role="menuitem"
        onFocus={openSubmenu}
        onMouseEnter={openSubmenu}
      >
        <span className="options-shell-profile-color-menu-label">
          <span className="options-shell-profile-color-menu-swatch" style={{backgroundColor: color}} />
          <span>{message('options_profileColor', 'Profile color')}</span>
        </span>
        <span className="glyphicon glyphicon-chevron-right" />
      </button>
      {open && (
        <span
          ref={submenuRef}
          className={`options-shell-profile-color-submenu ${
            fixedPosition
              ? 'options-shell-profile-color-submenu-fixed'
              : `options-shell-profile-color-submenu-attached${openLeft ? ' open-left' : ''}`
          }`}
          role="dialog"
          aria-label={message('options_profileColor', 'Profile color')}
          style={fixedPosition ? submenuStyle : undefined}
        >
          <div className="profile-color-swatch-grid">
            {PROFILE_COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`profile-color-swatch-option${normalizeColor(swatch).toLowerCase() === color ? ' active' : ''}`}
                style={{backgroundColor: swatch}}
                title={swatch}
                aria-label={message('options_profileUseColor', `Use ${swatch}`, swatch)}
                onClick={() => commitColor(swatch)}
              />
            ))}
          </div>
          <div className="profile-color-hex-row">
            <input
              type="text"
              className="form-control profile-color-hex-input"
              value={draft}
              maxLength={7}
              spellCheck={false}
              aria-label={message('options_profileHexColor', 'Hex color')}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitColor(draft);
                }
              }}
            />
            <button type="button" className="btn btn-default btn-sm" disabled={!normalizedDraft} onClick={() => commitColor(draft)}>
              {message('options_profileApplyColor', 'Apply')}
            </button>
          </div>
          <button type="button" className="btn btn-default btn-sm profile-color-custom" onClick={() => nativeInputRef.current?.click()}>
            <span className="glyphicon glyphicon-tint" /> {message('options_profileCustomColor', 'Custom')}
          </button>
          <input
            ref={nativeInputRef}
            className="profile-color-editor-native"
            type="color"
            value={color}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => commitColor(event.currentTarget.value)}
          />
        </span>
      )}
    </span>
  );
}

function ProfileActionsControl({
  buttonClassName,
  fixedMenu = false,
  menuClassName,
  onDeleteProfile,
  onExportPacProfile,
  onExportRuleListProfile,
  onProfileColorChange,
  onRenameProfile,
  profile,
  rootClassName
}: ProfileActionProps & {
  buttonClassName: string;
  fixedMenu?: boolean;
  menuClassName: string;
  profile: Profile;
  rootClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>();
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);
  useOutsidePointer(rootRef, () => setOpen(false), open);

  const updateFixedMenuPosition = useCallback(() => {
    if (!fixedMenu || !buttonRef.current) {
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const maxHeight = Math.floor(window.innerHeight * 0.9);
    const menuWidth = menuRef.current?.offsetWidth || 192;
    const menuHeight = Math.min(menuRef.current?.scrollHeight || 112, maxHeight);
    let left = Math.round(rect.left);
    if (left + menuWidth + PROFILE_ACTION_MENU_GAP > window.innerWidth) {
      left = Math.max(PROFILE_ACTION_MENU_GAP, window.innerWidth - PROFILE_ACTION_MENU_GAP - menuWidth);
    }
    const top = Math.max(
      PROFILE_ACTION_MENU_GAP,
      Math.min(Math.round(rect.bottom + 2), window.innerHeight - PROFILE_ACTION_MENU_GAP - menuHeight)
    );
    setMenuStyle({
      left,
      maxHeight,
      maxWidth: `calc(100vw - ${left}px - ${PROFILE_ACTION_MENU_GAP}px)`,
      top
    });
  }, [fixedMenu]);

  useLayoutEffect(() => {
    if (open) {
      updateFixedMenuPosition();
    }
  }, [open, updateFixedMenuPosition]);

  function toggleMenu() {
    if (!open) {
      updateFixedMenuPosition();
    }
    setOpen(!open);
  }

  function action(handler?: (profile: Profile) => void) {
    return () => {
      setOpen(false);
      handler?.(profile);
    };
  }

  return (
    <span ref={rootRef} className={`${rootClassName}${open ? ' open' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={message('options_group_profileOptions', 'Profile Options')}
        onClick={toggleMenu}
      >
        <span className="glyphicon glyphicon-option-vertical" />
      </button>
      {open && (
        <span ref={menuRef} className={menuClassName} role="menu" style={fixedMenu ? menuStyle : undefined}>
          {onProfileColorChange && canEditProfileColor(profile) && (
            <ProfileColorActionSubmenu
              fixedPosition={fixedMenu}
              onClose={() => setOpen(false)}
              onColorChange={onProfileColorChange}
              profile={profile}
            />
          )}
          {onExportRuleListProfile && canExportRuleListProfile(profile) && (
            <button
              type="button"
              className="options-shell-profile-browser-actions-menu-item"
              role="menuitem"
              onClick={action(onExportRuleListProfile)}
            >
              <span className="glyphicon glyphicon-list" /> <span>{message('options_profileExportRuleList', 'Export Rule List')}</span>
            </button>
          )}
          {onExportPacProfile && canExportPacProfile(profile) && (
            <button
              type="button"
              className="options-shell-profile-browser-actions-menu-item"
              role="menuitem"
              onClick={action(onExportPacProfile)}
            >
              <span className="glyphicon glyphicon-download" /> <span>{message('options_profileExportPac', 'Export PAC')}</span>
            </button>
          )}
          {onRenameProfile && (
            <button
              type="button"
              className="options-shell-profile-browser-actions-menu-item"
              role="menuitem"
              onClick={action(onRenameProfile)}
            >
              <span className="glyphicon glyphicon-edit" /> <span>{message('options_renameProfile', 'Rename')}</span>
            </button>
          )}
          {onDeleteProfile && (
            <button
              type="button"
              className="options-shell-profile-browser-actions-menu-item text-danger"
              role="menuitem"
              onClick={action(onDeleteProfile)}
            >
              <span className="glyphicon glyphicon-trash" /> <span>{message('options_deleteProfile', 'Delete Profile')}</span>
            </button>
          )}
        </span>
      )}
    </span>
  );
}

function ProfileNavItem({
  currentProfileName,
  currentState,
  onDeleteProfile,
  onExportPacProfile,
  onExportRuleListProfile,
  onNavigate,
  onProfileColorChange,
  onRenameProfile,
  profile,
  profileHref
}: {
  currentProfileName: string;
  currentState: string;
  onDeleteProfile?: (profile: Profile) => void;
  onExportPacProfile?: (profile: Profile) => void;
  onExportRuleListProfile?: (profile: Profile) => void;
  onNavigate?: (state: string, params?: Record<string, string>) => void;
  onProfileColorChange?: (profile: Profile, color: string) => void;
  onRenameProfile?: (profile: Profile) => void;
  profile: Profile;
  profileHref?: (profile: Profile) => string;
}) {
  const actionProps = {onDeleteProfile, onExportPacProfile, onExportRuleListProfile, onProfileColorChange, onRenameProfile};
  return (
    <li
      className={`nav-profile ${currentState === 'profile' && profile.name === currentProfileName ? 'active' : ''}`}
      data-profile-type={profile.profileType}
    >
      <a href={profileHref?.(profile) || '#'} onClick={(event) => navClick(event, () => onNavigate?.('profile', {name: profile.name}))}>
        <ProfileInline profile={profile} />
      </a>
      {hasProfileActions(actionProps, profile) && (
        <ProfileActionsControl
          {...actionProps}
          buttonClassName="options-shell-profile-nav-actions-button"
          fixedMenu
          menuClassName="options-shell-profile-browser-actions-menu options-shell-profile-nav-actions-menu"
          profile={profile}
          rootClassName="options-shell-profile-nav-actions"
        />
      )}
    </li>
  );
}

function ProfileSectionMenuButton({
  activeProfileName,
  ariaLabel,
  browseAllLabel,
  currentState,
  label,
  onBrowseAll,
  onNavigate,
  profileHref,
  profiles
}: {
  activeProfileName: string;
  ariaLabel: string;
  browseAllLabel?: string;
  currentState: string;
  label: string;
  onBrowseAll?: () => void;
  onNavigate?: (state: string, params?: Record<string, string>) => void;
  profileHref?: (profile: Profile) => string;
  profiles: Profile[];
}) {
  const viewportGap = 12;
  const [open, setOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuAnchorTop, setSubmenuAnchorTop] = useState(0);
  const [submenuStyle, setSubmenuStyle] = useState<React.CSSProperties | undefined>();
  const rootRef = useRef<HTMLSpanElement>(null);
  const submenuRef = useRef<HTMLSpanElement>(null);
  useOutsidePointer(
    rootRef,
    () => {
      setOpen(false);
      setSubmenuOpen(false);
    },
    open
  );

  useLayoutEffect(() => {
    if (!submenuOpen || !submenuRef.current) {
      return;
    }
    const maxHeight = Math.floor(window.innerHeight * 0.9);
    const height = Math.min(submenuRef.current.scrollHeight, maxHeight);
    const top = Math.max(viewportGap, Math.min(submenuAnchorTop, window.innerHeight - viewportGap - height));
    setSubmenuStyle((current) => ({
      ...current,
      maxHeight,
      top
    }));
  }, [submenuAnchorTop, submenuOpen]);

  if (profiles.length === 0) {
    return null;
  }

  function toggleMenu() {
    if (!open) {
      setSubmenuOpen(false);
    }
    setOpen(!open);
  }

  function closeMenu() {
    setOpen(false);
    setSubmenuOpen(false);
  }

  function openSubmenu(event: React.FocusEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const left = Math.max(viewportGap, Math.round(rect.right + 2));
    const top = Math.max(viewportGap, Math.round(rect.top));
    setSubmenuAnchorTop(top);
    setSubmenuStyle({
      left,
      maxHeight: Math.floor(window.innerHeight * 0.9),
      maxWidth: `calc(100vw - ${left}px - ${viewportGap}px)`,
      top
    });
    setSubmenuOpen(true);
  }

  function closeSubmenu() {
    setSubmenuOpen(false);
  }

  return (
    <span ref={rootRef} className={`options-shell-profile-menu ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="options-shell-profile-menu-button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={toggleMenu}
      >
        <span className="glyphicon glyphicon-option-vertical" />
      </button>
      {open && (
        <span className="options-shell-profile-menu-panel" role="menu" aria-label={ariaLabel}>
          <span className="options-shell-profile-menu-entry" onMouseLeave={closeSubmenu}>
            <button
              type="button"
              className="options-shell-profile-menu-item"
              aria-expanded={submenuOpen}
              aria-haspopup="menu"
              role="menuitem"
              onFocus={openSubmenu}
              onMouseEnter={openSubmenu}
            >
              <span>{ariaLabel}</span>
              <span className="glyphicon glyphicon-chevron-right" />
            </button>
            {submenuOpen && (
              <span ref={submenuRef} className="options-shell-profile-submenu" role="menu" aria-label={label} style={submenuStyle}>
                {profiles.map((profile) => (
                  <a
                    key={profile.name}
                    className={currentState === 'profile' && profile.name === activeProfileName ? 'active' : ''}
                    href={profileHref?.(profile) || '#'}
                    role="menuitem"
                    onClick={(event) => {
                      navClick(event, () => onNavigate?.('profile', {name: profile.name}));
                      closeMenu();
                    }}
                  >
                    <ProfileInline profile={profile} />
                  </a>
                ))}
              </span>
            )}
          </span>
          {onBrowseAll && (
            <span className="options-shell-profile-menu-entry">
              <button
                type="button"
                className="options-shell-profile-menu-item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onBrowseAll();
                }}
              >
                <span>{browseAllLabel || message('options_browseAllProfiles', 'Browse all')}</span>
              </button>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function ProfileBrowserModal({
  activeProfileName,
  currentState,
  hiddenProfiles,
  profileGroups,
  onClose,
  onDeleteProfile,
  onExportPacProfile,
  onExportRuleListProfile,
  onNavigate,
  onProfileColorChange,
  onRenameProfile,
  profileHref,
  profiles
}: {
  activeProfileName: string;
  currentState: string;
  hiddenProfiles: Profile[];
  profileGroups: Array<{id: string; name: string; profiles: Profile[]}>;
  onClose: () => void;
  onDeleteProfile?: (profile: Profile) => void;
  onExportPacProfile?: (profile: Profile) => void;
  onExportRuleListProfile?: (profile: Profile) => void;
  onNavigate?: (state: string, params?: Record<string, string>) => void;
  onProfileColorChange?: (profile: Profile, color: string) => void;
  onRenameProfile?: (profile: Profile) => void;
  profileHref?: (profile: Profile) => string;
  profiles: Profile[];
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const profilesLabel = message('options_navHeader_profiles', 'Profiles');
  const hiddenProfilesLabel = message('options_navHeader_hiddenProfiles', 'Hidden');
  const filteredProfiles = useMemo(
    () => profiles.filter((profile) => profileMatchesQuery(profile, normalizedQuery)),
    [normalizedQuery, profiles]
  );
  const filteredHiddenProfiles = useMemo(
    () => hiddenProfiles.filter((profile) => profileMatchesQuery(profile, normalizedQuery)),
    [hiddenProfiles, normalizedQuery]
  );
  const filteredProfileGroups = useMemo(
    () =>
      profileGroups
        .map((group) => ({
          ...group,
          profiles: group.profiles.filter((profile) => profileMatchesQuery(profile, normalizedQuery))
        }))
        .filter((group) => group.profiles.length > 0),
    [normalizedQuery, profileGroups]
  );
  const hasResults = filteredProfiles.length > 0 || filteredHiddenProfiles.length > 0 || filteredProfileGroups.length > 0;

  function navigateToProfile(profile: Profile) {
    onClose();
    onNavigate?.('profile', {name: profile.name});
  }

  return (
    <>
      <div className="modal-backdrop fade in" />
      <div
        className="modal fade in options-modal options-shell-profile-browser-modal"
        role="dialog"
        style={{display: 'flex'}}
        tabIndex={-1}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" onClick={onClose}>
                <span aria-hidden="true">{'\u00d7'}</span>
                <span className="sr-only">{message('dialog_close', 'Close')}</span>
              </button>
              <h4 className="modal-title">{message('options_browseAllProfilesTitle', 'Browse all profiles')}</h4>
            </div>
            <div className="modal-body">
              <input
                autoFocus
                className="form-control options-shell-profile-browser-search"
                placeholder={message('options_searchProfilesPlaceholder', 'Search profiles')}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              {hasResults ? (
                <>
                  {filteredProfiles.length > 0 && (
                    <ProfileBrowserSection
                      activeProfileName={activeProfileName}
                      currentState={currentState}
                      label={profilesLabel}
                      onDeleteProfile={onDeleteProfile}
                      onExportPacProfile={onExportPacProfile}
                      onExportRuleListProfile={onExportRuleListProfile}
                      onNavigate={navigateToProfile}
                      onProfileColorChange={onProfileColorChange}
                      onRenameProfile={onRenameProfile}
                      profileHref={profileHref}
                      profiles={filteredProfiles}
                    />
                  )}
                  {hiddenProfiles.length > 0 && filteredHiddenProfiles.length > 0 && (
                    <ProfileBrowserSection
                      activeProfileName={activeProfileName}
                      currentState={currentState}
                      label={hiddenProfilesLabel}
                      onDeleteProfile={onDeleteProfile}
                      onExportPacProfile={onExportPacProfile}
                      onExportRuleListProfile={onExportRuleListProfile}
                      onNavigate={navigateToProfile}
                      onProfileColorChange={onProfileColorChange}
                      onRenameProfile={onRenameProfile}
                      profileHref={profileHref}
                      profiles={filteredHiddenProfiles}
                    />
                  )}
                  {filteredProfileGroups.map((group) => (
                    <ProfileBrowserSection
                      key={group.id}
                      activeProfileName={activeProfileName}
                      currentState={currentState}
                      label={group.name}
                      onDeleteProfile={onDeleteProfile}
                      onExportPacProfile={onExportPacProfile}
                      onExportRuleListProfile={onExportRuleListProfile}
                      onNavigate={navigateToProfile}
                      onProfileColorChange={onProfileColorChange}
                      onRenameProfile={onRenameProfile}
                      profileHref={profileHref}
                      profiles={group.profiles}
                    />
                  ))}
                </>
              ) : (
                <p className="text-muted options-shell-profile-browser-empty">
                  {message('options_noProfilesMatchSearch', 'No profiles match your search.')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileBrowserSection({
  activeProfileName,
  currentState,
  label,
  onDeleteProfile,
  onExportPacProfile,
  onExportRuleListProfile,
  onNavigate,
  onProfileColorChange,
  onRenameProfile,
  profileHref,
  profiles
}: {
  activeProfileName: string;
  currentState: string;
  label: string;
  onDeleteProfile?: (profile: Profile) => void;
  onExportPacProfile?: (profile: Profile) => void;
  onExportRuleListProfile?: (profile: Profile) => void;
  onNavigate: (profile: Profile) => void;
  onProfileColorChange?: (profile: Profile, color: string) => void;
  onRenameProfile?: (profile: Profile) => void;
  profileHref?: (profile: Profile) => string;
  profiles: Profile[];
}) {
  return (
    <section className="options-shell-profile-browser-section">
      <h5>{label}</h5>
      <div className="options-shell-profile-browser-grid">
        {profiles.map((profile) => (
          <ProfileBrowserItem
            key={profile.name}
            active={currentState === 'profile' && profile.name === activeProfileName}
            onDeleteProfile={onDeleteProfile}
            onExportPacProfile={onExportPacProfile}
            onExportRuleListProfile={onExportRuleListProfile}
            onNavigate={onNavigate}
            onProfileColorChange={onProfileColorChange}
            onRenameProfile={onRenameProfile}
            profile={profile}
            profileHref={profileHref}
          />
        ))}
      </div>
    </section>
  );
}

function ProfileBrowserItem({
  active,
  onDeleteProfile,
  onExportPacProfile,
  onExportRuleListProfile,
  onNavigate,
  onProfileColorChange,
  onRenameProfile,
  profile,
  profileHref
}: {
  active?: boolean;
  onDeleteProfile?: (profile: Profile) => void;
  onExportPacProfile?: (profile: Profile) => void;
  onExportRuleListProfile?: (profile: Profile) => void;
  onNavigate: (profile: Profile) => void;
  onProfileColorChange?: (profile: Profile, color: string) => void;
  onRenameProfile?: (profile: Profile) => void;
  profile: Profile;
  profileHref?: (profile: Profile) => string;
}) {
  const actionProps = {onDeleteProfile, onExportPacProfile, onExportRuleListProfile, onProfileColorChange, onRenameProfile};
  return (
    <div className={`options-shell-profile-browser-item${active ? ' active' : ''}`}>
      <a
        className="options-shell-profile-browser-link"
        href={profileHref?.(profile) || '#'}
        onClick={(event) => navClick(event, () => onNavigate(profile))}
      >
        <ProfileInline profile={profile} />
      </a>
      {hasProfileActions(actionProps, profile) && (
        <ProfileActionsControl
          {...actionProps}
          buttonClassName="options-shell-profile-browser-actions-button"
          menuClassName="options-shell-profile-browser-actions-menu"
          profile={profile}
          rootClassName="options-shell-profile-browser-actions"
        />
      )}
    </div>
  );
}

function profileMatchesQuery(profile: Profile, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }
  return `${profile.name} ${profileName(profile)}`.toLocaleLowerCase().includes(normalizedQuery);
}

export function OptionsShell({
  appliedOptions,
  currentProfileName = '',
  currentState = '',
  generalHref = '#',
  importExportHref = '#',
  isExperimental = false,
  keepSettingsExpanded,
  newProfileHref = '#',
  onApply,
  onDiscard,
  onDeleteProfile,
  onExportPacProfile,
  onExportRuleListProfile,
  onNavigate,
  onNewProfile,
  onProfileColorChange,
  onRenameProfile,
  options,
  optionsDirty = false,
  profileActionMenuOptions,
  profileGroupsHref = '#',
  profileScopeHref = '#',
  profileHref,
  requestLensHref = '#',
  showProfileGroups = false,
  showProfilesCollapseToggle = false,
  showProfileScope = false,
  showRequestLens = true,
  uiHref = '#'
}: OptionsShellProps) {
  const [hiddenProfilesOpen, setHiddenProfilesOpen] = useState(false);
  const [openProfileGroups, setOpenProfileGroups] = useState<Record<string, boolean>>({});
  const [profileBrowserOpen, setProfileBrowserOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(keepSettingsExpanded ?? true);
  const settingsPreferenceAppliedRef = useRef(keepSettingsExpanded != null);
  const settingsToggledRef = useRef(false);
  const profilesVisible = !showProfilesCollapseToggle || profilesOpen;
  const profiles = profilesForFilter(options, 'sorted');
  const appliedProfiles = profilesForFilter(appliedOptions || options, 'sorted');
  const appliedProfileGroups = profileGroupsForOptions(appliedOptions || options);
  const appliedGroupSplit = splitProfilesByGroup(
    appliedProfiles,
    appliedProfileGroups,
    profileGroupsEnabled(appliedOptions || options),
    'options'
  );
  const visibleProfileNames = new Set(appliedGroupSplit.visible.map((profile) => profile.name));
  const hiddenProfileNames = new Set(appliedGroupSplit.hidden.map((profile) => profile.name));
  const customGroupProfileNames = new Map(
    appliedGroupSplit.groups.map((group) => [group.id, new Set(group.profiles.map((profile) => profile.name))])
  );
  const groupedProfileNames = new Set(appliedGroupSplit.groups.flatMap((group) => group.profiles.map((profile) => profile.name)));
  const visibleProfiles = profiles.filter(
    (profile) => visibleProfileNames.has(profile.name) || (!hiddenProfileNames.has(profile.name) && !groupedProfileNames.has(profile.name))
  );
  const hiddenProfiles = profiles.filter((profile) => hiddenProfileNames.has(profile.name));
  const customProfileGroups = appliedGroupSplit.groups
    .map((group) => ({
      ...group,
      profiles: profiles.filter((profile) => customGroupProfileNames.get(group.id)?.has(profile.name))
    }))
    .filter((group) => group.profiles.length > 0);
  const actionMenuOptions = normalizedProfileActionMenuOptions(profileActionMenuOptions);
  const sidebarDeleteProfile = actionMenuOptions.sidebarMenu ? onDeleteProfile : undefined;
  const sidebarRenameProfile = actionMenuOptions.sidebarMenu ? onRenameProfile : undefined;
  const sidebarProfileColorChange = actionMenuOptions.sidebarMenu && actionMenuOptions.sidebarColor ? onProfileColorChange : undefined;
  const sidebarExportPacProfile = actionMenuOptions.sidebarMenu && actionMenuOptions.sidebarExport ? onExportPacProfile : undefined;
  const sidebarExportRuleListProfile =
    actionMenuOptions.sidebarMenu && actionMenuOptions.sidebarExport ? onExportRuleListProfile : undefined;
  const browserDeleteProfile = actionMenuOptions.browserMenu ? onDeleteProfile : undefined;
  const browserRenameProfile = actionMenuOptions.browserMenu ? onRenameProfile : undefined;
  const browserProfileColorChange = actionMenuOptions.browserMenu && actionMenuOptions.browserColor ? onProfileColorChange : undefined;
  const browserExportPacProfile = actionMenuOptions.browserMenu && actionMenuOptions.browserExport ? onExportPacProfile : undefined;
  const browserExportRuleListProfile =
    actionMenuOptions.browserMenu && actionMenuOptions.browserExport ? onExportRuleListProfile : undefined;
  const profilesLabel = message('options_navHeader_profiles', 'Profiles');
  const hiddenProfilesLabel = message('options_navHeader_hiddenProfiles', 'Hidden');
  const settingsItems: SettingsNavItem[] = [
    {
      active: currentState === 'ui',
      href: uiHref,
      icon: 'glyphicon-wrench',
      key: 'ui',
      label: message('options_tab_ui', 'Interface'),
      onClick: () => onNavigate?.('ui')
    },
    {
      active: currentState === 'general',
      href: generalHref,
      icon: 'glyphicon-cog',
      key: 'general',
      label: message('options_tab_general', 'General'),
      onClick: () => onNavigate?.('general')
    },
    ...(showProfileScope
      ? [
          {
            active: currentState === 'profileScope',
            href: profileScopeHref,
            icon: 'glyphicon-file',
            key: 'profileScope',
            label: message('options_tab_profileScope', 'Profile Scope'),
            onClick: () => onNavigate?.('profileScope')
          }
        ]
      : []),
    ...(showProfileGroups
      ? [
          {
            active: currentState === 'profileGroups',
            href: profileGroupsHref,
            icon: 'glyphicon-folder-close',
            key: 'profileGroups',
            label: message('options_tab_profileGroups', 'Profile Groups'),
            onClick: () => onNavigate?.('profileGroups')
          }
        ]
      : []),
    ...(showRequestLens
      ? [
          {
            active: currentState === 'requestLens',
            href: requestLensHref,
            icon: 'glyphicon-camera',
            key: 'requestLens',
            label: message('options_tab_requestLens', 'Request Lens'),
            onClick: () => onNavigate?.('requestLens')
          }
        ]
      : []),
    {
      active: currentState === 'io',
      href: importExportHref,
      icon: 'glyphicon-floppy-save',
      key: 'io',
      label: message('options_tab_importExport', 'Import/Export'),
      onClick: () => onNavigate?.('io')
    }
  ];

  useEffect(() => {
    if (settingsPreferenceAppliedRef.current || keepSettingsExpanded == null || settingsToggledRef.current) {
      return;
    }
    settingsPreferenceAppliedRef.current = true;
    setSettingsOpen(keepSettingsExpanded);
  }, [keepSettingsExpanded]);

  useEffect(() => {
    if (!showProfilesCollapseToggle && !profilesOpen) {
      setProfilesOpen(true);
    }
  }, [profilesOpen, showProfilesCollapseToggle]);

  function toggleSettings() {
    settingsToggledRef.current = true;
    setSettingsOpen((open) => !open);
  }

  return (
    <>
      <h1>
        <a href="#/about" title={message('about_title', 'About')} onClick={(event) => navClick(event, () => onNavigate?.('about'))}>
          {message('appNameShort', 'SwitchyAgain')}
        </a>
        {isExperimental && (
          <sup className="options-experimental-badge text-danger">{message('options_experimental_badge', 'Experimental')}</sup>
        )}
      </h1>
      <nav className="options-shell-nav">
        <ul className="nav nav-pills nav-stacked options-shell-settings">
          <li className="nav-header options-shell-settings-header">
            <span>{message('options_navHeader_setting', 'Settings')}</span>
            <button
              type="button"
              className="options-shell-settings-toggle"
              aria-expanded={settingsOpen}
              aria-label={
                settingsOpen
                  ? message('options_collapseSettings', 'Collapse settings')
                  : message('options_expandSettings', 'Expand settings')
              }
              onClick={toggleSettings}
            >
              <span className={`glyphicon ${settingsOpen ? 'glyphicon-chevron-up' : 'glyphicon-chevron-down'}`} />
            </button>
            {!settingsOpen && <SettingsSectionMenuButton items={settingsItems} />}
          </li>
          {settingsOpen && (
            <>
              {settingsItems.map((item) => (
                <SettingsLink
                  key={item.key}
                  active={item.active}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  onClick={item.onClick}
                />
              ))}
            </>
          )}
          <li className="divider" />
        </ul>
        <ul className="nav nav-pills nav-stacked options-shell-profile-header">
          <li className="nav-header options-shell-section-header options-shell-profile-section-header">
            <span className="options-shell-profile-section-heading">
              <span>{profilesLabel}</span>
              {showProfilesCollapseToggle && (
                <button
                  type="button"
                  className="options-shell-settings-toggle options-shell-profile-section-toggle"
                  aria-expanded={profilesOpen}
                  aria-label={
                    profilesOpen
                      ? message('options_collapseProfiles', 'Collapse profiles')
                      : message('options_expandProfiles', 'Expand profiles')
                  }
                  onClick={() => setProfilesOpen(!profilesOpen)}
                >
                  <span className={`glyphicon ${profilesOpen ? 'glyphicon-chevron-up' : 'glyphicon-chevron-down'}`} />
                </button>
              )}
            </span>
            {actionMenuOptions.sectionMenu && (
              <ProfileSectionMenuButton
                activeProfileName={currentProfileName}
                ariaLabel={message('options_showProfilesFlyout', 'Show all')}
                browseAllLabel={message('options_browseAllProfiles', 'Browse all')}
                currentState={currentState}
                label={profilesLabel}
                onBrowseAll={() => setProfileBrowserOpen(true)}
                onNavigate={onNavigate}
                profileHref={profileHref}
                profiles={visibleProfiles}
              />
            )}
          </li>
        </ul>
        {profilesVisible && (
          <div className="options-shell-profile-list">
            <ul className="nav nav-pills nav-stacked">
              {visibleProfiles.map((profile) => (
                <ProfileNavItem
                  key={profile.name}
                  currentProfileName={currentProfileName}
                  currentState={currentState}
                  onDeleteProfile={sidebarDeleteProfile}
                  onExportPacProfile={sidebarExportPacProfile}
                  onExportRuleListProfile={sidebarExportRuleListProfile}
                  onNavigate={onNavigate}
                  onProfileColorChange={sidebarProfileColorChange}
                  onRenameProfile={sidebarRenameProfile}
                  profile={profile}
                  profileHref={profileHref}
                />
              ))}
            </ul>
          </div>
        )}
        {hiddenProfiles.length > 0 && (
          <>
            <ul className="nav nav-pills nav-stacked options-shell-hidden-profile-header">
              <li className="nav-header options-shell-section-header">
                <button
                  type="button"
                  className="options-shell-hidden-profile-toggle"
                  aria-expanded={hiddenProfilesOpen}
                  onClick={() => setHiddenProfilesOpen(!hiddenProfilesOpen)}
                >
                  <span className={`glyphicon ${hiddenProfilesOpen ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right'}`} />{' '}
                  <span>{hiddenProfilesLabel}</span>
                </button>
                {actionMenuOptions.sectionMenu && (
                  <ProfileSectionMenuButton
                    activeProfileName={currentProfileName}
                    ariaLabel={message('options_showHiddenProfilesFlyout', 'Show all')}
                    currentState={currentState}
                    label={hiddenProfilesLabel}
                    onNavigate={onNavigate}
                    profileHref={profileHref}
                    profiles={hiddenProfiles}
                  />
                )}
              </li>
            </ul>
            {hiddenProfilesOpen && (
              <div className="options-shell-hidden-profile-list">
                <ul className="nav nav-pills nav-stacked">
                  {hiddenProfiles.map((profile) => (
                    <ProfileNavItem
                      key={profile.name}
                      currentProfileName={currentProfileName}
                      currentState={currentState}
                      onDeleteProfile={sidebarDeleteProfile}
                      onExportPacProfile={sidebarExportPacProfile}
                      onExportRuleListProfile={sidebarExportRuleListProfile}
                      onNavigate={onNavigate}
                      onProfileColorChange={sidebarProfileColorChange}
                      onRenameProfile={sidebarRenameProfile}
                      profile={profile}
                      profileHref={profileHref}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {customProfileGroups.map((group) => {
          const open = !!openProfileGroups[group.id];
          return (
            <React.Fragment key={group.id}>
              <ul className="nav nav-pills nav-stacked options-shell-hidden-profile-header">
                <li className="nav-header options-shell-section-header">
                  <button
                    type="button"
                    className="options-shell-hidden-profile-toggle"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenProfileGroups({
                        ...openProfileGroups,
                        [group.id]: !open
                      })
                    }
                  >
                    <span className={`glyphicon ${open ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right'}`} />{' '}
                    <span>{group.name}</span>
                  </button>
                  {actionMenuOptions.sectionMenu && (
                    <ProfileSectionMenuButton
                      activeProfileName={currentProfileName}
                      ariaLabel={message('options_showProfileGroupFlyout', 'Show all')}
                      currentState={currentState}
                      label={group.name}
                      onNavigate={onNavigate}
                      profileHref={profileHref}
                      profiles={group.profiles}
                    />
                  )}
                </li>
              </ul>
              {open && (
                <div className="options-shell-hidden-profile-list">
                  <ul className="nav nav-pills nav-stacked">
                    {group.profiles.map((profile) => (
                      <ProfileNavItem
                        key={profile.name}
                        currentProfileName={currentProfileName}
                        currentState={currentState}
                        onDeleteProfile={sidebarDeleteProfile}
                        onExportPacProfile={sidebarExportPacProfile}
                        onExportRuleListProfile={sidebarExportRuleListProfile}
                        onNavigate={onNavigate}
                        onProfileColorChange={sidebarProfileColorChange}
                        onRenameProfile={sidebarRenameProfile}
                        profile={profile}
                        profileHref={profileHref}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </React.Fragment>
          );
        })}
        <ul className="nav nav-pills nav-stacked options-shell-actions">
          <li className="nav-new-profile">
            <a href={newProfileHref} role="button" onClick={(event) => navClick(event, onNewProfile)}>
              <span className="glyphicon glyphicon-plus" /> <span>{message('options_newProfile', 'New profile')}</span>
            </a>
          </li>
          <li className="divider" />
          <li className="nav-header">{message('options_navHeader_actions', 'Actions')}</li>
          <li>
            <a
              className={`btn-default btn align-initial ${optionsDirty ? 'btn-success' : ''}`}
              href="#"
              role="button"
              onClick={(event) => actionClick(event, onApply)}
            >
              <span className="glyphicon glyphicon-ok-circle" /> {message('options_apply', 'Apply changes')}
            </a>
          </li>
          <li className={optionsDirty ? '' : 'disabled'}>
            <a className="text-danger" href="#" role="button" onClick={(event) => navClick(event, optionsDirty ? onDiscard : undefined)}>
              <span className="glyphicon glyphicon-remove-circle" /> {message('options_discard', 'Discard changes')}
            </a>
          </li>
        </ul>
      </nav>
      {profileBrowserOpen && (
        <ProfileBrowserModal
          activeProfileName={currentProfileName}
          currentState={currentState}
          hiddenProfiles={hiddenProfiles}
          profileGroups={customProfileGroups}
          onClose={() => setProfileBrowserOpen(false)}
          onDeleteProfile={browserDeleteProfile}
          onExportPacProfile={browserExportPacProfile}
          onExportRuleListProfile={browserExportRuleListProfile}
          onNavigate={onNavigate}
          onProfileColorChange={browserProfileColorChange}
          onRenameProfile={browserRenameProfile}
          profileHref={profileHref}
          profiles={visibleProfiles}
        />
      )}
    </>
  );
}

export function OptionsAlert({alert, onClose, shown = false}: OptionsAlertProps) {
  if (!shown || !alert) {
    return null;
  }
  const icon = ALERT_ICONS[alert.type || ''] || '';
  const content = alert.i18n ? message(alert.i18n, alert.i18n) : alert.message;

  return (
    <div className="alert-top-wrapper">
      <div className={`alert ${alertClassForType(alert.type)}`}>
        <button type="button" className="close" onClick={onClose}>
          <span aria-hidden="true">{'\u00d7'}</span>
          <span className="sr-only">{message('dialog_close', 'Close')}</span>
        </button>
        {icon && <span className={`glyphicon ${icon}`} />} {content}
      </div>
    </div>
  );
}
