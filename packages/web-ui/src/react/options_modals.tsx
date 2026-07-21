import {message} from './i18n_client';

export type WelcomeModalProps = {
  onClose?: (result: string) => void;
  onDismiss?: () => void;
  upgrade?: boolean;
};

export function WelcomeModal({onClose, onDismiss, upgrade = false}: WelcomeModalProps) {
  return (
    <>
      <div className="modal-header">
        <button type="button" className="close" onClick={onDismiss}>
          <span aria-hidden="true">{'\u00d7'}</span>
          <span className="sr-only">{message('dialog_close', 'Close')}</span>
        </button>
        <h4 className="modal-title">{message('options_modalHeader_welcome', 'Welcome to SwitchyAgain')}</h4>
      </div>
      <div className="modal-body">
        {upgrade ? (
          <>
            <p>
              {message(
                'options_welcomeUpgrade',
                "You have successfully upgraded to SwitchyAgain. Don't panic, your existing options are fully preserved."
              )}
            </p>
            <p>{message('options_welcomeUpgradeGuide', "Now let's go through a quick guide of the new options page.")}</p>
          </>
        ) : (
          <>
            <p>{message('options_welcomeNormal', 'You have successfully installed SwitchyAgain, the ultimate proxy switcher.')}</p>
            <p>
              {message(
                'options_welcomeNormalGuide',
                "Please tell SwitchyAgain about your proxies through the options page. Let's see how."
              )}
            </p>
          </>
        )}
      </div>
      <div className="modal-footer welcome-modal-footer">
        <button type="button" className="btn btn-default" onClick={() => onClose?.('skip')}>
          {message('options_guideSkip', 'Skip guide')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onClose?.('show')}>
          {message('options_guideNext', 'Next')}
        </button>
      </div>
    </>
  );
}
