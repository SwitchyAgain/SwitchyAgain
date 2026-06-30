import assert from 'assert';

type CallRecord = {
  args: any[];
  thisArg: any;
};

export type TestDouble = ((...args: any[]) => any) & {
  callCount: number;
  calls: CallRecord[];
  restore?: () => void;
};

export function createSpy(impl?: (this: any, ...args: any[]) => any): TestDouble {
  const spy = function (this: any, ...args: any[]): any {
    spy.calls.push({
      args,
      thisArg: this
    });
    spy.callCount = spy.calls.length;
    if (impl) {
      return impl.apply(this, args);
    }
  } as TestDouble;
  spy.callCount = 0;
  spy.calls = [];
  return spy;
}

export function spyOn(obj: any, method: string): TestDouble {
  const original = obj[method];
  const spy = createSpy(function (this: any, ...args: any[]): any {
    return original.apply(this, args);
  });
  spy.restore = function (): void {
    obj[method] = original;
  };
  obj[method] = spy;
  return spy;
}

export function stubOn(obj: any, method: string, impl?: (this: any, ...args: any[]) => any): TestDouble {
  const original = obj[method];
  const stub = createSpy(impl);
  stub.restore = function (): void {
    obj[method] = original;
  };
  obj[method] = stub;
  return stub;
}

export function stubReturns(value: any): TestDouble {
  return createSpy(function (): any {
    return value;
  });
}

export function assertCallCount(spy: TestDouble, expected: number): void {
  assert.strictEqual(spy.callCount, expected);
}

export function assertCalledOnce(spy: TestDouble): void {
  assertCallCount(spy, 1);
}

export function assertCalledTwice(spy: TestDouble): void {
  assertCallCount(spy, 2);
}

export function assertCalledWith(spy: TestDouble, ...expectedArgs: any[]): void {
  const found = spy.calls.some(function (call) {
    if (call.args.length < expectedArgs.length) {
      return false;
    }
    for (let i = 0; i < expectedArgs.length; i++) {
      try {
        assert.deepStrictEqual(call.args[i], expectedArgs[i]);
      } catch (error) {
        return false;
      }
    }
    return true;
  });
  if (!found) {
    assert.fail('Expected function to be called with ' + JSON.stringify(expectedArgs));
  }
}
