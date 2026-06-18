import React, {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {loadOptions, manifestVersion, message, shouldAutoMount} from './options_client';

export type AboutProps = {
  embedded?: boolean;
  isExperimental?: boolean;
  version?: string;
  onDownloadLog?: () => void;
  onResetOptions?: () => void;
};

function messageWithNodes(key: string, fallback: string, nodes: Record<string, React.ReactNode>) {
  const text = message(key, fallback);
  const tokens = Object.keys(nodes);
  if (!tokens.length) {
    return text;
  }
  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text
    .split(pattern)
    .map((part, index) => (nodes[part] ? <React.Fragment key={`${part}-${index}`}>{nodes[part]}</React.Fragment> : part));
}

export function About({embedded = false, isExperimental = false, version, onDownloadLog, onResetOptions}: AboutProps) {
  useEffect(() => {
    if (embedded) {
      return;
    }
    loadOptions().catch(() => {});
  }, [embedded]);

  const shownVersion = version || manifestVersion();
  const iconPath = embedded ? 'img/icons/omega-32.png' : '../img/icons/omega-32.png';
  const content = (
    <>
      {isExperimental && (
        <section className="omega-experimental">
          <p className="alert alert-warning">
            <span className="glyphicon glyphicon-warning-sign" />{' '}
            <span>
              {message(
                'about_experimental_warning_moz',
                'Mozilla Firefox support is highly experimental! If you encounter issues, please report using the buttons below.'
              )}
            </span>
          </p>
        </section>
      )}

      <section>
        <div className="media" style={{margin: '1em 0'}}>
          <div className="media-left">
            <img className="media-object" src={iconPath} />
          </div>
          <div className="media-body">
            <h4 className="media-heading">{message('appNameShort', 'SwitchyAgain')}</h4>
            <p>{message('about_app_description', 'A proxy configuration tool')}</p>
          </div>
        </div>
      </section>

      {(onDownloadLog || onResetOptions) && (
        <section>
          <p>
            {onDownloadLog && (
              <>
                <button type="button" className="btn btn-default" onClick={onDownloadLog}>
                  <span className="glyphicon glyphicon-download" /> {message('popup_errorLog', 'Error log')}
                </button>{' '}
              </>
            )}
            {onResetOptions && (
              <button type="button" className="btn btn-danger" onClick={onResetOptions}>
                <span className="glyphicon glyphicon-alert" /> {message('options_reset', 'Reset')}
              </button>
            )}
          </p>
        </section>
      )}

      <section>
        <p>
          {message('about_version', `Version ${shownVersion}`, shownVersion)}
          <br />
          <a href="https://github.com/SwitchyAgain/SwitchyAgain">{message('about_projectHomepage', 'Project homepage')}</a>
          <br />
          <br />
          {messageWithNodes('about_basedOnSwitchyOmega', 'Based on SwitchyOmega, Copyright 2012-2017 __SWITCHYOMEGA_AUTHORS__.', {
            __SWITCHYOMEGA_AUTHORS__: <a href="https://github.com/FelisCatus/SwitchyOmega/blob/master/AUTHORS">The SwitchyOmega Authors</a>
          })}
          <br />
          {messageWithNodes('about_switchyagainChangesCopyright', 'SwitchyAgain changes Copyright 2026 __SWITCHYAGAIN_AUTHORS__.', {
            __SWITCHYAGAIN_AUTHORS__: <a href="https://github.com/SwitchyAgain/SwitchyAgain/graphs/contributors">The SwitchyAgain Authors</a>
          })}
          <br />
          {messageWithNodes('about_licenseLine', 'Licensed under the __GPL_LICENSE__ Version 3 or later.', {
            __GPL_LICENSE__: <a href="https://www.gnu.org/licenses/gpl.html">GNU General Public License</a>
          })}
        </p>
      </section>
    </>
  );

  if (embedded) {
    return (
      <>
        <div className="page-header">
          <h2>{message('about_title', 'About')}</h2>
        </div>
        {content}
      </>
    );
  }

  return (
    <main className="container-fluid react-options">
      <div className="page-header">
        <h2>{message('about_title', 'About')}</h2>
      </div>
      {content}
    </main>
  );
}

export function mount(element: Element, props: AboutProps = {}) {
  const root = createRoot(element);
  root.render(<About {...props} />);
  return {
    render(nextProps: AboutProps = {}) {
      root.render(<About {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const rootElement = document.getElementById('react-root');

if (rootElement && shouldAutoMount('about.js')) {
  mount(rootElement);
}
