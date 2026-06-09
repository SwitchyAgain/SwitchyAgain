import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {closePopup, popupMessage, popupTarget} from './popup_target';

function ProxyNotControllableDialog() {
  const [mainText, setMainText] = useState('');
  const [detailsText, setDetailsText] = useState('');

  useEffect(() => {
    popupTarget().getState?.(['proxyNotControllable'], (_error, state) => {
      const reason = state?.proxyNotControllable || '';
      setMainText(popupMessage(`popup_proxyNotControllable_${reason}`));
      setDetailsText(
        popupMessage(`popup_proxyNotControllableDetails_${reason}`) ||
        popupMessage('popup_proxyNotControllableDetails')
      );
    });
  }, []);

  return (
    <div className="om-dialog">
      <p className="om-text-danger" id="js-nc-text">{mainText}</p>
      <p className="om-dialog-help" id="js-nc-details">{detailsText}</p>
      <p className="om-dialog-controls">
        <button id="js-close" className="om-btn om-btn-default" type="button" onClick={closePopup}>
          {popupMessage('dialog_cancel')}
        </button>
        <button
          id="js-nc-learn-more"
          className="om-btn om-btn-link"
          type="button"
          onClick={() => popupTarget().openOptions?.('#!/general', closePopup)}
        >
          Learn More
        </button>
        <button
          id="js-manage-ext"
          className="om-btn om-btn-primary"
          type="button"
          onClick={() => popupTarget().openManage?.(closePopup)}
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
