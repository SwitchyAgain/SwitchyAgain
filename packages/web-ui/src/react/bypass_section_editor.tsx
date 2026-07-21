import {message} from './i18n_client';
import {fixedProfileBypassList, fixedProfileBypassText} from './profile_content_logic';
import type {FixedProfileBypassSection} from './profile_types';

export type BypassSectionDraft = {
  enabled: boolean;
  name: string;
  text: string;
};

export function bypassSectionDrafts(sections?: FixedProfileBypassSection[]): BypassSectionDraft[] {
  return (sections || []).map((section) => ({
    enabled: section.enabled !== false,
    name: section.name || '',
    text: fixedProfileBypassText({bypassList: section.bypassList})
  }));
}

export function bypassSectionsFromDrafts(drafts: BypassSectionDraft[]): FixedProfileBypassSection[] {
  return drafts.map((draft) => ({
    bypassList: fixedProfileBypassList(draft.text),
    ...(draft.name ? {name: draft.name} : {}),
    ...(draft.enabled ? {} : {enabled: false})
  }));
}

export function bypassSectionIsEmpty(section: BypassSectionDraft) {
  return !section.name && !fixedProfileBypassList(section.text).length;
}

export function BypassSectionEditor({
  id,
  section,
  onChange,
  onRemove
}: {
  id: string;
  section: BypassSectionDraft;
  onChange: (changes: Partial<BypassSectionDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bypass-section">
      <div className="bypass-section-header width-limit">
        <label htmlFor={id}>{message('options_bypassSectionName', 'Section name')}</label>
        <input
          id={id}
          className="form-control"
          spellCheck={false}
          type="text"
          value={section.name}
          onChange={(event) => onChange({name: event.currentTarget.value})}
        />
        <button
          type="button"
          className="btn btn-danger"
          title={message('options_deleteBypassSection', 'Delete section')}
          onClick={onRemove}
        >
          <span className="glyphicon glyphicon-trash" />
        </button>
      </div>
      <label className="toggle-switch-label bypass-section-switch">
        <input
          type="checkbox"
          role="switch"
          checked={section.enabled}
          onChange={(event) => onChange({enabled: event.currentTarget.checked})}
        />
        <span className="toggle-switch" aria-hidden="true">
          <span className="toggle-switch-knob" />
        </span>
        <span>{message('options_enableBypassSection', 'Enable this list section')}</span>
      </label>
      <textarea
        className="monospace form-control width-limit bypass-section-textarea"
        rows={10}
        spellCheck={false}
        value={section.text}
        onChange={(event) => onChange({text: event.currentTarget.value})}
      />
    </div>
  );
}
