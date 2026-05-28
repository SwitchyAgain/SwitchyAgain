/* @module omega-target/log */

function replacer(key: string, value: any): any {
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
  str(obj: any): string {
    if (typeof obj === 'object' && obj !== null) {
      if (obj.debugStr != null) {
        if (typeof obj.debugStr === 'function') {
          return obj.debugStr();
        }
        return obj.debugStr;
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
  func(name: string, args: IArguments | any[]): void {
    this.log(name, '(', [].slice.call(args), ')');
  },

  /**
   * Log a method call with target and arguments
   * @param {string} name The name of the method
   * @param {{}} self The target of the method call
   * @param {Array} args The arguments to the method call
   */
  method(name: string, self: any, args: IArguments | any[]): void {
    this.log(this.str(self), '<<', name, [].slice.call(args));
  }
};

module.exports = Log;

export {};
