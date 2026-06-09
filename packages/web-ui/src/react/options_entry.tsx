import {mountOptionsApp} from './options_app';

const rootElement = document.getElementById('react-root');

if (!rootElement) {
  throw new Error('Missing React root element.');
}

mountOptionsApp(rootElement);
