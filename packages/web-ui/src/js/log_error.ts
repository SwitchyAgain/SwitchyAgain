(function () {
  window.onerror = (message, url, line, col, err) => {
    if (typeof localStorage === 'undefined') {
      console.error(err || `${url}:${line}:${col}: ${message}`);
      return;
    }
    let log = localStorage['log'] || '';
    const stack = err instanceof Error ? err.stack : undefined;
    if (stack) {
      log += stack + '\n\n';
    } else {
      log += `${url}:${line}:${col}:\t${message}\n\n`;
    }
    localStorage['log'] = log;
  };
}).call(this);
