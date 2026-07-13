import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonObject = Record<string, unknown>;
type DirectType = 'runtime' | 'development';

interface ReviewedLicenseOverride {
  readonly license: string;
  readonly evidence: string;
}

interface InventoryEntry {
  readonly name: string;
  readonly version: string;
  readonly packagePath: string;
  readonly license: string;
  readonly licenseSource: 'package-lock' | 'reviewed-package-file';
  readonly direct: boolean;
  readonly directType: DirectType | null;
  readonly declaredVersion: string | null;
  readonly developmentOnly: boolean;
  readonly optional: boolean;
  readonly peer: boolean;
  readonly resolved: string;
  readonly integrity: string;
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const lockPath = resolve(repositoryRoot, 'package-lock.json');
const inventoryPath = resolve(repositoryRoot, 'docs/dependency-licenses.json');

// package-lock.json records no license field for this release, but its npm
// tarball contains an unmodified MIT LICENSE file. Unknown future omissions are
// rejected instead of being silently assigned a license.
const reviewedOverrides: Readonly<Record<string, ReviewedLicenseOverride>> = {
  'webgl-constants@1.1.1': {
    license: 'MIT',
    evidence:
      'LICENSE in the npm package tarball identified by package-lock integrity; copyright Tim van Scherpenzeel, 2019',
  },
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredObject(parent: JsonObject, key: string, label: string): JsonObject {
  const value = parent[key];
  if (!isObject(value)) {
    throw new Error(`${label}.${key} must be an object`);
  }
  return value;
}

function requiredString(parent: JsonObject, key: string, label: string): string {
  const value = parent[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }
  return value;
}

function optionalBoolean(parent: JsonObject, key: string): boolean {
  const value = parent[key];
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`${key} must be a boolean when present`);
  }
  return value;
}

function stringRecord(parent: JsonObject, key: string, label: string): Record<string, string> {
  const object = requiredObject(parent, key, label);
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(object)) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${label}.${key}.${name} must be a non-empty string`);
    }
    result[name] = value;
  }
  return result;
}

function packageNameFromPath(packagePath: string): string {
  const marker = 'node_modules/';
  const markerIndex = packagePath.lastIndexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Unsupported package-lock path: ${packagePath}`);
  }
  const name = packagePath.slice(markerIndex + marker.length);
  if (name.length === 0 || name.includes('/node_modules/')) {
    throw new Error(`Cannot derive package name from package-lock path: ${packagePath}`);
  }
  return name;
}

function directDependency(
  name: string,
  packagePath: string,
  runtime: Readonly<Record<string, string>>,
  development: Readonly<Record<string, string>>,
): { readonly type: DirectType; readonly declaredVersion: string } | undefined {
  if (packagePath !== `node_modules/${name}`) {
    return undefined;
  }
  const runtimeVersion = runtime[name];
  if (runtimeVersion !== undefined) {
    return { type: 'runtime', declaredVersion: runtimeVersion };
  }
  const developmentVersion = development[name];
  if (developmentVersion !== undefined) {
    return { type: 'development', declaredVersion: developmentVersion };
  }
  return undefined;
}

