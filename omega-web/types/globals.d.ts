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
  OmegaReactGeneralSettings?: {
    mount: (element: Element, props?: any) => {
      render: (props?: any) => void;
      unmount: () => void;
    };
  };
  OmegaReactBackupRestore?: {
    mount: (element: Element, props?: any) => () => void;
  };
}
