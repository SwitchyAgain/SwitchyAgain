declare const process: {
  exitCode?: number;
};

declare module 'node:fs/promises' {
  const value: any;
  export default value;
}

declare module 'node:path' {
  const value: any;
  export default value;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
