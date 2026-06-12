export function parse(value: string) {
  try {
    const parsed = new globalThis.URL(value, 'http://switchyagain.invalid');
    return {
      hostname: parsed.hostname || null
    };
  } catch {
    return {
      hostname: null
    };
  }
}
