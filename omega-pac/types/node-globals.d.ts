declare module 'buffer' {
  export const Buffer: {
    from(value: string, encoding?: string): {
      toString(encoding?: string): string;
    };
  };
}

declare module 'tldjs' {
  const value: any;
  export default value;
}

declare module 'url' {
  const value: {
    format(url: any): string;
    parse(url: string, parseQueryString?: boolean): any;
  };
  export default value;
}
