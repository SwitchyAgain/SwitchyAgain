namespace OmegaSwitchProfileExport {
  function safeProfileFileName(profileName: string) {
    return profileName.replace(/\W+/g, '_');
  }

  function createTextBlob(text: string) {
    return new Blob([text], {
      type: "text/plain;charset=utf-8"
    });
  }

  export function createExportRuleListAction(scope: any, trFilter: (key: string, args?: any[]) => string, downloadFile: (blob: Blob, fileName: string) => void) {
    return function() {
      var blob, fileName, text;
      text = OmegaSwitchProfileRules.composeOmegaRuleList(scope.profile.rules, scope.attachedOptions.defaultProfileName, trFilter('ruleList_usageUrl'), new Date().toLocaleDateString());
      blob = createTextBlob(text);
      fileName = safeProfileFileName(scope.profile.name);
      return downloadFile(blob, "OmegaRules_" + fileName + ".sorl");
    };
  }

  export function createExportLegacyRuleListAction(scope: any, trFilter: (key: string, args?: any[]) => string, downloadFile: (blob: Blob, fileName: string) => void) {
    return function() {
      var blob, fileName, text;
      text = OmegaSwitchProfileRules.composeLegacyRuleList(scope.profile.rules, scope.attachedOptions.defaultProfileName, trFilter('ruleList_usageUrl'), new Date().toLocaleDateString());
      blob = createTextBlob(text);
      fileName = safeProfileFileName(scope.profile.name);
      return downloadFile(blob, "SwitchyRules_" + fileName + ".ssrl");
    };
  }
}
