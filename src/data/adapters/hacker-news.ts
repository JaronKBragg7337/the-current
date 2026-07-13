import { fetchJson } from '../http';
import type { ExternalObservation } from '../schema';
import {
  DEFAULT_USER_AGENT,
  asRecord,
  createObservation,
  finiteNumber,
  hostnameFromUrl,
  nonEmptyString,
  timeliness,
  toIsoTimestamp,
} from './common';
import type { InformationAdapter } from './types';

const API_ROOT = 'https://hacker-news.firebaseio.com/v0';

export interface HackerNewsAdapterOptions {
  readonly maxItems?: number;
  readonly apiRoot?: string;
}

export function createHackerNewsAdapter(
  options: HackerNewsAdapterOptions = {},
): InformationAdapter {
  const apiRoot = options.apiRoot ?? API_ROOT;
  const maxItems = Math.max(1, Math.min(30, options.maxItems ?? 10));

  return {
    id: 'hacker-news-metadata',
    provider: 'Hacker News',
    async fetch(context): Promise<readonly ExternalObservation[]> {
      const request = context.request ?? fetchJson;
      const idsPayload = await request(`${apiRoot}/topstories.json`, {
        headers: { 'User-Agent': DEFAULT_USER_AGENT },
        ...(context.signal === undefined ? {} : { signal: context.signal }),
      });
      const ids = Array.isArray(idsPayload)
        ? idsPayload
            .map(finiteNumber)
            .filter((id): id is number => id !== undefined && Number.isInteger(id) && id > 0)
            .slice(0, maxItems)
        : [];
      const settledItems = await Promise.allSettled(
        ids.map(async (id) => ({
          id,
          value: await request(`${apiRoot}/item/${id}.json`, {
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
            ...(context.signal === undefined ? {} : { signal: context.signal }),
          }),
        })),
      );
      const ingestedAt = context.now.toISOString();

      return settledItems.flatMap((result, rank): readonly ExternalObservation[] => {
        if (result.status === 'rejected') {
          return [];
        }
        const item = asRecord(result.value.value);
        const itemId = finiteNumber(item?.id) ?? result.value.id;
        const itemType = nonEmptyString(item?.type) ?? 'story';
        const timestampSeconds = finiteNumber(item?.time);
        const observedAt =
          timestampSeconds === undefined ? undefined : toIsoTimestamp(timestampSeconds * 1_000);
        if (observedAt === undefined || item?.deleted === true || item?.dead === true) {
          return [];
        }

        const linkDomain = hostnameFromUrl(item?.url);
        const score = finiteNumber(item?.score) ?? 0;
        const commentCount = finiteNumber(item?.descendants) ?? 0;
        const upstreamUrl = `https://news.ycombinator.com/item?id=${itemId}`;

        return [
          createObservation({
            id: `obs:hacker-news:${itemId}`,
            observedAt,
            publishedAt: observedAt,
            ingestedAt,
            domain: 'technology',
            eventType: 'community-technology-attention',
            geography: { kind: 'global' },
            metrics: {
              itemId,
              rank: rank + 1,
              score,
              commentCount,
              itemType,
              ...(linkDomain === undefined ? {} : { linkDomain }),
            },
            evidence: {
              directness: 0.8,
              timeliness: timeliness(observedAt, ingestedAt, 24),
              officialSource: 0.8,
            },
            source: {
              adapter: 'hacker-news-metadata',
              provider: 'Hacker News',
              upstreamId: String(itemId),
              upstreamUrl,
              lineage: ['origin:hacker-news', `item:hacker-news:${itemId}`],
              attribution: {
                title: 'Hacker News API metadata',
                creator: 'Y Combinator / Hacker News',
                sourceUrl: `${apiRoot}/topstories.json`,
                license: 'No explicit data/content license published',
                licenseUrl: 'https://github.com/HackerNews/API',
                retrievedAt: ingestedAt,
                redistribution: 'metadata-only',
                notes: 'Adapter intentionally excludes titles, text, usernames, and comments; review current terms before broader redistribution.',
              },
            },
            tags: ['community-attention', 'technology', itemType],
          }),
        ];
      });
    },
  };
}
