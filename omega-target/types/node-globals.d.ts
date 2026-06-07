declare var exports: Record<string, unknown>;
declare var module: {
  exports: unknown;
};
declare var OmegaPac: unknown;

declare function require(id: string): unknown;

declare module 'bluebird' {
  const value: unknown;
  export default value;
}

declare module 'buffer' {
  export const Buffer: {
    from(value: string, encoding?: string): {
      toString(encoding?: string): string;
    };
  };
}

declare module 'jsondiffpatch' {
  const value: unknown;
  export default value;
}

declare module 'limiter' {
  const value: unknown;
  export default value;
}

declare module 'omega-pac' {
  const value: unknown;
  export default value;
}
