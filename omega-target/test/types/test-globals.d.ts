declare var before: (callback: () => unknown) => unknown;
declare var after: (callback: () => unknown) => unknown;
declare var describe: (name: string, callback: () => unknown) => unknown;
declare var it: (name: string, callback: (done?: () => void) => unknown) => unknown;

declare module 'bluebird' {
  const value: any;
  export default value;
}

declare module 'assert' {
  const value: {
    deepStrictEqual(actual: unknown, expected: unknown): void;
    strictEqual(actual: unknown, expected: unknown): void;
  };
  export default value;
}

declare module 'sinon' {
  const value: any;
  export default value;
}
