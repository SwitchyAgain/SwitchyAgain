declare var before: (callback: () => unknown) => unknown;
declare var after: (callback: () => unknown) => unknown;
declare var describe: (name: string, callback: () => unknown) => unknown;
declare var it: (name: string, callback: (done?: () => void) => unknown) => unknown;

declare module 'assert' {
  const value: {
    deepStrictEqual(actual: unknown, expected: unknown): void;
    equal(actual: unknown, expected: unknown): void;
    fail(message?: string): never;
    notEqual(actual: unknown, expected: unknown): void;
    notStrictEqual(actual: unknown, expected: unknown): void;
    ok(value: unknown): void;
    strictEqual(actual: unknown, expected: unknown): void;
    throws(block: () => unknown, error?: unknown): void;
  };
  export default value;
}

declare module 'sinon' {
  const value: any;
  export default value;
}
