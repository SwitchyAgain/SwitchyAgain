import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const index = arg.indexOf('=');
  if (index < 0) {
    return [arg, ''];
  }
  return [arg.slice(0, index), arg.slice(index + 1)];
}));

const modulePath = args['--module'];
const outfile = args['--outfile'];
const exportName = args['--export'] || 'default';

if (!modulePath || !outfile) {
  throw new Error('Usage: node scripts/write-cjs-wrapper.mjs --module=<module> --outfile=<file> [--export=default|self]');
}

let source;
if (exportName === 'self') {
  source = `module.exports = require(${JSON.stringify(modulePath)});\n`;
} else {
  source = [
    `const mod = require(${JSON.stringify(modulePath)});`,
    `module.exports = mod && mod.__esModule ? mod[${JSON.stringify(exportName)}] : mod;`,
    ''
  ].join('\n');
}

await fs.mkdir(path.dirname(path.resolve(outfile)), {recursive: true});
await fs.writeFile(outfile, source);
