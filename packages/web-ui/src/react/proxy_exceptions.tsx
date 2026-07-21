import {useEffect, useMemo, useRef, useState} from 'react';
import {
  BypassSectionEditor,
  bypassSectionDrafts,
  bypassSectionIsEmpty,
  bypassSectionsFromDrafts,
  type BypassSectionDraft
} from './bypass_section_editor';
import {ConfirmModal} from './confirm_modals';
import {useOutsidePointer} from './dom_event_hooks';
import {message} from './i18n_client';
import type {Options} from './options_client_types';
import {cloneOptions, updateProfileRevision} from './options_logic';
import {fixedProfileBypassList, fixedProfileBypassText} from './profile_content_logic';
import {ProfileGroupInline, profileGroupsEnabled, profileGroupsForOptions, type ProfileGroup} from './profile_groups';
import type {SupplementalBypassList} from './profile_types';
import {ProfileInline, profilesForFilter} from './profile_widgets';
import {
  addSupplementalList,
  DEFAULT_SUPPLEMENTAL_LIST_ID,
  ensureDefaultSupplementalList,
  supplementalListNameError,
  supplementalListsForOptions
} from './supplemental_lists';

type ListModalState = {kind: 'create'} | {kind: 'rename'; list: SupplementalBypassList} | null;

