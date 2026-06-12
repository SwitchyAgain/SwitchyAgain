export function deprecate<T extends (...args: any[]) => unknown>(fn: T): T {
  return fn;
}
