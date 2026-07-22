import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {setUiLocale} from './i18n_client';
import {closePopup, getPopupState, openExtensionManager, openPopupOptions, popupMessage} from './popup_bridge';
import {applyUiTheme} from './ui_theme';

function ProxyNotControllableDialog() {
  const [mainText, setMainText] = useState('');
  const [detailsText, setDetailsText] = useState('');

  useEffect(() => {
    getPopupState(['proxyNotControllable', 'uiLocale', 'uiTheme'])
      .then((state) => {
        document.title = popupMessage('popup_title', 'SwitchyAgain Popup');
        applyUiTheme(state.uiTheme);
        const reason = state.proxyNotControllable || '';
        return setUiLocale(state.uiLocale).then(() => {
          document.title = popupMessage('popup_title', 'SwitchyAgain Popup');
          setMainText(popupMessage(`popup_proxyNotControllable_${reason}`));
          setDetailsText(popupMessage(`popup_proxyNotControllableDetails_${reason}`) || popupMessage('popup_proxyNotControllableDetails'));
        });
      })
      .catch((error: unknown) => setDetailsText(error instanceof Error ? error.message : String(error)));
  }, []);

  return (
    <div className="sa-popup-dialog">
      <p className="sa-popup-text-danger" id="js-nc-text">
        {mainText}
      </p>
      <p className="sa-popup-dialog-help" id="js-nc-details">
        {detailsText}
      </p>
      <p className="sa-popup-dialog-controls">
        <button id="js-close" className="sa-popup-btn sa-popup-btn-default" type="button" onClick={closePopup}>
          {popupMessage('dialog_cancel')}
        </button>
        <button
          id="js-nc-learn-more"
          className="sa-popup-btn sa-popup-btn-link"
          type="button"
          onClick={() => {
            openPopupOptions('#!/general')
              .then(closePopup)
              .catch((error: unknown) => setDetailsText(error instanceof Error ? error.message : String(error)));
          }}
        >
          Learn More
        </button>
        <button
          id="js-manage-ext"
          className="sa-popup-btn sa-popup-btn-primary"
          type="button"
          onClick={() => {
            openExtensionManager()
              .then(closePopup)
              .catch((error: unknown) => setDetailsText(error instanceof Error ? error.message : String(error)));
          }}
        >
          {popupMessage('popup_proxyNotControllableManage')}
        </button>
      </p>
    </div>
  );
}

const rootElement = document.getElementById('react-proxy-not-controllable-root');

if (rootElement) {
  createRoot(rootElement).render(<ProxyNotControllableDialog />);
}
