# External information and data-source policy

Reviewed: **2026-07-13**. This inventory records official documentation, observed
operational behavior, reuse constraints, and the intended causal role of each
source. It is not legal advice; terms must be rechecked before production use.

The simulation has no live-network dependency. `public/data/signals.v1.json` is
a deterministic, project-authored CC0 fixture. A maintainer may run the server-side
ingestion CLI to create a live snapshot, review it, and then deploy that static
snapshot. Browser code never calls a third-party feed.

## Governing boundary

External information is evidence, not a world-edit command:

```text
bounded source observation
  -> provenance-aware deduplication and corroboration
  -> objective pressure + belief pressure
  -> confidence, novelty, duration, and exponential decay
  -> local NPC/institution interpretation
  -> ordinary decisions in the authoritative simulation
  -> production, consumption, prices, institutions, and physical consequences
```

An earthquake feed cannot directly destroy a building, and a popular technology
link cannot directly create a breakthrough. The former can raise local hazard and
logistics pressures; the latter can raise short-lived attention. A settlement's
knowledge, infrastructure, politics, inventory, and trust determine the response.

The immutable schemas are versioned as `observation.v1`, `causal-signal.v1`, and
`signal-snapshot.v1`. Every observation preserves provider, upstream identifier,
URL, retrieval time, license posture, and lineage. Every signal records:

- domain and geography;
- intensity, confidence, independent-source agreement, and novelty;
- expected duration and exponential half-life;
- separate signed objective and belief pressure vectors;
- all contributing observation IDs and lineage roots;
- a static normalization rationale and revision number.

No adapter stores article bodies, comments, usernames, images, or arbitrary raw
headlines. Requests are bounded by response size, use an eight-second default
timeout, and retry transient failures twice with deterministic backoff. Adapter
failures are isolated and recorded in the snapshot.

`toSimulationSignal()` is the explicit causal boundary. The simulation host must
provide the observation's world-day timestamp and any delayed effective day. The
bridge maps positive security/reliability values to the simulation's opposite
"problem pressure" convention, but it still only queues a `NormalizedSignal`;
normal NPC and institutional logic decides what happens next.

## Implemented credential-free adapters

