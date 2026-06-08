declare const process: {
  argv: string[];
  exitCode?: number;
};

declare module 'node:fs' {
  const value: any;
  export default value;
  export function createWriteStream(path: string): any;
}

declare module 'node:fs/promises' {
  const value: any;
  export default value;
  export function copyFile(src: string, dest: string): Promise<void>;
  export function mkdir(path: string, options?: any): Promise<void>;
  export function readFile(path: string, encoding: string): Promise<string>;
  export function readdir(path: string, options?: any): Promise<any[]>;
  export function rm(path: string, options?: any): Promise<void>;
  export function writeFile(path: string, data: string): Promise<void>;
}

declare module 'node:path' {
  const value: any;
  export default value;
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'archiver' {
  export class ZipArchive {
    constructor(options?: any);
    file(file: string, options: any): void;
    finalize(): void;
    on(event: string, listener: (...args: any[]) => void): void;
    pipe(output: any): void;
  }
}

declare module 'esbuild' {
  const value: any;
  export default value;
  export function build(options: any): Promise<void>;
}