function sortedCountRecord(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

async function createInventory(): Promise<string> {
  const lockText = await readFile(lockPath, 'utf8');
  const parsed = JSON.parse(lockText) as unknown;
  if (!isObject(parsed)) {
    throw new Error('package-lock.json root must be an object');
  }

  const projectName = requiredString(parsed, 'name', 'package-lock');
  const projectVersion = requiredString(parsed, 'version', 'package-lock');
  const lockfileVersion = parsed.lockfileVersion;
  if (lockfileVersion !== 3) {
    throw new Error(`Expected package-lock v3, received ${String(lockfileVersion)}`);
  }

  const packages = requiredObject(parsed, 'packages', 'package-lock');
  const rootPackage = requiredObject(packages, '', 'package-lock.packages');
  const runtimeDependencies = stringRecord(rootPackage, 'dependencies', 'package-lock.packages[""]');
  const developmentDependencies = stringRecord(
    rootPackage,
    'devDependencies',
    'package-lock.packages[""]',
  );

  const entries: InventoryEntry[] = [];
  for (const [packagePath, rawMetadata] of Object.entries(packages)) {
    if (packagePath === '') {
      continue;
    }
    if (!isObject(rawMetadata)) {
      throw new Error(`package-lock.packages[${JSON.stringify(packagePath)}] must be an object`);
    }

    const name = packageNameFromPath(packagePath);
    const version = requiredString(rawMetadata, 'version', packagePath);
    const packageKey = `${name}@${version}`;
    const declaredLicense = rawMetadata.license;
    const override = reviewedOverrides[packageKey];
    let license: string;
    let licenseSource: InventoryEntry['licenseSource'];
    if (typeof declaredLicense === 'string' && declaredLicense.trim().length > 0) {
      license = declaredLicense;
      licenseSource = 'package-lock';
    } else if (override !== undefined) {
      license = override.license;
      licenseSource = 'reviewed-package-file';
    } else {
      throw new Error(
        `${packageKey} has no license in package-lock.json and no reviewed override; review its package license before regenerating`,
      );
    }

    const direct = directDependency(
      name,
      packagePath,
      runtimeDependencies,
      developmentDependencies,
    );
    if (direct !== undefined && direct.declaredVersion !== version) {
      throw new Error(
        `${name} declares ${direct.declaredVersion} but the top-level lock entry resolves to ${version}`,
      );
    }

    entries.push({
      name,
      version,
      packagePath,
      license,
      licenseSource,
      direct: direct !== undefined,
      directType: direct?.type ?? null,
      declaredVersion: direct?.declaredVersion ?? null,
      developmentOnly: optionalBoolean(rawMetadata, 'dev'),
      optional: optionalBoolean(rawMetadata, 'optional'),
      peer: optionalBoolean(rawMetadata, 'peer'),
      resolved: requiredString(rawMetadata, 'resolved', packagePath),
      integrity: requiredString(rawMetadata, 'integrity', packagePath),
    });
  }

  entries.sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.version.localeCompare(right.version) ||
      left.packagePath.localeCompare(right.packagePath),
  );

  const directRuntimeCount = entries.filter((entry) => entry.directType === 'runtime').length;
  const directDevelopmentCount = entries.filter((entry) => entry.directType === 'development').length;
  if (directRuntimeCount !== Object.keys(runtimeDependencies).length) {
    throw new Error('One or more direct runtime dependencies are missing from the top-level lock entries');
  }
  if (directDevelopmentCount !== Object.keys(developmentDependencies).length) {
    throw new Error('One or more direct development dependencies are missing from the top-level lock entries');
  }

  const inventory = {
    schemaVersion: 1,
    project: { name: projectName, version: projectVersion },
    source: {
      file: relative(repositoryRoot, lockPath).replaceAll('\\', '/'),
      lockfileVersion,
      sha256: createHash('sha256').update(lockText).digest('hex'),
    },
    summary: {
      packagePathCount: entries.length,
      uniquePackageVersionCount: new Set(entries.map((entry) => `${entry.name}@${entry.version}`)).size,
      directRuntimeCount,
      directDevelopmentCount,
      runtimeReachableCount: entries.filter((entry) => !entry.developmentOnly).length,
      developmentOnlyCount: entries.filter((entry) => entry.developmentOnly).length,
      optionalCount: entries.filter((entry) => entry.optional).length,
      reviewedOverrideCount: entries.filter(
        (entry) => entry.licenseSource === 'reviewed-package-file',
      ).length,
      licenseExpressionCounts: sortedCountRecord(entries.map((entry) => entry.license)),
    },
    reviewedOverrides: Object.entries(reviewedOverrides)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([packageName, override]) => ({ package: packageName, ...override })),
    packages: entries,
  };

  return `${JSON.stringify(inventory, null, 2)}\n`;
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? '--write';
  if (mode !== '--write' && mode !== '--check') {
    throw new Error('Usage: tsx scripts/dependency-licenses.ts [--write|--check]');
  }

  const expected = await createInventory();
  if (mode === '--write') {
    await writeFile(inventoryPath, expected, 'utf8');
    console.log(`Wrote ${relative(repositoryRoot, inventoryPath)} from package-lock.json.`);
    return;
  }

  let actual: string;
  try {
    actual = await readFile(inventoryPath, 'utf8');
  } catch {
    throw new Error(
      `${relative(repositoryRoot, inventoryPath)} is missing; run npm run licenses:generate`,
    );
  }
  if (actual !== expected) {
    throw new Error(
      `${relative(repositoryRoot, inventoryPath)} is stale; run npm run licenses:generate and commit the result`,
    );
  }
  console.log(
    `${relative(repositoryRoot, inventoryPath)} exactly matches package-lock.json and reviewed overrides.`,
  );
}

await main();
