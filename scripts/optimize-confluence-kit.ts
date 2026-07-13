import { execFile } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const input = resolve('assets/generated/confluence-world-kit.raw.glb');
const output = resolve('assets/runtime/confluence-world-kit.glb');
const binary = resolve('node_modules/@gltf-transform/cli/bin/cli.js');

await access(input);
await access(binary);
await mkdir(resolve('assets/runtime'), { recursive: true });

const { stderr, stdout } = await execFileAsync(process.execPath, [binary,
  'optimize', input, output,
  '--compress', 'meshopt',
  '--flatten', 'false',
  '--join', 'false',
  '--instance', 'false',
  '--simplify', 'true',
  '--simplify-ratio', '0.65',
  '--simplify-error', '0.001',
  '--palette', 'false',
  '--texture-compress', 'false',
], { maxBuffer: 8 * 1024 * 1024 });

if (stdout.trim() !== '') process.stdout.write(stdout);
if (stderr.trim() !== '') process.stderr.write(stderr);
