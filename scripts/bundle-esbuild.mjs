import * as esbuild from 'esbuild';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const index = arg.indexOf('=');
  if (index < 0) {
    return [arg, ''];
  }
  return [arg.slice(0, index), arg.slice(index + 1)];
}));

const entry = args['--entry'];
const outfile = args['--outfile'];
const format = args['--format'] || 'iife';
const globalName = args['--global-name'];
const platform = args['--platform'] || 'browser';
const target = args['--target'] || 'es2022';
const external = args['--external'] ? args['--external'].split(',').filter(Boolean) : [];
const alias = Object.fromEntries((args['--alias'] || '').split(',').filter(Boolean).map((mapping) => {
  const index = mapping.indexOf('=');
  if (index < 1 || index === mapping.length - 1) {
    throw new Error(`Invalid alias mapping: ${mapping}`);
  }
  return [mapping.slice(0, index), mapping.slice(index + 1)];
}));

if (!entry || !outfile || (format === 'iife' && !globalName)) {
  throw new Error('Usage: node scripts/bundle-esbuild.mjs --entry=<file> --outfile=<file> [--format=cjs|iife] [--global-name=<name>] [--platform=browser|node] [--target=es2022] [--external=a,b] [--alias=a=b,c=d] [--minify]');
}

await esbuild.build({
  absWorkingDir: process.cwd(),
  alias,
  bundle: true,
  define: platform === 'browser' ? {global: 'globalThis'} : {},
  entryPoints: [path.resolve(entry)],
  external,
  format,
  globalName,
  legalComments: 'eof',
  minify: '--minify' in args,
  outfile: path.resolve(outfile),
  platform,
  target
});
