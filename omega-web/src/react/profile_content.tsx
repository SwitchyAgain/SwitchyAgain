import React from 'react';
import {createRoot} from 'react-dom/client';
import {message} from './options_client';

type UnsupportedProfileProps = {
  profile?: {
    profileType?: string;
  } | null;
};

function UnsupportedProfile({profile}: UnsupportedProfileProps) {
  const profileType = profile?.profileType || '';
  return (
    <>
      <div className="lead">
        {message('options_profileUnsupported', `Unsupported profile type ${profileType}!`, profileType)}
      </div>
      <p>{message('options_profileUnsupportedHelp', 'The options could be broken, or from a newer version of this program.')}</p>
    </>
  );
}

function mountUnsupportedProfile(element: Element, props: UnsupportedProfileProps = {}) {
  const root = createRoot(element);
  root.render(<UnsupportedProfile {...props} />);
  return {
    render(nextProps: UnsupportedProfileProps = {}) {
      root.render(<UnsupportedProfile {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactProfileContent = {
  mountUnsupportedProfile
};