function SupplementalListContentEditor({
  list,
  showSections,
  showListName = false,
  onChange
}: {
  list: SupplementalBypassList;
  showSections: boolean;
  showListName?: boolean;
  onChange: (list: SupplementalBypassList) => void;
}) {
  const [listText, setListText] = useState(() => fixedProfileBypassText({bypassList: list.bypassList}));
  const [sections, setSections] = useState<BypassSectionDraft[]>(() => bypassSectionDrafts(list.bypassSections));
  const [pendingDeleteSectionIndex, setPendingDeleteSectionIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listEditorRef = useRef<HTMLTextAreaElement>(null);
  const previousListIdRef = useRef(list.id);

  useEffect(() => {
    const listChanged = previousListIdRef.current !== list.id;
    previousListIdRef.current = list.id;
    if (listChanged || document.activeElement !== listEditorRef.current) {
      setListText(fixedProfileBypassText({bypassList: list.bypassList}));
    }
    const activeElement = document.activeElement;
    const sectionFocused =
      activeElement instanceof HTMLElement && rootRef.current?.contains(activeElement) && !!activeElement.closest('.bypass-section');
    if (listChanged || !sectionFocused) {
      setSections(bypassSectionDrafts(list.bypassSections));
      setPendingDeleteSectionIndex(null);
    }
  }, [list.id, list.bypassList, list.bypassSections]);

  function commit(nextText = listText, nextSections = sections) {
    onChange({
      ...list,
      bypassList: fixedProfileBypassList(nextText),
      bypassSections: bypassSectionsFromDrafts(nextSections)
    });
  }

  function updateSection(index: number, patch: Partial<BypassSectionDraft>) {
    const next = sections.map((section, sectionIndex) => (sectionIndex === index ? {...section, ...patch} : section));
    setSections(next);
    commit(listText, next);
  }

  function removeSection(index: number) {
    const next = sections.filter((_section, sectionIndex) => sectionIndex !== index);
    setSections(next);
    commit(listText, next);
    setPendingDeleteSectionIndex(null);
  }

  function requestRemoveSection(index: number) {
    const section = sections[index];
    if (!section) return;
    if (bypassSectionIsEmpty(section)) removeSection(index);
    else setPendingDeleteSectionIndex(index);
  }

  return (
    <div ref={rootRef} className={`supplemental-list-content-item${showListName ? ' supplemental-list-content-item-all' : ''}`}>
      {showListName && <h4 className="supplemental-list-content-name">{list.name}</h4>}
      <p className="help-block">
        {message('options_bypassListHelp', 'Servers for which you do not want to use any proxy: (One server on each line.)')}
      </p>
      <p className="help-block">
        <a href="https://developer.chrome.com/extensions/proxy#bypass_list" target="_blank" rel="noreferrer">
          {message('options_bypassListHelpLinkText', '(Wildcards and more available…)')}
        </a>
      </p>
      <textarea
        ref={listEditorRef}
        className="monospace form-control width-limit"
        rows={10}
        spellCheck={false}
        value={listText}
        onChange={(event) => {
          const nextText = event.currentTarget.value;
          setListText(nextText);
          commit(nextText);
        }}
        onBlur={() => commit()}
      />
      {showSections &&
        sections.map((section, index) => (
          <BypassSectionEditor
            id={`supplemental-list-${list.id}-section-name-${index}`}
            key={index}
            section={section}
            onChange={(changes) => updateSection(index, changes)}
            onRemove={() => requestRemoveSection(index)}
          />
        ))}
      {showSections && (
        <p className="bypass-section-add">
          <button
            type="button"
            className="btn btn-default"
            onClick={() => {
              const next = sections.concat({enabled: true, name: '', text: ''});
              setSections(next);
              commit(listText, next);
            }}
          >
            <span className="glyphicon glyphicon-plus" /> <span>{message('options_addBypassSection', 'Add a new list section')}</span>
          </button>
        </p>
      )}
      {showSections && pendingDeleteSectionIndex != null && (
        <>
          <div className="modal-backdrop fade in" />
          <div className="modal fade in options-modal" role="dialog" style={{display: 'flex'}} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <ConfirmModal
                  sectionName={sections[pendingDeleteSectionIndex]?.name}
                  kind="bypassSectionRemove"
                  onClose={() => removeSection(pendingDeleteSectionIndex)}
                  onDismiss={() => setPendingDeleteSectionIndex(null)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SupplementalListSelect({
  ariaLabel,
  disabled = false,
  lists,
  value,
  onChange
}: {
  ariaLabel: string;
  disabled?: boolean;
  lists: SupplementalBypassList[];
  value: string;
  onChange: (listId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = lists.find((list) => list.id === value) || lists[0];
  useOutsidePointer(rootRef, () => setOpen(false), open);
  return (
    <div ref={rootRef} className={`btn-group supplemental-list-select ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="btn btn-default dropdown-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="true"
        aria-label={ariaLabel}
        disabled={disabled || !selected}
        onClick={() => setOpen(!open)}
      >
        <span>{selected?.name || message('options_supplementalListNone', 'No lists')}</span> <span className="caret" />
      </button>
      {open && (
        <ul className="dropdown-menu" role="listbox">
          {lists.map((list) => (
            <li key={list.id} role="option" className={list.id === selected?.id ? 'active' : ''}>
              <a
                onClick={() => {
                  onChange(list.id);
                  setOpen(false);
                }}
              >
                {list.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListNameModal({
  currentListId,
  initialName = '',
  lists,
  action,
  title,
  onCancel,
  onSubmit
}: {
  currentListId?: string;
  initialName?: string;
  lists: SupplementalBypassList[];
  action: string;
  title: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  const error = supplementalListNameError(trimmed, lists, currentListId);
  return (
    <>
      <div className="modal-backdrop fade in" />
      <div className="modal fade in options-modal" role="dialog" style={{display: 'flex'}} tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" aria-label={message('options_modalClose', 'Close')} onClick={onCancel}>
                <span aria-hidden="true">{'×'}</span>
              </button>
              <h4 className="modal-title">{title}</h4>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{message('options_supplementalListName', 'List name')}</label>
                <input
                  autoFocus
                  className="form-control"
                  spellCheck={false}
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !error) onSubmit(trimmed);
                  }}
                />
                {error && <p className="help-block text-danger">{error}</p>}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-default" onClick={onCancel}>
                {message('dialog_cancel', 'Cancel')}
              </button>
              <button type="button" className="btn btn-primary" disabled={!!error} onClick={() => onSubmit(trimmed)}>
                {action}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileLinksModal({
  list,
  options,
  onCancel,
  onSave
}: {
  list: SupplementalBypassList;
  options: Options;
  onCancel: () => void;
  onSave: (profileNames: Set<string>) => void;
}) {
  const profiles = profilesForFilter(options, 'sorted').filter((profile) => profile.profileType === 'FixedProfile');
  const [selected, setSelected] = useState(
    () => new Set(profiles.filter((profile) => profile.supplementalListIds?.includes(list.id)).map((profile) => profile.name))
  );
  return (
    <>
      <div className="modal-backdrop fade in" />
      <div className="modal fade in options-modal" role="dialog" style={{display: 'flex'}} tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" aria-label={message('options_modalClose', 'Close')} onClick={onCancel}>
                <span aria-hidden="true">{'×'}</span>
              </button>
              <h4 className="modal-title">
                {message('options_supplementalListProfilesTitle', `Manage Proxy Profile Links for “${list.name}”`, list.name)}
              </h4>
            </div>
            <div className="modal-body">
              {profiles.length ? (
                <table className="table table-striped supplemental-list-links-table">
                  <thead>
                    <tr>
                      <th>{message('options_supplementalListColumnLink', 'Link')}</th>
                      <th>{message('options_supplementalListColumnProxyProfile', 'Proxy Profile')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile) => {
                      return (
                        <tr key={profile.name}>
                          <td className="supplemental-list-links-check-cell">
                            <input
                              type="checkbox"
                              aria-label={profile.name}
                              checked={selected.has(profile.name)}
                              onChange={(event) => {
                                const next = new Set(selected);
                                if (event.currentTarget.checked) next.add(profile.name);
                                else next.delete(profile.name);
                                setSelected(next);
                              }}
                            />
                          </td>
                          <td>
                            <ProfileInline profile={profile} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted">{message('options_supplementalListNoProfiles', 'No Proxy Profiles are available.')}</p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-default" onClick={onCancel}>
                {message('dialog_cancel', 'Cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onSave(selected)}>
                {message('dialog_save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function GroupLinksModal({
  list,
  groups,
  onCancel,
  onSave
}: {
  list: SupplementalBypassList;
  groups: ProfileGroup[];
  onCancel: () => void;
  onSave: (groupIds: Set<string>) => void;
}) {
  const [selected, setSelected] = useState(
    () => new Set(groups.filter((group) => group.supplementalListIds?.includes(list.id)).map((group) => group.id))
  );
  return (
    <>
      <div className="modal-backdrop fade in" />
      <div className="modal fade in options-modal" role="dialog" style={{display: 'flex'}} tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" aria-label={message('options_modalClose', 'Close')} onClick={onCancel}>
                <span aria-hidden="true">{'×'}</span>
              </button>
              <h4 className="modal-title">
                {message('options_supplementalListGroupsTitle', `Manage Profile Group Links for “${list.name}”`, list.name)}
              </h4>
            </div>
            <div className="modal-body">
              {groups.length ? (
                <table className="table table-striped supplemental-list-links-table">
                  <thead>
                    <tr>
                      <th>{message('options_supplementalListColumnLink', 'Link')}</th>
                      <th>{message('options_supplementalListColumnProfileGroup', 'Profile Group')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      return (
                        <tr key={group.id}>
                          <td className="supplemental-list-links-check-cell">
                            <input
                              type="checkbox"
                              aria-label={group.name}
                              checked={selected.has(group.id)}
                              onChange={(event) => {
                                const next = new Set(selected);
                                if (event.currentTarget.checked) next.add(group.id);
                                else next.delete(group.id);
                                setSelected(next);
                              }}
                            />
                          </td>
                          <td>
                            <ProfileGroupInline group={group} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted">{message('options_supplementalListNoGroups', 'No Profile Groups are available.')}</p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-default" onClick={onCancel}>
                {message('dialog_cancel', 'Cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onSave(selected)}>
                {message('dialog_save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ProxyExceptionsPage({options, onOptionsChange}: {options: Options; onOptionsChange: (options: Options) => void}) {
  const lists = useMemo(() => supplementalListsForOptions(options), [options]);
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id || '');
  const [showAllLists, setShowAllLists] = useState(false);
  const [listModal, setListModal] = useState<ListModalState>(null);
  const [deleteListState, setDeleteListState] = useState<SupplementalBypassList | null>(null);
  const [profileLinksList, setProfileLinksList] = useState<SupplementalBypassList | null>(null);
  const [groupLinksList, setGroupLinksList] = useState<SupplementalBypassList | null>(null);
  const showSections = Boolean(options['-showProxyExceptionsBypassListSections']);
  const selectedList = lists.find((list) => list.id === selectedListId) || lists[0];
  const resolvedSelectedListId = selectedList?.id || '';
  const globalListId = lists.some((list) => list.id === options['-globalBypassListId'])
    ? (options['-globalBypassListId'] as string)
    : lists[0]?.id || '';
  const profiles = useMemo(
    () => profilesForFilter(options, 'sorted').filter((profile) => profile.profileType === 'FixedProfile'),
    [options]
  );
  const groupsEnabled = profileGroupsEnabled(options);
  const profileGroups = useMemo(() => profileGroupsForOptions(options), [options]);

  useEffect(() => {
    if (lists.some((list) => list.id === DEFAULT_SUPPLEMENTAL_LIST_ID) || options['-proxyExceptionsEnabled'] !== true) return;
    const next = cloneOptions(options);
    ensureDefaultSupplementalList(next);
    onOptionsChange(next);
  }, [lists, onOptionsChange, options]);

  useEffect(() => {
    if (resolvedSelectedListId !== selectedListId) setSelectedListId(resolvedSelectedListId);
  }, [resolvedSelectedListId, selectedListId]);

  function updateOptions(updater: (next: Options) => void) {
    const next = cloneOptions(options);
    updater(next);
    onOptionsChange(next);
  }

  function updateListContent(updatedList: SupplementalBypassList) {
    updateOptions((next) => {
      next['-supplementalLists'] = supplementalListsForOptions(next).map((list) => (list.id === updatedList.id ? updatedList : list));
    });
  }

  function linkedProfiles(listId: string) {
    return profiles.filter((profile) => profile.supplementalListIds?.includes(listId));
  }

  function linkedGroups(listId: string) {
    return profileGroups.filter((group) => group.supplementalListIds?.includes(listId));
  }

  function createList(name: string) {
    let createdId = '';
    updateOptions((next) => {
      createdId = addSupplementalList(next, name).id;
    });
    setSelectedListId(createdId);
    setListModal(null);
  }

  function renameList(name: string) {
    if (listModal?.kind !== 'rename') return;
    const listId = listModal.list.id;
    updateOptions((next) => {
      next['-supplementalLists'] = supplementalListsForOptions(next).map((list) => (list.id === listId ? {...list, name} : list));
    });
    setListModal(null);
  }

  function deleteList(list: SupplementalBypassList) {
    if (list.id === DEFAULT_SUPPLEMENTAL_LIST_ID) return;
    const remaining = lists.filter((candidate) => candidate.id !== list.id);
    const fallback = remaining.find((candidate) => candidate.id === DEFAULT_SUPPLEMENTAL_LIST_ID);
    updateOptions((next) => {
      next['-supplementalLists'] = supplementalListsForOptions(next).filter((candidate) => candidate.id !== list.id);
      if (next['-globalBypassListId'] === list.id) next['-globalBypassListId'] = fallback?.id || '';
      profilesForFilter(next).forEach((profile) => {
        if (!profile.supplementalListIds?.includes(list.id)) return;
        profile.supplementalListIds = profile.supplementalListIds.filter((id) => id !== list.id);
        updateProfileRevision(profile);
      });
      next['-profileGroups'] = profileGroupsForOptions(next).map((group) => ({
        ...group,
        supplementalListIds: (group.supplementalListIds || []).filter((id) => id !== list.id)
      }));
    });
    if (selectedListId === list.id) setSelectedListId(fallback?.id || '');
    setDeleteListState(null);
  }

  function saveProfileLinks(list: SupplementalBypassList, selectedNames: Set<string>) {
    updateOptions((next) => {
      profilesForFilter(next).forEach((profile) => {
        if (profile.profileType !== 'FixedProfile') return;
        const ids = new Set(Array.isArray(profile.supplementalListIds) ? profile.supplementalListIds : []);
        if (selectedNames.has(profile.name)) ids.add(list.id);
        else ids.delete(list.id);
        profile.supplementalListIds = Array.from(ids);
        updateProfileRevision(profile);
      });
    });
    setProfileLinksList(null);
  }

  function saveGroupLinks(list: SupplementalBypassList, selectedGroupIds: Set<string>) {
    updateOptions((next) => {
      next['-profileGroups'] = profileGroupsForOptions(next).map((group) => {
        const ids = new Set(group.supplementalListIds || []);
        if (selectedGroupIds.has(group.id)) ids.add(list.id);
        else ids.delete(list.id);
        return {...group, supplementalListIds: Array.from(ids)};
      });
    });
    setGroupLinksList(null);
  }

  const deleteListProfiles = deleteListState ? linkedProfiles(deleteListState.id) : [];
  const deleteListGroups = deleteListState ? linkedGroups(deleteListState.id) : [];
  const deleteListHasLinks = deleteListProfiles.length > 0 || deleteListGroups.length > 0;
  const deleteListIsGlobal = deleteListState?.id === globalListId;

  return (
    <div className="proxy-exceptions-page">
      <div className="page-header">
        <h2>{message('options_tab_proxyExceptions', 'Proxy Exceptions')}</h2>
      </div>

      <section className="settings-group">
        <h3>{message('options_proxyExceptionsGlobalHeading', 'Global Bypass')}</h3>
        <p className="help-block">
          {message('options_proxyExceptionsGlobalHelp', 'Choose a Supplemental List to apply to all Proxy Profiles.')}
        </p>
        <div className="form-group proxy-exceptions-list-control">
          <label>{message('options_globalBypassList', 'Global Bypass List')}</label>
          <SupplementalListSelect
            ariaLabel={message('options_globalBypassList', 'Global Bypass List')}
            lists={lists}
            value={globalListId}
            onChange={(listId) =>
              updateOptions((next) => {
                next['-globalBypassListId'] = listId;
              })
            }
          />
        </div>
      </section>

      <section className="settings-group">
        <div className="settings-section-heading">
          <h3>{message('options_supplementalListsHeading', 'Supplemental Lists')}</h3>
          <button className="btn btn-default" type="button" onClick={() => setListModal({kind: 'create'})}>
            <span className="glyphicon glyphicon-plus" aria-hidden="true" /> {message('options_supplementalListNew', 'New List')}
          </button>
        </div>
        <p className="help-block">
          {message(
            'options_supplementalListsHelp',
            'Create and manage Bypass Lists that can be used globally or linked to selected Proxy Profiles.'
          )}
        </p>
        {lists.length ? (
          <table className="table table-striped settings-table-fixed supplemental-lists-table">
            <thead>
              <tr>
                <th>{message('options_supplementalListColumnList', 'List')}</th>
                <th>{message('options_supplementalListColumnDirectProfiles', 'Direct Profile Links')}</th>
                {groupsEnabled && <th>{message('options_supplementalListColumnProfileGroups', 'Profile Group Links')}</th>}
                <th>{message('options_profileGroupColumnActions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr key={list.id}>
                  <td>
                    {list.name}
                    {list.id === globalListId && (
                      <span className="label label-info supplemental-list-global-label">
                        {message('options_supplementalListGlobalLabel', 'Global')}
                      </span>
                    )}
                  </td>
                  <td>{linkedProfiles(list.id).length}</td>
                  {groupsEnabled && <td>{linkedGroups(list.id).length}</td>}
                  <td>
                    <span className="settings-actions">
                      <button
                        className="btn btn-default btn-sm"
                        type="button"
                        title={message('dialog_rename', 'Rename')}
                        onClick={() => setListModal({kind: 'rename', list})}
                      >
                        <span className="glyphicon glyphicon-edit" aria-hidden="true" />
                      </button>
                      <button
                        className="btn btn-default btn-sm"
                        type="button"
                        title={message('options_supplementalListManageProfiles', 'Manage Proxy Profile Links')}
                        onClick={() => setProfileLinksList(list)}
                      >
                        <span className="glyphicon glyphicon-arrow-right" aria-hidden="true" />
                      </button>
                      {groupsEnabled && (
                        <button
                          className="btn btn-default btn-sm"
                          type="button"
                          title={message('options_supplementalListManageGroups', 'Manage Profile Group Links')}
                          onClick={() => setGroupLinksList(list)}
                        >
                          <span className="glyphicon glyphicon-folder-close" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        disabled={list.id === DEFAULT_SUPPLEMENTAL_LIST_ID}
                        title={
                          list.id === DEFAULT_SUPPLEMENTAL_LIST_ID
                            ? message('options_defaultSupplementalListCannotDelete', 'The Default Supplemental List cannot be deleted.')
                            : message('dialog_delete', 'Delete')
                        }
                        onClick={() => setDeleteListState(list)}
                      >
                        <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">{message('options_supplementalListsEmpty', 'No Supplemental Lists have been created.')}</p>
        )}
      </section>

      <section className="settings-group">
        <h3>{message('options_supplementalListContentHeading', 'List Content')}</h3>
        <p className="help-block">{message('options_supplementalListContentHelp', 'Choose a Supplemental List to edit its content.')}</p>
        <div className="form-group proxy-exceptions-list-control">
          <label>{message('options_supplementalList', 'Supplemental List')}</label>
          <SupplementalListSelect
            ariaLabel={message('options_supplementalListContentHeading', 'List Content')}
            disabled={showAllLists}
            lists={lists}
            value={selectedList?.id || ''}
            onChange={setSelectedListId}
          />
          {lists.length > 0 && (
            <button
              type="button"
              className="btn btn-link settings-advanced-toggle supplemental-lists-show-all-toggle"
              aria-expanded={showAllLists}
              onClick={() => setShowAllLists(!showAllLists)}
            >
              <span className={`glyphicon ${showAllLists ? 'glyphicon-chevron-up' : 'glyphicon-chevron-down'}`} aria-hidden="true" />{' '}
              {showAllLists
                ? message('options_supplementalListHideAll', 'Hide All Lists')
                : message('options_supplementalListShowAll', 'Show All Lists')}
            </button>
          )}
        </div>
        {showAllLists ? (
          <div className="supplemental-list-content-all">
            {lists.map((list) => (
              <SupplementalListContentEditor
                key={list.id}
                list={list}
                showSections={showSections}
                showListName
                onChange={updateListContent}
              />
            ))}
          </div>
        ) : selectedList ? (
          <SupplementalListContentEditor list={selectedList} showSections={showSections} onChange={updateListContent} />
        ) : (
          <p className="text-muted">{message('options_supplementalListSelectHelp', 'Create a Supplemental List to edit its content.')}</p>
        )}
      </section>

      {listModal?.kind === 'create' && (
        <ListNameModal
          action={message('dialog_create', 'Create')}
          lists={lists}
          title={message('options_supplementalListCreateTitle', 'New Supplemental List')}
          onCancel={() => setListModal(null)}
          onSubmit={createList}
        />
      )}
      {listModal?.kind === 'rename' && (
        <ListNameModal
          action={message('dialog_save', 'Save')}
          currentListId={listModal.list.id}
          initialName={listModal.list.name}
          lists={lists}
          title={message('options_supplementalListRenameTitle', 'Rename Supplemental List')}
          onCancel={() => setListModal(null)}
          onSubmit={renameList}
        />
      )}
      {profileLinksList && (
        <ProfileLinksModal
          list={profileLinksList}
          options={options}
          onCancel={() => setProfileLinksList(null)}
          onSave={(names) => saveProfileLinks(profileLinksList, names)}
        />
      )}
      {groupLinksList && (
        <GroupLinksModal
          groups={profileGroups}
          list={groupLinksList}
          onCancel={() => setGroupLinksList(null)}
          onSave={(groupIds) => saveGroupLinks(groupLinksList, groupIds)}
        />
      )}
      {deleteListState && (
        <>
          <div className="modal-backdrop fade in" />
          <div className="modal fade in options-modal" role="dialog" style={{display: 'flex'}} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <button
                    type="button"
                    className="close"
                    aria-label={message('options_modalClose', 'Close')}
                    onClick={() => setDeleteListState(null)}
                  >
                    <span aria-hidden="true">{'×'}</span>
                  </button>
                  <h4 className="modal-title">{message('options_deleteSupplementalListTitle', 'Delete Supplemental List')}</h4>
                </div>
                <div className="modal-body">
                  <p>
                    {message(
                      'options_deleteSupplementalListHelp',
                      `Delete the Supplemental List “${deleteListState.name}”?`,
                      deleteListState.name
                    )}
                  </p>
                  {deleteListProfiles.length > 0 && (
                    <div className="supplemental-list-delete-links-section">
                      <p>
                        <strong>{message('options_supplementalListLinkedProfiles', 'Linked Proxy Profiles')}</strong>
                      </p>
                      <div className="well">
                        <ul className="list-style-none supplemental-list-delete-links">
                          {deleteListProfiles.map((profile) => (
                            <li key={profile.name}>
                              <ProfileInline profile={profile} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {deleteListGroups.length > 0 && (
                    <div className="supplemental-list-delete-links-section">
                      <p>
                        <strong>{message('options_supplementalListLinkedGroups', 'Linked Profile Groups')}</strong>
                      </p>
                      <div className="well">
                        <ul className="list-style-none supplemental-list-delete-links">
                          {deleteListGroups.map((group) => (
                            <li key={group.id}>
                              <ProfileGroupInline group={group} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {deleteListHasLinks && (
                    <p className="text-danger">
                      {message(
                        'options_deleteSupplementalListLinksWarning',
                        'Deleting this Supplemental List will also remove all links shown above.'
                      )}
                    </p>
                  )}
                  {deleteListIsGlobal && (
                    <p className="text-danger">
                      {message(
                        'options_deleteGlobalSupplementalListWarning',
                        'This list is currently used as the Global Bypass List. The Default list will become the Global Bypass List after deletion.'
                      )}
                    </p>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-default" onClick={() => setDeleteListState(null)}>
                    {message('dialog_cancel', 'Cancel')}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => deleteList(deleteListState)}>
                    {message('dialog_delete', 'Delete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
