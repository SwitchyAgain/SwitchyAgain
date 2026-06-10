(function() {
  function scheduleObjectUrlRevoke(url: string) {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadBlob(blob: Blob, filename: string) {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return;
    }
    const url = URL.createObjectURL(blob);
    if (typeof document !== 'undefined' && document.createElement) {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      (document.body || document.documentElement).appendChild(anchor);
      anchor.click();
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
      scheduleObjectUrlRevoke(url);
      return;
    }
    if (typeof browser !== 'undefined' && browser !== null && browser.downloads?.download != null) {
      const result = browser.downloads.download({
        url: url,
        filename: filename
      });
      return result.then((value) => {
        scheduleObjectUrlRevoke(url);
        return value;
      }, (error) => {
        scheduleObjectUrlRevoke(url);
        throw error;
      });
    }
    if (typeof chrome !== 'undefined' && chrome !== null && chrome.downloads?.download != null) {
      return chrome.downloads.download({
        url: url,
        filename: filename
      }, () => scheduleObjectUrlRevoke(url));
    }
    scheduleObjectUrlRevoke(url);
  }

  window.OmegaDebug = {
    getProjectVersion() {
      return chrome.runtime.getManifest().version;
    },
    getExtensionVersion() {
      return chrome.runtime.getManifest().version;
    },
    downloadLog() {
      const blob = new Blob([localStorage['log']], {
        type: "text/plain;charset=utf-8"
      });
      const filename = `OmegaLog_${Date.now()}.txt`;
      return downloadBlob(blob, filename);
    },
    resetOptions() {
      localStorage.clear();
      localStorage['omega.local.syncOptions'] = '"conflict"';
      chrome.storage.local.clear();
      return chrome.runtime.reload();
    },
    reportIssue() {
      const url = 'https://github.com/FelisCatus/SwitchyOmega/issues/new?title=&body=';
      let finalUrl = url;
      try {
        const projectVersion = OmegaDebug.getProjectVersion();
        const extensionVersion = OmegaDebug.getExtensionVersion();
        const env = {
          extensionVersion: extensionVersion,
          projectVersion: extensionVersion,
          userAgent: navigator.userAgent
        };
        let body = chrome.i18n.getMessage('popup_issueTemplate', [env.projectVersion, env.userAgent]);
        body || (body = `\n\n\n<!-- Please write your comment ABOVE this line. -->\nSwitchyOmega ${env.projectVersion}\n${env.userAgent}`);
        finalUrl = url + encodeURIComponent(body);
        const err = localStorage['logLastError'];
        if (err) {
          body += `\n\`\`\`\n${err}\n\`\`\``;
          finalUrl = (url + encodeURIComponent(body)).slice(0, 2000);
        }
      } catch (error) {}
      return chrome.tabs.create({
        url: finalUrl
      });
    }
  };

}).call(this);
