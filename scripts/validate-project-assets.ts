import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

interface FileRecord {
  bytes: number;
  path: string;
  sha256: string;
}

interface ProjectAssetInventory {
  assets: Array<{
    externalInputs: unknown[];
    generator: FileRecord;
    id: string;
    origin: string;
    runtime: FileRecord;
    source: FileRecord;
  }>;
  schemaVersion: number;
}

const inventoryPath = resolve('assets/project-assets.json');
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as ProjectAssetInventory;
if (inventory.schemaVersion !== 1) throw new Error('project-assets.json schemaVersion must be 1');
if (!Array.isArray(inventory.assets) || inventory.assets.length === 0) throw new Error('project-assets.json must inventory at least one asset');

for (const asset of inventory.assets) {
  if (asset.origin !== 'project-authored') throw new Error(`${asset.id}: origin must be project-authored`);
  if (asset.externalInputs.length !== 0) throw new Error(`${asset.id}: external inputs belong in assets/manifest.json`);
  for (const file of [asset.source, asset.generator, asset.runtime]) {
    const path = resolve(file.path);
    const [contents, metadata] = await Promise.all([readFile(path), stat(path)]);
    const digest = createHash('sha256').update(contents).digest('hex');
    if (metadata.size !== file.bytes) throw new Error(`${asset.id}: byte count changed for ${file.path}`);
    if (digest !== file.sha256) throw new Error(`${asset.id}: SHA-256 changed for ${file.path}`);
  }
}

console.log(`Project asset inventory valid: ${inventory.assets.length} project-authored asset bundle(s).`);
