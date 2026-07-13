import { access, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

function normalizeBasePath(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

const expectedBasePath = normalizeBasePath(process.argv[2] ?? '/the-current/');
const distributionRoot = resolve('dist');
const indexPath = resolve(distributionRoot, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
const references = Array.from(indexHtml.matchAll(/\b(?:href|src)="([^"]+)"/gu), (match) => match[1]);
const localReferences = references.filter((reference): reference is string =>
  reference !== undefined &&
  !reference.startsWith('#') &&
  !reference.startsWith('data:') &&
  !reference.startsWith('http://') &&
  !reference.startsWith('https://'),
);

if (localReferences.length === 0) {
  throw new Error('The production index does not contain any local asset references');
}

for (const reference of localReferences) {
  const pathname = new URL(reference, 'https://build.invalid').pathname;
  if (!pathname.startsWith(expectedBasePath)) {
    throw new Error(`Local build reference ${reference} does not use base path ${expectedBasePath}`);
  }

  const relativePath = decodeURIComponent(pathname.slice(expectedBasePath.length));
  const diskPath = resolve(distributionRoot, relativePath);
  if (diskPath !== distributionRoot && !diskPath.startsWith(`${distributionRoot}${sep}`)) {
    throw new Error(`Local build reference escapes dist: ${reference}`);
  }
  await access(diskPath);
}

await access(resolve(distributionRoot, 'data', 'signals.v1.json'));

console.log(
  `Verified ${localReferences.length} local build references and the offline signal fixture under ${expectedBasePath}`,
);
