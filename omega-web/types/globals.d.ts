declare var $script: any;
declare var $: any;
declare var angular: any;
declare var browser: any;
declare var chrome: any;
declare var jQuery: any;
declare var jsondiffpatch: any;
declare var OmegaPac: any;
declare var saveAs: any;
declare var Shepherd: any;

interface Window {
  OmegaReactAbout?: {
    mount: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
  };
  OmegaReactConfirmModal?: {
    mount: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
  };
  OmegaReactProfileModals?: {
    mountNewProfile: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
    mountProxyAuth: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
    mountRenameProfile: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
  };
  OmegaReactProfileContent?: {
    mountUnsupportedProfile: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
    mountVirtualProfile: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
    mountSwitchProfile: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
    mountSwitchProfileStateful: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
  };
  OmegaReactOptionsModals?: {
    mountWelcome: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
  };
  OmegaReactUiSettings?: {
    mount: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
  };
  OmegaReactGeneralSettings?: {
    mount: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
  };
  OmegaReactImportExport?: {
    mount: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
  };
  OmegaReactOptionsApp?: {
    mountOptionsApp: (element: Element) => {
      render: () => void;
      unmount: () => void;
    };
  };
  OmegaReactSwitchProfileRuntime?: any;
}
