import React from 'react';
import {createRoot} from 'react-dom/client';
import {Options, message} from './options_client';

type ConfirmKind =
  | 'apply'
  | 'cannotDeleteProfile'
  | 'deleteAttached'
  | 'deleteProfile'
  | 'reset'
  | 'ruleRemove'
  | 'ruleReset';

type Profile = {
  color?: string;
  name?: string;
  profileType?: string;
};

type Rule = {
  condition?: {
    conditionType?: string;
    pattern?: string;
  };
};

type ConfirmModalProps = {
  attached?: any;
  dispName?: (profile: Profile) => string;
  kind: ConfirmKind;
  onClose?: () => void;
  onDismiss?: () => void;
  options?: Options | null;
  profile?: Profile | null;
  refs?: Profile[];
  rule?: Rule | null;
  ruleProfile?: Profile | null;
};

const PROFILE_ICONS: Record<string, string> = {
  AutoDetectProfile: 'glyphicon-file',
  DirectProfile: 'glyphicon-transfer',
  FixedProfile: 'glyphicon-globe',
  PacProfile: 'glyphicon-file',
  RuleListProfile: 'glyphicon-list',
  SwitchProfile: 'glyphicon-retweet',
  SystemProfile: 'glyphicon-off',
  VirtualProfile: 'glyphicon-question-sign'
};

function profileName(profile?: Profile | null, dispName?: (profile: Profile) => string) {
  if (!profile) {
    return '';
  }
  return dispName ? dispName(profile) : profile.name;
}

function ProfileIcon({profile}: {profile?: Profile | null}) {
  const icon = PROFILE_ICONS[profile?.profileType || ''] || 'glyphicon-question-sign';
  return (
    <span className={`glyphicon ${icon}`} style={{color: profile?.color}} />
  );
}

function ProfileInline({profile, dispName}: {profile?: Profile | null; dispName?: (profile: Profile) => string}) {
  return (
    <span className="profile-inline">
      <ProfileIcon profile={profile} /> {profileName(profile, dispName)}
    </span>
  );
}

function attachedLabel(attached: any) {
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
    case 'ruleRemove':
      return message('options_modalHeader_deleteRule', 'Delete Rule');
    case 'ruleReset':
      return message('options_modalHeader_resetRules', 'Reset Rules');
  }
}

function bodyFor(props: ConfirmModalProps) {
  const {attached, dispName, kind, profile, refs = [], rule, ruleProfile} = props;
  switch (kind) {
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
              {refs.map((refProfile, index) => (
                <li key={`${refProfile.name || 'profile'}-${index}`}>
                  <ProfileInline profile={refProfile} dispName={dispName} />
                </li>
              ))}
            </ul>
          </div>
          <p>{message('options_modifyReferringProfiles', 'You must modify these profiles and make them stop referring to this profile before you can delete it.')}</p>
        </>
      );
    case 'deleteAttached':
      return (
        <>
          <p>{message('options_deleteAttachedConfirm', 'Do you really want to remove the rule list from the current profile?')}</p>
          <div className="well">
            <ProfileIcon profile={attached} /> {attachedLabel(attached)}
          </div>
        </>
      );
    case 'deleteProfile':
      return (
        <>
          <p>{message('options_deleteProfileConfirm', 'Do you really want to delete the following profile?')}</p>
          <div className="well">
            <ProfileInline profile={profile} dispName={dispName} />
          </div>
        </>
      );
    case 'reset':
      return <p className="text-danger">{message('options_resetOptionsConfirm', 'Do you really want to reset the options? All profiles and settings will be LOST!')}</p>;
    case 'ruleRemove':
      return (
        <>
          <p>{message('options_deleteRuleConfirm', 'Do you really want to delete the following rule?')}</p>
          <div className="well">
            <span className="label label-info">{message(`condition_${rule?.condition?.conditionType}`, rule?.condition?.conditionType || '')}</span>{' '}
            {rule?.condition?.pattern}
            <span className="pull-right">
              <ProfileInline profile={ruleProfile} dispName={dispName} />
            </span>
          </div>
        </>
      );
    case 'ruleReset':
      return (
        <>
          <p>{message('options_resetRulesConfirm', 'Are you sure to set the result profile of ALL rules to the following profile?')}</p>
          <div className="well">
            <ProfileInline profile={ruleProfile} dispName={dispName} />
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
  }
}

function ConfirmModal(props: ConfirmModalProps) {
  const {kind, onClose, onDismiss} = props;
  const closeButton = closeButtonFor(kind);
  return (
    <>
      <div className="modal-header">
        <button type="button" className="close" onClick={onDismiss}>
          <span aria-hidden="true">{'\u00d7'}</span>
          <span className="sr-only">{message('dialog_close', 'Close')}</span>
        </button>
        <h4 className="modal-title">{titleFor(kind)}</h4>
      </div>
      <div className="modal-body">
        {bodyFor(props)}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-default" onClick={onDismiss}>
          {message('dialog_cancel', 'Cancel')}
        </button>
        {closeButton && (
          <button type="button" className={`btn ${closeButton.className}`} onClick={onClose}>
            {closeButton.label}
          </button>
        )}
      </div>
    </>
  );
}

function mount(element: Element, props: ConfirmModalProps) {
  const root = createRoot(element);
  root.render(<ConfirmModal {...props} />);
  return {
    render(nextProps: ConfirmModalProps) {
      root.render(<ConfirmModal {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactConfirmModal = {
  mount
};
