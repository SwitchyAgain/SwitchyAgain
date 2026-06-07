declare const __dirname: string;
declare const process: {
  argv: string[];
  exitCode?: number;
};

declare module 'archiver' {
  const value: any;
  export = value;
}

declare module 'esbuild' {
  const value: any;
  export = value;
}

declare module 'fs' {
  const value: any;
  export = value;
}

declare module 'fs/promises' {
  const value: any;
  export = value;
}

declare module 'path' {
  const value: any;
  export = value;
}

declare module 'po2json/index.js' {
  const value: any;
  export = value;
}
