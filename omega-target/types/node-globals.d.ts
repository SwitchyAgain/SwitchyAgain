declare var exports: Record<string, unknown>;
declare var module: {
  exports: unknown;
};

declare function require(id: './default_options'): () => Record<string, unknown>;
declare function require(id: 'buffer'): {
  Buffer: {
    new(value: string, encoding?: string): {
      toString(encoding?: string): string;
    };
  };
};
declare function require(id: string): unknown;
