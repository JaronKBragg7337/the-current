import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  createEonetAdapter,
  createHackerNewsAdapter,
  createOpenMeteoAdapter,
  createSwpcAdapter,
  createUsgsAdapter,
} from '../src/data/adapters';
import type { InformationAdapter } from '../src/data/adapters';
import { createOfflineSnapshot } from '../src/data/fixtures/offline';
import { collectSignalSnapshot } from '../src/data/pipeline';
import { parseSnapshot } from '../src/data/schema';
import type { CausalSignal, SignalSnapshot } from '../src/data/schema';

interface WeatherLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly id?: string;
}

interface CliOptions {
  readonly live: boolean;
  readonly outputPath: string;
  readonly previousPath?: string;
  readonly weatherLocations: readonly WeatherLocation[];
  readonly help: boolean;
}

function optionValue(argument: string, name: string): string | undefined {
  const prefix = `${name}=`;
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : undefined;
}

function parseWeatherLocation(value: string): WeatherLocation {
  const [latitudeText, longitudeText, id] = value.split(',', 3);
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(`Invalid --open-meteo location: ${value}`);
  }
  return {
    latitude,
    longitude,
    ...(id === undefined || id.trim() === '' ? {} : { id: id.trim() }),
  };
}

function parseArguments(arguments_: readonly string[]): CliOptions {
  let live = false;
  let outputPath = 'public/data/signals.v1.json';
  let previousPath: string | undefined;
  let help = false;
  const weatherLocations: WeatherLocation[] = [];

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (argument === '--live') {
      live = true;
    } else if (argument === '--offline') {
      live = false;
    } else if (argument === '--help' || argument === '-h') {
      help = true;
    } else if (argument === '--out' || argument === '--previous' || argument === '--open-meteo') {
      const value = arguments_[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === '--out') outputPath = value;
      if (argument === '--previous') previousPath = value;
      if (argument === '--open-meteo') {
        weatherLocations.push(parseWeatherLocation(value));
        live = true;
      }
    } else {
      const outputValue = optionValue(argument, '--out');
      const previousValue = optionValue(argument, '--previous');
      const weatherValue = optionValue(argument, '--open-meteo');
      if (outputValue !== undefined) {
        outputPath = outputValue;
      } else if (previousValue !== undefined) {
        previousPath = previousValue;
      } else if (weatherValue !== undefined) {
        weatherLocations.push(parseWeatherLocation(weatherValue));
        live = true;
      } else {
        throw new Error(`Unknown argument: ${argument}`);
      }
    }
  }

  return {
    live,
    outputPath,
    ...(previousPath === undefined ? {} : { previousPath }),
    weatherLocations,
    help,
  };
}

function printHelp(): void {
  console.info(`The Current external-signal ingestion

Usage:
  npm run data:ingest                         Write the deterministic offline fixture
  npm run data:ingest -- --live               Fetch credential-free live sources
  npm run data:ingest -- --live --out PATH    Choose the output snapshot
  npm run data:ingest -- --live --previous PATH
  npm run data:ingest -- --open-meteo LAT,LON[,ID]

Live mode fetches USGS, NASA EONET, NOAA SWPC, and Hacker News metadata.
Open-Meteo is opt-in because its hosted free API is non-commercial only.
Each request has a timeout, bounded response size, and deterministic retries.
The browser/simulation never invokes these adapters.`);
}

async function readPreviousSignals(path: string | undefined): Promise<readonly CausalSignal[]> {
  if (path === undefined) return [];
  const contents = await readFile(resolve(path), 'utf8');
  return parseSnapshot(JSON.parse(contents) as unknown).signals;
}

function liveAdapters(locations: readonly WeatherLocation[]): readonly InformationAdapter[] {
  return [
    createUsgsAdapter(),
    createEonetAdapter(),
    createSwpcAdapter(),
    createHackerNewsAdapter(),
    ...locations.map((location) =>
      createOpenMeteoAdapter({
        latitude: location.latitude,
        longitude: location.longitude,
        ...(location.id === undefined ? {} : { locationId: location.id }),
      }),
    ),
  ];
}

async function writeSnapshot(path: string, snapshot: SignalSnapshot): Promise<void> {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.info(
    `Wrote ${snapshot.observations.length} observations and ${snapshot.signals.length} signals to ${absolutePath}`,
  );
  for (const source of snapshot.sources) {
    console.info(
      `${source.adapter}: ${source.status} (${source.observationCount} observations)${source.error === undefined ? '' : ` — ${source.error}`}`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const snapshot = options.live
    ? await collectSignalSnapshot(liveAdapters(options.weatherLocations), {
        mode: 'live',
        previousSignals: await readPreviousSignals(options.previousPath),
      })
    : createOfflineSnapshot();
  await writeSnapshot(options.outputPath, snapshot);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
