/* @module @switchyagain/extension-runtime/log */

type DebugPrintable = {
  debugStr?: string | (() => string);
};

function replacer(key: string, value: unknown): unknown {
  switch (key) {
    case 'username':
    case 'password':
    case 'host':
    case 'port':
      return '<secret>';
    default:
      return value;
  }
}

const Log = {
  /**
   * Pretty-print an object and return the result string.
   * @param {{}} obj The object to format
   * @returns {String} the formatted object in string
   */
  str(obj: unknown): string {
    if (typeof obj === 'object' && obj !== null) {
      const printable = obj as DebugPrintable;
      if (printable.debugStr != null) {
        if (typeof printable.debugStr === 'function') {
          return printable.debugStr();
        }
        return printable.debugStr;
      }
      if (obj instanceof Error) {
        return obj.stack || obj.message;
      }
      return JSON.stringify(obj, replacer, 4);
    }
    if (typeof obj === 'function') {
      if (obj.name) {
        return '<f: ' + obj.name + '>';
      }
      return obj.toString();
    }
    return '' + obj;
  },

  /**
   * Print something to the log.
   * @param {...{}} args The objects to log
   */
  log: console.log.bind(console),

  /**
   * Print something to the error log.
   * @param {...{}} args The objects to log
   */
  error: console.error.bind(console),

  /**
   * Log a function call with target and arguments
   * @param {string} name The name of the method
   * @param {Array} args The arguments to the method call
   */
  func(name: string, args: IArguments | unknown[]): void {
    this.log(name, '(', [].slice.call(args), ')');
  },

  /**
   * Log a method call with target and arguments
   * @param {string} name The name of the method
   * @param {{}} self The target of the method call
   * @param {Array} args The arguments to the method call
   */
  method(name: string, self: unknown, args: IArguments | unknown[]): void {
    this.log(this.str(self), '<<', name, [].slice.call(args));
  }
};

export default Log;
