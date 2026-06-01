import React from 'react';
import {createRoot} from 'react-dom/client';

declare const chrome: {
  runtime?: {
    getManifest?: () => {version?: string};
  };
};

function getRuntimeInfo() {
  const manifest = chrome?.runtime?.getManifest?.();
  return {
    version: manifest?.version || 'unknown',
    runtimeAvailable: Boolean(chrome?.runtime)
  };
}

function OptionsExperiment() {
  const runtimeInfo = getRuntimeInfo();
  return (
    <main className="react-preview">
      <header>
        <span className="react-preview__label">SwitchyAgain</span>
        <h1>Options preview</h1>
      </header>
      <section>
        <p>React entry loaded inside the extension package.</p>
        <dl>
          <dt>Runtime</dt>
          <dd>{runtimeInfo.runtimeAvailable ? 'available' : 'unavailable'}</dd>
          <dt>Manifest version</dt>
          <dd>{runtimeInfo.version}</dd>
        </dl>
        <p className="react-preview__links">
          <a className="btn btn-default" href="ui.html">Interface</a>{' '}
          <a className="btn btn-default" href="general.html">General</a>{' '}
          <a className="btn btn-default" href="backup_restore.html">Backup / Restore</a>
        </p>
      </section>
    </main>
  );
}

const rootElement = document.getElementById('react-root');

if (!rootElement) {
  throw new Error('Missing React root element.');
}

createRoot(rootElement).render(<OptionsExperiment />);
