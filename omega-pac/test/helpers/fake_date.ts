export type FakeDateClock = {
  setSystemTime(time: number): void;
  uninstall(): void;
};

export function useFakeDate(initialTime: number): FakeDateClock {
  const NativeDate = Date;
  let currentTime = initialTime;
  const FakeDate = function(this: any, ...args: any[]): Date | string {
    if (!(this instanceof FakeDate)) {
      return new NativeDate(currentTime).toString();
    }
    if (args.length === 0) {
      return new NativeDate(currentTime);
    }
    return new (NativeDate as any)(...args);
  } as any;
  FakeDate.UTC = NativeDate.UTC;
  FakeDate.parse = NativeDate.parse;
  FakeDate.now = function(): number {
    return currentTime;
  };
  FakeDate.prototype = NativeDate.prototype;
  globalThis.Date = FakeDate;
  return {
    setSystemTime(time: number): void {
      currentTime = time;
    },
    uninstall(): void {
      globalThis.Date = NativeDate;
    }
  };
}
