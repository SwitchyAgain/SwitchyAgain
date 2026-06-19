import React, {useEffect, useState} from 'react';
import {message} from './i18n_client';
import type {Options} from './options_client_types';
import {Profile, ProfileIcon, ProfileInline, ProfileSelect, profileByName} from './profile_widgets';
import type {RuleListProfileModel} from './profile_types';
import type {SwitchRule} from './switch_profile_runtime';

export type ConfirmKind =
  | 'apply'
  | 'cannotDeleteProfile'
  | 'deleteAttached'
  | 'deleteProfile'
  | 'reset'
  | 'replaceProfile'
  | 'ruleRemove'
  | 'ruleReset'
  | 'sourceDraft';

type AttachedRuleList = RuleListProfileModel;

export type ConfirmModalCloseValue =
  | 'applySource'
  | 'discardSource'
  | 'ok'
  | {
      fromName: string;
      toName: string;
    };

type ConfirmModalBaseProps = {
  onClose?: (value?: ConfirmModalCloseValue) => void;
  onDismiss?: () => void;
  options?: Options | null;
};

export type ConfirmModalProps = ConfirmModalBaseProps &
  (
    | {
        kind: 'apply';
      }
    | {
        kind: 'cannotDeleteProfile';
        profile: Profile;
        refs: Profile[];
      }
    | {
        attached?: AttachedRuleList | null;
        kind: 'deleteAttached';
      }
    | {
        kind: 'deleteProfile';
        profile: Profile;
      }
    | {
        kind: 'reset';
      }
    | {
        kind: 'sourceDraft';
      }
    | {
        fromName: string;
        kind: 'replaceProfile';
        toName: string;
      }
    | {
        kind: 'ruleRemove';
        rule: SwitchRule;
        ruleProfile?: Profile | null;
      }
    | {
        kind: 'ruleReset';
        ruleProfile?: Profile | null;
      }
  );

function attachedLabel(attached?: AttachedRuleList | null) {
  if (!attached) {
    return '';
  }
  if (attached.sourceUrl) {
    return attached.sourceUrl;
  }
  const lineCount = String((attached.ruleList || '').split('\n').length);
  return message('options_ruleListLineCount', `${lineCount} line(s) of rules`, lineCount);
}

function titleFor(kind: ConfirmKind) {
  switch (kind) {
    case 'apply':
      return message('options_modalHeader_applyOptions', 'Apply Options');
    case 'cannotDeleteProfile':
      return message('options_modalHeader_cannotDeleteProfile', 'Unable to Delete Profile');
    case 'deleteAttached':
      return message('options_modalHeader_deleteAttached', 'Remove Rule List');
    case 'deleteProfile':
      return message('options_modalHeader_deleteProfile', 'Delete Profile');
    case 'reset':
      return message('options_modalHeader_resetOptions', 'Reset Options');
    case 'replaceProfile':
      return message('options_modalHeader_replaceProfile', 'Replace Profile');
    case 'sourceDraft':
      return message('options_modalHeader_sourceDraft', 'Apply Source Changes');
    case 'ruleRemove':
      return message('options_modalHeader_deleteRule', 'Delete Rule');
    case 'ruleReset':
      return message('options_modalHeader_resetRules', 'Reset Rules');
  }
}

function messageWithNodes(key: string, fallback: string, substitutions: string[], nodes: Record<string, React.ReactNode>) {
  const text = message(key, fallback, substitutions);
  const tokens = Object.keys(nodes);
  if (!tokens.length) {
    return text;
  }
  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text
    .split(pattern)
    .map((part, index) => (nodes[part] ? <React.Fragment key={`${part}-${index}`}>{nodes[part]}</React.Fragment> : part));
}