| Adapter | Official endpoint/documentation | Data used | Reuse and operational notes |
| --- | --- | --- | --- |
| USGS earthquakes | [GeoJSON feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | Event ID, time, coordinate, depth, magnitude, significance, felt count, tsunami flag | USGS-authored data is generally a U.S. government work/public domain; credit USGS and retain its no-warranty context. See [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits). No key. |
| NASA EONET v3 | [EONET API v3](https://eonet.gsfc.nasa.gov/docs/v3) | Event/category IDs, geometry history count, latest geometry/time, magnitude metadata, upstream source IDs/URLs | NASA material is generally reusable under the [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/), but EONET aggregates third-party sources whose rights vary. The adapter stores metadata and lineage only. No key. |
| NOAA SWPC | [SWPC data service](https://www.swpc.noaa.gov/content/data-access) and [JSON products](https://services.swpc.noaa.gov/products/) | Latest planetary K-index and available station/a-index metadata | NOAA-authored data is generally a U.S. government work/public domain; credit NOAA/SWPC. Operational products can be revised and carry no warranty. See the [NOAA disclaimer](https://www.noaa.gov/disclaimer). No key. |
| Hacker News metadata | [Official Firebase API](https://github.com/HackerNews/API) | Top-item ID, rank, timestamp, score, comment count, item type, outbound hostname | No explicit data/content license is published. The adapter deliberately excludes title, text, author, and comments and marks output `metadata-only`. Use only as a short-lived belief/attention signal. No key. |
| Open-Meteo (opt-in) | [Forecast API](https://open-meteo.com/en/docs) and [terms](https://open-meteo.com/en/terms) | Current weather variables at explicitly configured coordinates | Output data is CC BY 4.0 with attribution. The hosted free API is for non-commercial use and has usage limits (10,000 calls/day at review time); commercial use needs an appropriate plan. Its server is open source under AGPL-3.0, so self-hosting is an option. The CLI never enables it without `--open-meteo`. |

The USGS, EONET, SWPC, and HN adapters are enabled by `--live`; Open-Meteo is
separately opt-in because deployment context determines whether its hosted service
terms fit.

## Operational probes

Direct endpoint probes on 2026-07-13 found:

| Source | Browser access/cache observation | Consequence |
| --- | --- | --- |
| USGS GeoJSON | `Access-Control-Allow-Origin: *`; roughly one-minute cache | Suitable for an ingest worker; do not poll faster than the feed changes. |
| NASA EONET | CORS `*`; response observed as private/no-cache, with JSON once mislabeled as an RSS/XML media type | Adapter parses bounded text as JSON instead of trusting `Content-Type`. |
| NOAA/NWS | CORS `*`; very short cache; API asks clients for a descriptive `User-Agent` | Server-side request identifies The Current. |
| World Bank Indicators | CORS `*`; long cache | Treat as slow baseline context, not live event pressure. |
| Open-Meteo | CORS `*` | Still collected server-side to enforce attribution, rate control, and snapshot reproducibility. |
| Hacker News | Origin reflected/no-cache behavior | Server-side collection prevents every viewer from multiplying traffic. |
| GDACS | CORS `*` on tested public feed | Candidate corroborator, subject to a clearer reuse review. |
| NOAA SWPC | CORS `*`; roughly one-minute cache | Poll no faster than the product cadence. |
| GDELT DOC | Repeated HTTP 429 during review; a raw-data host also presented a hostname-certificate mismatch to the Windows client | Do not make the first release depend on it. Add a hardened proxy/downloader with mirrors, cache, validation, and backoff before use. |
| ReliefWeb | Unapproved test `appname` returned HTTP 403 | Integration requires prior application-name approval; it is not currently credential-free in practice. |

CORS is not a recommendation to fetch from every viewer. Central ingestion is
needed for rate limiting, reproducibility, terms compliance, cache control, and
consistent normalization.

## Researched source inventory

### Recommended next sources

**National Weather Service API.** The [weather.gov API](https://www.weather.gov/documentation/services-web-api)
is keyless and provides U.S. alerts, forecasts, and observations. NWS asks for a
descriptive `User-Agent`. Most NWS-authored material is a U.S. government work;
linked radar/basemap/provider material can have separate terms. Add alerts as
objective hazard evidence, deduplicated against EONET/GDACS, while Open-Meteo can
cover configured global points.

**World Bank Indicators.** The [Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation)
is keyless and useful for slow economic, demographic, agriculture, energy, health,
and infrastructure baselines. The default dataset license is commonly CC BY 4.0,
but individual datasets can carry exceptions; record the dataset code and its
specific [terms](https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets).
Indicators should tune priors/capacities over months or years, never create events.

**GDACS.** The [Global Disaster Alert and Coordination System](https://www.gdacs.org/)
offers RSS/GeoJSON-style disaster metadata and can corroborate geophysical and
weather hazards. Public access alone is not a license. Before implementation,
confirm current European Commission/JRC reuse terms for the exact endpoint and
retain originating-agency lineage.

**NASA POWER.** The [POWER API](https://power.larc.nasa.gov/docs/services/api/)
provides analysis-ready meteorological and solar/agricultural parameters. It is a
good candidate for climate and crop-potential baselines. Follow NASA attribution
guidance and verify any parameter-specific upstream rights.

**Eurostat.** The [Eurostat web services](https://ec.europa.eu/eurostat/web/main/help/web-services)
offer versioned official statistics. EU reuse is generally permissive with source
acknowledgment under the Commission reuse decision, but exact dataset notices must
be retained. Suitable for slow economic/social baselines.

**U.S. Bureau of Labor Statistics.** The [BLS Public Data API](https://www.bls.gov/developers/home.htm)
provides U.S. labor and price series. Anonymous access is available with tighter
limits; registration increases capacity. BLS-authored data is generally public
domain. This is a baseline/economic-pressure source, not a direct price oracle for
the simulated economy.

**FAOSTAT.** [FAOSTAT](https://www.fao.org/faostat/en/#data) supplies agriculture,
food, land, emissions, and trade statistics. FAOSTAT datasets are generally
offered under CC BY 4.0, subject to the displayed dataset terms. Use for slow
priors and calibration.

**WHO Global Health Observatory.** The [GHO OData API](https://www.who.int/data/gho/info/gho-odata-api)
offers public-health indicators. WHO materials carry specific data terms and
attribution requirements; verify the exact dataset license before redistribution.
Use only aggregated indicators and never infer individual health status.

**Crossref.** The [REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)
can measure research activity and disciplinary novelty. Much Crossref bibliographic
metadata is made available under CC0, but abstracts and linked publisher content
may remain copyrighted. Follow API etiquette (`mailto`/identifying agent), cache,
and store identifiers/counts rather than copyrighted abstracts.

### Useful but gated, conditional, or operationally fragile

**ReliefWeb API v2.** The [official API documentation](https://apidoc.reliefweb.int/)
now requires a pre-approved `appname` for production access. As of 2025-11-01 the
documented allowance is 1,000 requests/day with up to 1,000 rows/request. An
unapproved application received 403 during review. ReliefWeb content has
source-specific rights; store metadata/links and the originating source license.

**Media Cloud.** [Media Cloud](https://www.mediacloud.org/) is valuable for
multi-source media attention and narratives, but current API use requires an API
key. Article copyright remains with publishers. It could later contribute
aggregate belief/sentiment pressure after credentials, quotas, and redistribution
terms are approved; it must never be a core dependency.

**FRED.** The [FRED API](https://fred.stlouisfed.org/docs/api/fred/) requires a
registered API key. FRED is a distributor: each series can have its own source,
copyright, and downstream restrictions under the [FRED terms](https://fred.stlouisfed.org/legal/).
Use only reviewed series, preserve source notes, and keep it optional.

**UCDP.** The [UCDP API](https://ucdp.uu.se/apidocs/) requires an access token as
of February 2026. Versioned bulk datasets remain a better reproducibility path and
are generally distributed under CC BY 4.0 with required citation; verify the
specific release on the [UCDP downloads page](https://ucdp.uu.se/downloads/).
Conflict observations must be coarse, delayed where appropriate, and never used to
target real people.

**GDELT 2.0.** [GDELT](https://www.gdeltproject.org/) provides high-frequency,
global event and media metadata without a secret key. It is powerful but noisy;
article text/images retain publisher rights, and endpoint-level license clarity
must be reviewed. Current operational throttling/certificate issues make it a
later source. A future adapter should download versioned files through a server
proxy, hash them, apply language/geography/source-diversity controls, and treat the
result primarily as belief/event-candidate evidence requiring corroboration.

## Recommended implementation order

1. **Always available:** deterministic synthetic fixture and schema validation.
2. **First production evidence:** USGS, NOAA SWPC, NASA EONET; add NWS alerts next.
3. **Corroboration and baselines:** GDACS after terms review, World Bank WDI, NASA
   POWER, BLS/Eurostat/FAOSTAT as relevant.
4. **Belief/attention only:** privacy-minimized Hacker News aggregates; optionally
   Crossref research-activity metadata.
5. **Deployment-dependent global weather:** Open-Meteo with visible attribution and
   a compliant hosted plan or self-hosted service.
6. **Gated sources:** ReliefWeb approval, Media Cloud key, carefully reviewed FRED
   series, and versioned UCDP downloads/token access.
7. **Later high-volume media layer:** GDELT behind a hardened ingest service and
   multi-source corroboration.

No source is allowed to become a single point of failure. A snapshot can be
generated with zero network access, partial live-source failure remains valid and
visible, and the authoritative civilization continues from its prior pressures.

## Running ingestion

```bash
# Deterministic, network-free fixture (the default)
npm run data:ingest

# Credential-free live sources; individual failures are recorded
npm run data:ingest -- --live --out public/data/live-signals.json

# Compare against a prior snapshot when calculating novelty/revision
npm run data:ingest -- --live --previous public/data/previous-signals.json

# Opt in one Open-Meteo point (latitude,longitude,stable-id)
npm run data:ingest -- --open-meteo 39.7684,-86.1581,indianapolis
```

Live output is a review artifact, not automatically trusted or committed. Keep
credentials out of command lines and snapshots if future adapters become gated.
Never commit keys, tokens, source-account data, or unrestricted copyrighted
content. Polling, retention, attribution, and takedown behavior must be reviewed
again before the public persistent deployment.
