type OmegaPacPreloadGlobal = {
  UglifyJS_NoUnsafeEval?: boolean;
};

(function(global: OmegaPacPreloadGlobal) {
  global.UglifyJS_NoUnsafeEval = true;
})((typeof window !== 'undefined' ? window : this) as unknown as OmegaPacPreloadGlobal);
