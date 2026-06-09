declare module 'buffer' {
  export const Buffer: {
    from(value: string, encoding?: string): {
      toString(encoding?: string): string;
    };
  };
}

declare module 'tldjs' {
  const value: {
    getDomain(domain: string): string | null;
  };
  export default value;
}
