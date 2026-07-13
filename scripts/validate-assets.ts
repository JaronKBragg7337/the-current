import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonObject = Record<string, unknown>;

interface ManifestValidation {
  readonly approvedLicenses: ReadonlySet<string>;
  readonly assetIds: ReadonlySet<string>;
  readonly assetCount: number;
  readonly runtimeFileCount: number;
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const manifestPath = resolve(repositoryRoot, 'assets/manifest.json');
const manifestSchemaPath = resolve(repositoryRoot, 'assets/manifest.schema.json');
const catalogPath = resolve(repositoryRoot, 'assets/source-catalog.json');
const catalogSchemaPath = resolve(repositoryRoot, 'assets/source-catalog.schema.json');
const errors: string[] = [];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const catalogDispositions = new Set(['preferred', 'supplemental', 'future-evaluation']);
const runtimeRoles = new Set([
  'model',
  'animation',
  'texture',
  'audio',
  'collision',
  'metadata',
  'other',
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function report(path: string, message: string): void {
  errors.push(`${path}: ${message}`);
}

function objectAt(parent: JsonObject, key: string, path: string): JsonObject | undefined {
  const value = parent[key];
  if (!isObject(value)) {
    report(`${path}.${key}`, 'must be an object');
    return undefined;
  }
  return value;
}

function arrayAt(parent: JsonObject, key: string, path: string): unknown[] | undefined {
  const value = parent[key];
  if (!Array.isArray(value)) {
    report(`${path}.${key}`, 'must be an array');
    return undefined;
  }
  return value;
}

function stringAt(parent: JsonObject, key: string, path: string): string | undefined {
  const value = parent[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    report(`${path}.${key}`, 'must be a non-empty string');
    return undefined;
  }
  return value;
}

function numberAt(parent: JsonObject, key: string, path: string): number | undefined {
  const value = parent[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    report(`${path}.${key}`, 'must be a finite number');
    return undefined;
  }
  return value;
}

function booleanAt(parent: JsonObject, key: string, path: string): boolean | undefined {
  const value = parent[key];
  if (typeof value !== 'boolean') {
    report(`${path}.${key}`, 'must be a boolean');
    return undefined;
  }
  return value;
}

function stringArrayAt(
  parent: JsonObject,
  key: string,
  path: string,
  minimumItems: number,
): string[] | undefined {
  const values = arrayAt(parent, key, path);
  if (values === undefined) {
    return undefined;
  }
  if (values.length < minimumItems) {
    report(`${path}.${key}`, `must contain at least ${minimumItems} item(s)`);
  }
  const strings: string[] = [];
  values.forEach((value, index) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      report(`${path}.${key}[${index}]`, 'must be a non-empty string');
      return;
    }
    strings.push(value);
  });
  return strings;
}

function validateDate(value: string | undefined, path: string): void {
  if (value === undefined) {
    return;
  }
  if (!datePattern.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    report(path, 'must be a valid YYYY-MM-DD date');
  }
}

function validateHttpsUrl(value: string | undefined, path: string): void {
  if (value === undefined) {
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      report(path, 'must use HTTPS');
    }
  } catch {
    report(path, 'must be a valid absolute URL');
  }
}

function validateSha256(value: string | undefined, path: string): void {
  if (value !== undefined && !sha256Pattern.test(value)) {
    report(path, 'must be a lowercase 64-character SHA-256');
  }
}

function validateSlug(value: string | undefined, path: string): void {
  if (value !== undefined && !slugPattern.test(value)) {
    report(path, 'must be a lowercase kebab-case identifier');
  }
}

function resolveSafeRepositoryPath(value: string, path: string, prefix: string): string | undefined {
  if (value.includes('\\') || isAbsolute(value) || /^[A-Za-z]:/.test(value)) {
    report(path, 'must be a forward-slash repository-relative path');
    return undefined;
  }
  const normalized = posix.normalize(value);
  if (normalized !== value || normalized === '..' || normalized.startsWith('../')) {
    report(path, 'must not contain traversal or non-canonical segments');
    return undefined;
  }
  if (!normalized.startsWith(prefix)) {
    report(path, `must begin with ${prefix}`);
    return undefined;
  }
  return resolve(repositoryRoot, ...normalized.split('/'));
}

async function sha256File(path: string): Promise<string> {
  const data = await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}