function bodyFor(
  props: ConfirmModalProps,
  replaceState: {
    fromName: string;
    setFromName: (name: string) => void;
    setToName: (name: string) => void;
    toName: string;
  }
) {
  switch (props.kind) {
    case 'apply':
      return (
        <>
          <p>{message('options_applyOptionsRequired', 'Your changes to the options must be applied before you proceed.')}</p>
          <p>{message('options_applyOptionsConfirm', 'Do you want to save and apply the options?')}</p>
        </>
      );
    case 'cannotDeleteProfile':
      return (
        <>
          <p>{message('options_profileReferredBy', 'This profile cannot be deleted because it is referred by the following profiles:')}</p>
          <div className="well">
            <ul className="list-style-none">
              {props.refs.map((refProfile, index) => (
                <li key={`${refProfile.name}-${index}`}>
                  <ProfileInline profile={refProfile} />
                </li>
              ))}
            </ul>
          </div>
          <p>
            {message(
              'options_modifyReferringProfiles',
              'You must modify these profiles and make them stop referring to this profile before you can delete it.'
            )}
          </p>
        </>
      );
    case 'deleteAttached':
      return (
        <>
          <p>{message('options_deleteAttachedConfirm', 'Do you really want to remove the rule list from the current profile?')}</p>
          <div className="well">
            <ProfileIcon profile={props.attached} /> {attachedLabel(props.attached)}
          </div>
        </>
      );
    case 'deleteProfile':
      return (
        <>
          <p>{message('options_deleteProfileConfirm', 'Do you really want to delete the following profile?')}</p>
          <div className="well">
            <ProfileInline profile={props.profile} />
          </div>
        </>
      );
    case 'reset':
      return (
        <p className="text-danger">
          {message('options_resetOptionsConfirm', 'Do you really want to reset the options? All profiles and settings will be LOST!')}
        </p>
      );
    case 'sourceDraft':
      return (
        <>
          <p>
            {message('options_sourceDraftConfirm', 'Your changes in the source editor must be applied or discarded before you proceed.')}
          </p>
          <p>
            {message(
              'options_sourceDraftApplyHelp',
              'Applying source changes will parse the source and update the switch rules. If parsing fails, you can keep editing.'
            )}
          </p>
        </>
      );
    case 'replaceProfile': {
      const fromProfile = profileByName(props.options, replaceState.fromName);
      const toProfile = profileByName(props.options, replaceState.toName);
      return (
        <>
          <div>
            {messageWithNodes(
              'options_replaceProfileConfirm',
              'Do you really want to replace __FROM_PROFILE__ with __TO_PROFILE__?',
              ['__FROM_PROFILE__', '__TO_PROFILE__'],
              {
                __FROM_PROFILE__: (
                  <ProfileSelect name={replaceState.fromName} onChange={replaceState.setFromName} options={props.options} />
                ),
                __TO_PROFILE__: <ProfileSelect name={replaceState.toName} onChange={replaceState.setToName} options={props.options} />
              }
            )}
          </div>
          <div className="well">
            <ProfileInline profile={fromProfile} /> <span className="glyphicon glyphicon-chevron-right" />{' '}
            <ProfileInline profile={toProfile} />
          </div>
          <div className="help-block">
            {messageWithNodes(
              'options_replaceProfileHelp',
              'If you proceed, all rules pointing to __FROM_PROFILE__ will be updated to use __TO_PROFILE__ instead. Other options, such as startup profile and Quick Switch will also be modified as appropriate. However, the two profile themselves will NOT be changed or deleted.',
              ['__FROM_PROFILE__', '__TO_PROFILE__'],
              {
                __FROM_PROFILE__: <ProfileInline profile={fromProfile} />,
                __TO_PROFILE__: <ProfileInline profile={toProfile} />
              }
            )}
          </div>
        </>
      );
    }
    case 'ruleRemove':
      return (
        <>
          <p>{message('options_deleteRuleConfirm', 'Do you really want to delete the following rule?')}</p>
          <div className="well">
            <span className="label label-info">
              {message(`condition_${props.rule.condition?.conditionType}`, props.rule.condition?.conditionType || '')}
            </span>{' '}
            {props.rule.condition?.pattern}
            <span className="pull-right">
              <ProfileInline profile={props.ruleProfile} />
            </span>
          </div>
        </>
      );
    case 'ruleReset':
      return (
        <>
          <p>{message('options_resetRulesConfirm', 'Are you sure to set the result profile of ALL rules to the following profile?')}</p>
          <div className="well">
            <ProfileInline profile={props.ruleProfile} />
          </div>
        </>
      );
  }
}

function closeButtonFor(kind: ConfirmKind) {
  switch (kind) {
    case 'apply':
      return {
        className: 'btn-primary',
        label: message('options_apply', 'Apply changes'),
        value: 'ok'
      };
    case 'cannotDeleteProfile':
      return null;
    case 'deleteAttached':
      return {
        className: 'btn-danger',
        label: message('options_deleteAttached', 'Remove rule list'),
        value: 'ok'
      };
    case 'deleteProfile':
      return {
        className: 'btn-danger',
        label: message('options_deleteProfile', 'Delete Profile'),
        value: 'ok'
      };
    case 'reset':
      return {
        className: 'btn-danger',
        label: message('options_reset', 'Reset'),
        value: 'ok'
      };
    case 'replaceProfile':
      return {
        className: 'btn-warning',
        label: message('options_replaceProfile', 'Replace Profile'),
        value: 'replace'
      };
    case 'ruleRemove':
      return {
        className: 'btn-danger',
        label: message('options_deleteRule', 'Delete'),
        value: 'ok'
      };
    case 'ruleReset':
      return {
        className: 'btn-warning',
        label: message('options_resetRules', 'Reset Rules'),
        value: 'ok'
      };
    case 'sourceDraft':
      return {
        className: 'btn-primary',
        label: message('options_applySource', 'Apply Source'),
        value: 'applySource'
      };
  }
}

export function ConfirmModal(props: ConfirmModalProps) {
  const {kind, onClose, onDismiss} = props;
  const replaceFromName = props.kind === 'replaceProfile' ? props.fromName : '';
  const replaceToName = props.kind === 'replaceProfile' ? props.toName : '';
  const [fromName, setFromName] = useState(replaceFromName);
  const [toName, setToName] = useState(replaceToName);
  useEffect(() => {
    setFromName(replaceFromName);
    setToName(replaceToName);
  }, [replaceFromName, replaceToName]);
  const closeButton = closeButtonFor(kind);
  const handleClose = () => {
    if (kind === 'replaceProfile') {
      onClose?.({fromName, toName});
      return;
    }
    if (kind === 'sourceDraft') {
      onClose?.('applySource');
      return;
    }
    onClose?.('ok');
  };
  return (
    <>
      <div className="modal-header">
        <button type="button" className="close" onClick={onDismiss}>
          <span aria-hidden="true">{'\u00d7'}</span>
          <span className="sr-only">{message('dialog_close', 'Close')}</span>
        </button>
        <h4 className="modal-title">{titleFor(kind)}</h4>
      </div>
      <div className="modal-body">{bodyFor(props, {fromName, setFromName, setToName, toName})}</div>
      <div className="modal-footer">
        <button type="button" className="btn btn-default" onClick={onDismiss}>
          {message('dialog_cancel', 'Cancel')}
        </button>
        {kind === 'sourceDraft' && (
          <button type="button" className="btn btn-warning" onClick={() => onClose?.('discardSource')}>
            {message('options_discardSource', 'Discard Source')}
          </button>
        )}
        {closeButton && (
          <button type="button" className={`btn ${closeButton.className}`} onClick={handleClose}>
            {closeButton.label}
          </button>
        )}
      </div>
    </>
  );
}