async function readJson(path: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read ${label} at ${path}: ${message}`);
  }
}

async function validateExistingFile(
  repositoryPath: string,
  label: string,
  expectedBytes?: number,
  expectedSha256?: string,
): Promise<void> {
  try {
    const fileStats = await stat(repositoryPath);
    if (!fileStats.isFile()) {
      report(label, 'must resolve to a regular file');
      return;
    }
    if (expectedBytes !== undefined && fileStats.size !== expectedBytes) {
      report(label, `byte count is ${fileStats.size}, expected ${expectedBytes}`);
    }
    if (expectedSha256 !== undefined) {
      const actualSha256 = await sha256File(repositoryPath);
      if (actualSha256 !== expectedSha256) {
        report(label, `SHA-256 is ${actualSha256}, expected ${expectedSha256}`);
      }
    }
  } catch {
    report(label, 'file does not exist or cannot be read');
  }
}

function validateSchemaDocument(raw: unknown, path: string, expectedIdFragment: string): void {
  if (!isObject(raw)) {
    report(path, 'schema root must be an object');
    return;
  }
  const dialect = stringAt(raw, '$schema', path);
  if (dialect !== 'https://json-schema.org/draft/2020-12/schema') {
    report(`${path}.$schema`, 'must use JSON Schema draft 2020-12');
  }
  const id = stringAt(raw, '$id', path);
  validateHttpsUrl(id, `${path}.$id`);
  if (id !== undefined && !id.includes(expectedIdFragment)) {
    report(`${path}.$id`, `must identify ${expectedIdFragment}`);
  }
}

function validateCanonicalConventions(root: JsonObject): void {
  const path = 'manifest.canonicalConventions';
  const conventions = objectAt(root, 'canonicalConventions', 'manifest');
  if (conventions === undefined) {
    return;
  }
  const linearUnit = stringAt(conventions, 'linearUnit', path);
  if (linearUnit !== 'meter') {
    report(`${path}.linearUnit`, 'must equal meter');
  }
  const metersPerUnit = numberAt(conventions, 'metersPerUnit', path);
  if (metersPerUnit !== 1) {
    report(`${path}.metersPerUnit`, 'must equal 1');
  }
  const upAxis = stringAt(conventions, 'upAxis', path);
  if (upAxis !== '+Y') {
    report(`${path}.upAxis`, 'must equal +Y');
  }
  const forwardAxis = stringAt(conventions, 'forwardAxis', path);
  if (forwardAxis !== '-Z') {
    report(`${path}.forwardAxis`, 'must equal -Z');
  }
  const characterRoot = stringAt(conventions, 'characterRoot', path);
  if (characterRoot !== 'ground-between-feet') {
    report(`${path}.characterRoot`, 'must equal ground-between-feet');
  }
  stringAt(conventions, 'materialPolicy', path);
  stringAt(conventions, 'animationPolicy', path);
}

async function validateExternalAsset(
  raw: unknown,
  index: number,
  approvedLicenses: ReadonlySet<string>,
  assetIds: Set<string>,
  runtimePaths: Set<string>,
): Promise<number> {
  const path = `manifest.externalAssets[${index}]`;
  if (!isObject(raw)) {
    report(path, 'must be an object');
    return 0;
  }

  const id = stringAt(raw, 'id', path);
  validateSlug(id, `${path}.id`);
  if (id !== undefined) {
    if (assetIds.has(id)) {
      report(`${path}.id`, `duplicates asset id ${id}`);
    }
    assetIds.add(id);
  }
  stringAt(raw, 'name', path);
  stringAt(raw, 'creator', path);
  stringArrayAt(raw, 'selectedSourceFiles', path, 1);
  stringArrayAt(raw, 'modifications', path, 1);
  stringAt(raw, 'notes', path);

  const source = objectAt(raw, 'source', path);
  if (source !== undefined) {
    validateHttpsUrl(stringAt(source, 'homepageUrl', `${path}.source`), `${path}.source.homepageUrl`);
    validateHttpsUrl(stringAt(source, 'downloadUrl', `${path}.source`), `${path}.source.downloadUrl`);
  }

  let attributionRequired: boolean | undefined;
  const license = objectAt(raw, 'license', path);
  if (license !== undefined) {
    const spdxId = stringAt(license, 'spdxId', `${path}.license`);
    stringAt(license, 'name', `${path}.license`);
    validateHttpsUrl(stringAt(license, 'proofUrl', `${path}.license`), `${path}.license.proofUrl`);
    attributionRequired = booleanAt(license, 'attributionRequired', `${path}.license`);
    const redistributionAllowed = booleanAt(license, 'redistributionAllowed', `${path}.license`);
    if (redistributionAllowed !== true) {
      report(`${path}.license.redistributionAllowed`, 'must be true for a committed runtime asset');
    }
    stringArrayAt(license, 'restrictions', `${path}.license`, 0);
    if (spdxId !== undefined && !approvedLicenses.has(spdxId)) {
      report(`${path}.license.spdxId`, `${spdxId} is not in approvedRuntimeLicenses`);
    }

    const evidencePath = stringAt(license, 'localEvidenceFile', `${path}.license`);
    if (evidencePath !== undefined) {
      const fullEvidencePath = resolveSafeRepositoryPath(
        evidencePath,
        `${path}.license.localEvidenceFile`,
        'assets/licenses/',
      );
      if (fullEvidencePath !== undefined) {
        await validateExistingFile(fullEvidencePath, `${path}.license.localEvidenceFile`);
      }
    }
  }

  const attributionText = raw.attributionText;
  if (attributionText !== null && typeof attributionText !== 'string') {
    report(`${path}.attributionText`, 'must be a string or null');
  }
  if (attributionRequired === true && (typeof attributionText !== 'string' || attributionText.trim() === '')) {
    report(`${path}.attributionText`, 'must contain attribution text when attributionRequired is true');
  }

  const acquisition = objectAt(raw, 'acquisition', path);
  if (acquisition !== undefined) {
    validateDate(stringAt(acquisition, 'downloadedAt', `${path}.acquisition`), `${path}.acquisition.downloadedAt`);
    stringAt(acquisition, 'archiveFilename', `${path}.acquisition`);
    const archiveSha256 = stringAt(acquisition, 'archiveSha256', `${path}.acquisition`);
    validateSha256(archiveSha256, `${path}.acquisition.archiveSha256`);
    const archiveBytes = numberAt(acquisition, 'archiveBytes', `${path}.acquisition`);
    if (archiveBytes !== undefined && (!Number.isSafeInteger(archiveBytes) || archiveBytes < 1)) {
      report(`${path}.acquisition.archiveBytes`, 'must be a positive safe integer');
    }
    const cachePath = stringAt(acquisition, 'localCachePath', `${path}.acquisition`);
    if (cachePath !== undefined) {
      const fullCachePath = resolveSafeRepositoryPath(
        cachePath,
        `${path}.acquisition.localCachePath`,
        'assets/source-cache/',
      );
      if (fullCachePath !== undefined) {
        try {
          await stat(fullCachePath);
          await validateExistingFile(
            fullCachePath,
            `${path}.acquisition.localCachePath`,
            archiveBytes,
            archiveSha256,
          );
        } catch {
          // Source archives are deliberately local and optional. If present, the hash is enforced.
        }
      }
    }
  }

  const canonicalization = objectAt(raw, 'canonicalization', path);
  if (canonicalization !== undefined) {
    if (numberAt(canonicalization, 'metersPerUnit', `${path}.canonicalization`) !== 1) {
      report(`${path}.canonicalization.metersPerUnit`, 'must equal 1');
    }
    if (stringAt(canonicalization, 'upAxis', `${path}.canonicalization`) !== '+Y') {
      report(`${path}.canonicalization.upAxis`, 'must equal +Y');
    }
    if (stringAt(canonicalization, 'forwardAxis', `${path}.canonicalization`) !== '-Z') {
      report(`${path}.canonicalization.forwardAxis`, 'must equal -Z');
    }
    const rootPlacement = stringAt(canonicalization, 'rootPlacement', `${path}.canonicalization`);
    if (
      rootPlacement !== undefined &&
      rootPlacement !== 'ground-between-feet' &&
      rootPlacement !== 'object-origin' &&
      rootPlacement !== 'not-applicable'
    ) {
      report(`${path}.canonicalization.rootPlacement`, 'has an unsupported value');
    }
    stringAt(canonicalization, 'materialStrategy', `${path}.canonicalization`);
    stringAt(canonicalization, 'collisionStrategy', `${path}.canonicalization`);
    stringAt(canonicalization, 'lodStrategy', `${path}.canonicalization`);
  }

  const toolVersions = objectAt(raw, 'toolVersions', path);
  if (toolVersions !== undefined) {
    const entries = Object.entries(toolVersions);
    if (entries.length === 0) {
      report(`${path}.toolVersions`, 'must record at least one exact tool version');
    }
    entries.forEach(([tool, version]) => {
      if (tool.trim() === '' || typeof version !== 'string' || version.trim() === '') {
        report(`${path}.toolVersions.${tool}`, 'must be a non-empty version string');
      }
    });
  }

  const runtimeFiles = arrayAt(raw, 'runtimeFiles', path);
  if (runtimeFiles === undefined) {
    return 0;
  }
  if (runtimeFiles.length === 0) {
    report(`${path}.runtimeFiles`, 'must contain at least one redistributed runtime file');
  }

  for (const [runtimeIndex, runtimeRaw] of runtimeFiles.entries()) {
    const runtimePath = `${path}.runtimeFiles[${runtimeIndex}]`;
    if (!isObject(runtimeRaw)) {
      report(runtimePath, 'must be an object');
      continue;
    }
    const relativePath = stringAt(runtimeRaw, 'path', runtimePath);
    const expectedSha256 = stringAt(runtimeRaw, 'sha256', runtimePath);
    validateSha256(expectedSha256, `${runtimePath}.sha256`);
    const expectedBytes = numberAt(runtimeRaw, 'bytes', runtimePath);
    if (expectedBytes !== undefined && (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1)) {
      report(`${runtimePath}.bytes`, 'must be a positive safe integer');
    }
    const role = stringAt(runtimeRaw, 'role', runtimePath);
    if (role !== undefined && !runtimeRoles.has(role)) {
      report(`${runtimePath}.role`, `unsupported role ${role}`);
    }
    if (relativePath !== undefined) {
      if (runtimePaths.has(relativePath)) {
        report(`${runtimePath}.path`, `duplicates runtime path ${relativePath}`);
      }
      runtimePaths.add(relativePath);
      const fullRuntimePath = resolveSafeRepositoryPath(
        relativePath,
        `${runtimePath}.path`,
        'assets/runtime/',
      );
      if (fullRuntimePath !== undefined) {
        await validateExistingFile(fullRuntimePath, `${runtimePath}.path`, expectedBytes, expectedSha256);
      }
    }
  }
  return runtimeFiles.length;
}

async function validateManifest(raw: unknown): Promise<ManifestValidation> {
  if (!isObject(raw)) {
    report('manifest', 'root must be an object');
    return {
      approvedLicenses: new Set(),
      assetIds: new Set(),
      assetCount: 0,
      runtimeFileCount: 0,
    };
  }
  const schemaReference = stringAt(raw, '$schema', 'manifest');
  if (schemaReference !== './manifest.schema.json') {
    report('manifest.$schema', 'must equal ./manifest.schema.json');
  }
  if (numberAt(raw, 'schemaVersion', 'manifest') !== 1) {
    report('manifest.schemaVersion', 'must equal 1');
  }
  validateDate(stringAt(raw, 'lastReviewedAt', 'manifest'), 'manifest.lastReviewedAt');
  validateCanonicalConventions(raw);

  const approvedLicenseValues = stringArrayAt(raw, 'approvedRuntimeLicenses', 'manifest', 1) ?? [];
  const approvedLicenses = new Set(approvedLicenseValues);
  if (approvedLicenses.size !== approvedLicenseValues.length) {
    report('manifest.approvedRuntimeLicenses', 'must not contain duplicates');
  }

  const assets = arrayAt(raw, 'externalAssets', 'manifest') ?? [];
  const assetIds = new Set<string>();
  const runtimePaths = new Set<string>();
  let runtimeFileCount = 0;
  for (const [index, asset] of assets.entries()) {
    runtimeFileCount += await validateExternalAsset(
      asset,
      index,
      approvedLicenses,
      assetIds,
      runtimePaths,
    );
  }
  return {
    approvedLicenses,
    assetIds,
    assetCount: assets.length,
    runtimeFileCount,
  };
}

function validateCandidateLicense(
  candidate: JsonObject,
  path: string,
  approvedLicenses: ReadonlySet<string>,
): void {
  const license = objectAt(candidate, 'license', path);
  if (license === undefined) {
    return;
  }
  const spdxId = stringAt(license, 'spdxId', `${path}.license`);
  if (spdxId !== undefined && !approvedLicenses.has(spdxId)) {
    report(`${path}.license.spdxId`, `${spdxId} is not approved for a runtime candidate`);
  }
  validateHttpsUrl(stringAt(license, 'proofUrl', `${path}.license`), `${path}.license.proofUrl`);
  stringAt(license, 'scopeNotes', `${path}.license`);
}

function validateCatalog(
  raw: unknown,
  incorporatedAssetIds: ReadonlySet<string>,
  approvedLicenses: ReadonlySet<string>,
): number {
  if (!isObject(raw)) {
    report('sourceCatalog', 'root must be an object');
    return 0;
  }
  if (stringAt(raw, '$schema', 'sourceCatalog') !== './source-catalog.schema.json') {
    report('sourceCatalog.$schema', 'must equal ./source-catalog.schema.json');
  }
  if (numberAt(raw, 'catalogVersion', 'sourceCatalog') !== 1) {
    report('sourceCatalog.catalogVersion', 'must equal 1');
  }
  validateDate(stringAt(raw, 'lastReviewedAt', 'sourceCatalog'), 'sourceCatalog.lastReviewedAt');
  stringAt(raw, 'statusStatement', 'sourceCatalog');

  const candidates = arrayAt(raw, 'sources', 'sourceCatalog') ?? [];
  const candidateIds = new Set<string>();
  candidates.forEach((candidateRaw, index) => {
    const path = `sourceCatalog.sources[${index}]`;
    if (!isObject(candidateRaw)) {
      report(path, 'must be an object');
      return;
    }
    const id = stringAt(candidateRaw, 'id', path);
    validateSlug(id, `${path}.id`);
    if (id !== undefined) {
      if (candidateIds.has(id)) {
        report(`${path}.id`, `duplicates candidate id ${id}`);
      }
      if (incorporatedAssetIds.has(id)) {
        report(`${path}.id`, 'is already incorporated and must move out of the research catalog');
      }
      candidateIds.add(id);
    }
    stringAt(candidateRaw, 'name', path);
    stringAt(candidateRaw, 'creator', path);
    stringArrayAt(candidateRaw, 'categories', path, 1);
    stringArrayAt(candidateRaw, 'formats', path, 1);
    stringArrayAt(candidateRaw, 'constraints', path, 1);
    stringAt(candidateRaw, 'proposedUse', path);
    stringAt(candidateRaw, 'compatibilityNotes', path);

    const disposition = stringAt(candidateRaw, 'disposition', path);
    if (disposition !== undefined && !catalogDispositions.has(disposition)) {
      report(`${path}.disposition`, `unsupported disposition ${disposition}`);
    }
    if (stringAt(candidateRaw, 'status', path) !== 'candidate-not-downloaded') {
      report(`${path}.status`, 'must equal candidate-not-downloaded');
    }
    if (booleanAt(candidateRaw, 'incorporated', path) !== false) {
      report(`${path}.incorporated`, 'must be false for a research candidate');
    }
    validateHttpsUrl(stringAt(candidateRaw, 'homepageUrl', path), `${path}.homepageUrl`);
    validateHttpsUrl(stringAt(candidateRaw, 'acquisitionUrl', path), `${path}.acquisitionUrl`);
    validateCandidateLicense(candidateRaw, path, approvedLicenses);

    const listedSize = candidateRaw.listedArchiveSize;
    if (listedSize !== null && (typeof listedSize !== 'string' || listedSize.trim() === '')) {
      report(`${path}.listedArchiveSize`, 'must be a non-empty string or null');
    }
    if (candidateRaw.downloadedAt !== null) {
      report(`${path}.downloadedAt`, 'must be null until a source is acquired and moved to manifest.json');
    }
    if (candidateRaw.archiveSha256 !== null) {
      report(`${path}.archiveSha256`, 'must be null for a not-downloaded candidate');
    }
    const runtimeFiles = arrayAt(candidateRaw, 'runtimeFiles', path);
    if (runtimeFiles !== undefined && runtimeFiles.length !== 0) {
      report(`${path}.runtimeFiles`, 'must be empty for a not-incorporated candidate');
    }
  });
  return candidates.length;
}

async function main(): Promise<void> {
  const [manifestRaw, manifestSchemaRaw, catalogRaw, catalogSchemaRaw] = await Promise.all([
    readJson(manifestPath, 'asset manifest'),
    readJson(manifestSchemaPath, 'asset manifest schema'),
    readJson(catalogPath, 'asset source catalog'),
    readJson(catalogSchemaPath, 'asset source catalog schema'),
  ]);

  validateSchemaDocument(manifestSchemaRaw, 'manifestSchema', 'asset-manifest-v1');
  validateSchemaDocument(catalogSchemaRaw, 'catalogSchema', 'asset-source-catalog-v1');
  const manifest = await validateManifest(manifestRaw);
  const candidateCount = validateCatalog(
    catalogRaw,
    manifest.assetIds,
    manifest.approvedLicenses,
  );

  if (errors.length > 0) {
    console.error(`Asset validation failed with ${errors.length} error(s):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    [
      'Asset validation passed.',
      `${manifest.assetCount} incorporated external asset(s).`,
      `${manifest.runtimeFileCount} verified runtime file(s).`,
      `${candidateCount} not-downloaded research candidate(s).`,
    ].join(' '),
  );
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
