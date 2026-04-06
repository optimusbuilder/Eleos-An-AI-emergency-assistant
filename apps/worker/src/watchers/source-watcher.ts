import { pollingIntervals } from "@eleos/config";
import type { IncidentStatus, IncidentType, Severity, SourceRecord } from "@eleos/shared";
import type { RawIncidentSignal } from "./raw-incident-signal";

export type WatcherSourceMode = "auto" | "fixture" | "live";

export interface SourceWatcher {
  id: string;
  label: string;
  tier: "official" | "supporting" | "community";
  intervalMs: number;
  poll(): Promise<RawIncidentSignal[]>;
}

const ALERT_DC_LIST_URL = "https://trainingtrack.hsema.dc.gov/NRssV2/RssFeed/AlertDCList";
const NWS_ACTIVE_ALERTS_URL = "https://api.weather.gov/alerts/active?area=DC";
const DISTRICT_CENTER = {
  lat: 38.9072,
  lng: -77.0369,
};

function createSource(input: {
  id: string;
  sourceType: SourceRecord["sourceType"];
  sourceName: string;
  sourceUrl: string;
  rawTitle: string;
  rawExcerpt: string;
  publishedAt: string;
  reliabilityScore: number;
}): SourceRecord {
  return {
    ...input,
    retrievedAt: input.publishedAt,
  };
}

function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function toPlainText(html: string) {
  return decodeHtml(html.replace(/<[^>]+>/g, "\n"));
}

function mapSeverity(value?: string | null): Severity {
  const normalized = value?.toLowerCase() ?? "";

  if (normalized === "extreme") return "critical";
  if (normalized === "severe") return "high";
  if (normalized === "moderate") return "medium";

  return "low";
}

function mapStatus(value?: string | null): IncidentStatus {
  const normalized = value?.toLowerCase() ?? "";

  if (normalized === "actual") return "active";
  if (normalized === "test" || normalized === "draft") return "monitoring";

  return "active";
}

function inferIncidentType(text: string): IncidentType | null {
  const haystack = text.toLowerCase();

  if (haystack.includes("flood")) return "flood";
  if (haystack.includes("hazmat") || haystack.includes("chemical")) return "hazmat";
  if (haystack.includes("fire") || haystack.includes("smoke")) return "fire";
  if (haystack.includes("shelter") || haystack.includes("warming center") || haystack.includes("cooling center")) {
    return "shelter";
  }
  if (
    haystack.includes("road closure") ||
    haystack.includes("street closure") ||
    haystack.includes("lane closure") ||
    haystack.includes("parkway closed") ||
    haystack.includes("traffic")
  ) {
    return "road_closure";
  }
  if (
    haystack.includes("warning") ||
    haystack.includes("watch") ||
    haystack.includes("advisory") ||
    haystack.includes("storm") ||
    haystack.includes("wind") ||
    haystack.includes("cold") ||
    haystack.includes("heat")
  ) {
    return "weather";
  }

  return null;
}

function normalizeRecommendedAction(input: string | undefined, fallback: string) {
  if (!input) {
    return fallback;
  }

  return input.replace(/\s+/g, " ").trim();
}

function buildSignalId(prefix: string, suffix: string) {
  return `${prefix}_${suffix.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json, application/json",
      "User-Agent": "Eleos/0.0.0 (Washington DC safety companion)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html, text/plain",
      "User-Agent": "Eleos/0.0.0 (Washington DC safety companion)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  return response.text();
}

function flattenCoordinates(geometry: unknown): Array<[number, number]> {
  if (!geometry || typeof geometry !== "object") {
    return [];
  }

  const candidate = geometry as { type?: string; coordinates?: unknown };

  if (!candidate.coordinates) {
    return [];
  }

  if (candidate.type === "Polygon") {
    return ((candidate.coordinates as number[][][])[0] ?? []).map(
      (coordinate) => [coordinate[0], coordinate[1]] as [number, number],
    );
  }

  if (candidate.type === "MultiPolygon") {
    return (((candidate.coordinates as number[][][][])[0] ?? [])[0] ?? []).map(
      (coordinate) => [coordinate[0], coordinate[1]] as [number, number],
    );
  }

  return [];
}

function centroidFromGeometry(geometry: unknown) {
  const coordinates = flattenCoordinates(geometry);

  if (!coordinates.length) {
    return DISTRICT_CENTER;
  }

  const [lngSum, latSum] = coordinates.reduce(
    (accumulator, coordinate) => [accumulator[0] + coordinate[0], accumulator[1] + coordinate[1]],
    [0, 0],
  );

  return {
    lat: latSum / coordinates.length,
    lng: lngSum / coordinates.length,
  };
}

interface NwsAlertFeature {
  id: string;
  geometry?: unknown;
  properties?: {
    event?: string;
    headline?: string;
    description?: string;
    instruction?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    sent?: string;
    effective?: string;
    onset?: string;
    updated?: string;
    ends?: string;
    messageType?: string;
    senderName?: string;
    web?: string;
  };
}

interface NwsAlertResponse {
  features?: NwsAlertFeature[];
}

function featureToSignal(feature: NwsAlertFeature): RawIncidentSignal | null {
  const properties = feature.properties;

  if (!properties) {
    return null;
  }

  const title = properties.event ?? properties.headline ?? "Weather Alert";
  const description = properties.description ?? properties.headline ?? title;
  const incidentType = inferIncidentType(`${title} ${description}`);

  if (!incidentType) {
    return null;
  }

  const messageType = properties.messageType?.toLowerCase();
  if (messageType === "cancel" || messageType === "update") {
    return null;
  }

  const center = centroidFromGeometry(feature.geometry);
  const publishedAt = properties.effective ?? properties.sent ?? new Date().toISOString();
  const lastSeenAt = properties.updated ?? properties.sent ?? publishedAt;

  return {
    id: buildSignalId("signal_nws", feature.id),
    watcherId: "watcher_nws",
    incidentKey: feature.id,
    title,
    excerpt: description,
    locationName: properties.areaDesc ?? "Washington, DC",
    centerLat: center.lat,
    centerLng: center.lng,
    radiusMeters: 4500,
    incidentTypeHint: incidentType,
    severityHint: mapSeverity(properties.severity),
    status: mapStatus(properties.status),
    recommendedAction: normalizeRecommendedAction(
      properties.instruction,
      "Review the official alert and take the first protective action immediately.",
    ),
    firstSeenAt: publishedAt,
    lastSeenAt,
    source: createSource({
      id: buildSignalId("source_nws", feature.id),
      sourceType: "official",
      sourceName: properties.senderName ?? "NWS Baltimore/Washington",
      sourceUrl: properties.web ?? feature.id ?? NWS_ACTIVE_ALERTS_URL,
      rawTitle: title,
      rawExcerpt: description,
      publishedAt,
      reliabilityScore: 1,
    }),
  };
}

async function fetchNwsSignals(): Promise<RawIncidentSignal[]> {
  const payload = await fetchJson<NwsAlertResponse>(NWS_ACTIVE_ALERTS_URL);
  return (payload.features ?? [])
    .map(featureToSignal)
    .filter((signal): signal is RawIncidentSignal => Boolean(signal));
}

interface AlertDcEntry {
  timestamp: string;
  title: string;
  detail: string;
}

function parseAlertDcEntries(html: string): AlertDcEntry[] {
  const lines = toPlainText(html)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const entries: AlertDcEntry[] = [];
  const timestampPattern = /^(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)\s+(.*)$/;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(timestampPattern);

    if (!match) {
      continue;
    }

    entries.push({
      timestamp: match[1],
      title: match[2],
      detail: lines[index + 1] ?? "",
    });
  }

  return entries;
}

function parseAlertDcTimestamp(value: string) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

function entryToSignal(entry: AlertDcEntry, watcherId: "watcher_alertdc" | "watcher_alertdc_roads") {
  const text = `${entry.title} ${entry.detail}`;
  const incidentType = inferIncidentType(text);

  if (!incidentType) {
    return null;
  }

  if (watcherId === "watcher_alertdc_roads" && incidentType !== "road_closure") {
    return null;
  }

  if (watcherId === "watcher_alertdc" && incidentType === "road_closure") {
    return null;
  }

  if (!entry.title.includes("[AlertDC]")) {
    return null;
  }

  const publishedAt = parseAlertDcTimestamp(entry.timestamp);

  return {
    id: buildSignalId(`signal_${watcherId}`, `${entry.timestamp}_${entry.title}`),
    watcherId,
    incidentKey: `${watcherId}_${entry.timestamp}_${entry.title}`,
    title: entry.title,
    excerpt: entry.detail,
    locationName: "Washington, DC",
    centerLat: DISTRICT_CENTER.lat,
    centerLng: DISTRICT_CENTER.lng,
    radiusMeters: incidentType === "road_closure" ? 2200 : 4800,
    incidentTypeHint: incidentType,
    severityHint: incidentType === "road_closure" ? "medium" : "high",
    status: "active",
    recommendedAction: normalizeRecommendedAction(
      entry.detail,
      incidentType === "road_closure"
        ? "Avoid the affected route and wait for official guidance before traveling through the area."
        : "Review the official alert and take the first protective action now.",
    ),
    firstSeenAt: publishedAt,
    lastSeenAt: publishedAt,
    source: createSource({
      id: buildSignalId(`source_${watcherId}`, `${entry.timestamp}_${entry.title}`),
      sourceType: "official",
      sourceName: "AlertDC",
      sourceUrl: ALERT_DC_LIST_URL,
      rawTitle: entry.title,
      rawExcerpt: entry.detail,
      publishedAt,
      reliabilityScore: 0.95,
    }),
  } satisfies RawIncidentSignal;
}

async function fetchAlertDcSignals(
  watcherId: "watcher_alertdc" | "watcher_alertdc_roads",
): Promise<RawIncidentSignal[]> {
  const html = await fetchText(ALERT_DC_LIST_URL);
  return parseAlertDcEntries(html).reduce<RawIncidentSignal[]>((signals, entry) => {
    const signal = entryToSignal(entry, watcherId);

    if (signal) {
      signals.push(signal);
    }

    return signals;
  }, []);
}

const fixtureSignals: RawIncidentSignal[] = [
  {
    id: "signal_weather_official_1",
    watcherId: "watcher_nws",
    incidentKey: "weather_dc_thunderstorm_20260321",
    title: "Severe Thunderstorm Warning",
    excerpt: "Damaging winds are moving across central Washington, DC.",
    locationName: "Central Washington, DC",
    centerLat: 38.9132,
    centerLng: -77.0386,
    radiusMeters: 3200,
    incidentTypeHint: "weather",
    severityHint: "high",
    recommendedAction: "Move indoors now, stay away from windows, and delay travel until the storm cell clears the District.",
    firstSeenAt: minutesAgoIso(6),
    lastSeenAt: minutesAgoIso(3),
    source: createSource({
      id: "source_nws_1",
      sourceType: "official",
      sourceName: "NWS Baltimore/Washington",
      sourceUrl: "https://example.com/nws/dc",
      rawTitle: "Severe Thunderstorm Warning",
      rawExcerpt: "Damaging winds are moving across central Washington, DC.",
      publishedAt: minutesAgoIso(6),
      reliabilityScore: 1,
    }),
  },
  {
    id: "signal_weather_supporting_1",
    watcherId: "watcher_alertdc",
    incidentKey: "weather_dc_thunderstorm_20260321",
    title: "[AlertDC] Severe Thunderstorm Warning for the District",
    excerpt: "AlertDC confirms a severe storm cell with damaging wind risk moving across Washington, DC.",
    locationName: "Central Washington, DC",
    centerLat: 38.9118,
    centerLng: -77.0412,
    radiusMeters: 3400,
    incidentTypeHint: "weather",
    severityHint: "high",
    firstSeenAt: minutesAgoIso(5),
    lastSeenAt: minutesAgoIso(2),
    source: createSource({
      id: "source_alertdc_1",
      sourceType: "official",
      sourceName: "AlertDC",
      sourceUrl: ALERT_DC_LIST_URL,
      rawTitle: "[AlertDC] Severe Thunderstorm Warning for the District",
      rawExcerpt: "AlertDC confirms a severe storm cell with damaging wind risk moving across Washington, DC.",
      publishedAt: minutesAgoIso(5),
      reliabilityScore: 0.95,
    }),
  },
  {
    id: "signal_road_official_1",
    watcherId: "watcher_alertdc_roads",
    incidentKey: "roadclosure_dc_rock_creek_20260321",
    title: "[AlertDC] Road Closure Near Rock Creek Parkway",
    excerpt: "A temporary closure is in place after storm debris blocked a key commuter route.",
    locationName: "Rock Creek Parkway near Dupont Circle",
    centerLat: 38.9145,
    centerLng: -77.0458,
    radiusMeters: 1500,
    incidentTypeHint: "road_closure",
    severityHint: "medium",
    recommendedAction: "Avoid Rock Creek Parkway and use alternate downtown routes if travel is necessary.",
    firstSeenAt: minutesAgoIso(12),
    lastSeenAt: minutesAgoIso(4),
    source: createSource({
      id: "source_alertdc_roads_1",
      sourceType: "official",
      sourceName: "AlertDC",
      sourceUrl: ALERT_DC_LIST_URL,
      rawTitle: "[AlertDC] Road Closure Near Rock Creek Parkway",
      rawExcerpt: "A temporary closure is in place after storm debris blocked a key commuter route.",
      publishedAt: minutesAgoIso(12),
      reliabilityScore: 0.95,
    }),
  },
];

function fixturePoll(watcherId: string) {
  return Promise.resolve(fixtureSignals.filter((signal) => signal.watcherId === watcherId));
}

function wrapWatcherPoll(params: {
  livePoll: () => Promise<RawIncidentSignal[]>;
  fixtureId: string;
  mode: WatcherSourceMode;
}) {
  return async () => {
    if (params.mode === "fixture") {
      return fixturePoll(params.fixtureId);
    }

    try {
      const liveSignals = await params.livePoll();
      if (liveSignals.length > 0) {
        return liveSignals;
      }
    } catch {
      if (params.mode === "live") {
        throw new Error(`Live watcher failed for ${params.fixtureId}.`);
      }
    }

    return fixturePoll(params.fixtureId);
  };
}

export function buildSourceWatchers(mode: WatcherSourceMode = "auto"): SourceWatcher[] {
  return [
    {
      id: "watcher_nws",
      label: "NWS Baltimore/Washington alerts",
      tier: "official",
      intervalMs: pollingIntervals.officialMs,
      poll: wrapWatcherPoll({
        livePoll: fetchNwsSignals,
        fixtureId: "watcher_nws",
        mode,
      }),
    },
    {
      id: "watcher_alertdc",
      label: "AlertDC emergency notices",
      tier: "official",
      intervalMs: pollingIntervals.officialMs,
      poll: wrapWatcherPoll({
        livePoll: () => fetchAlertDcSignals("watcher_alertdc"),
        fixtureId: "watcher_alertdc",
        mode,
      }),
    },
    {
      id: "watcher_alertdc_roads",
      label: "AlertDC transportation notices",
      tier: "official",
      intervalMs: pollingIntervals.officialMs * 2,
      poll: wrapWatcherPoll({
        livePoll: () => fetchAlertDcSignals("watcher_alertdc_roads"),
        fixtureId: "watcher_alertdc_roads",
        mode,
      }),
    },
  ];
}

export const defaultWatchers = buildSourceWatchers("auto");
export const fixtureWatchers = buildSourceWatchers("fixture");

export async function collectSignalsFromWatchers(
  watchers: SourceWatcher[] = defaultWatchers,
): Promise<RawIncidentSignal[]> {
  const results = await Promise.all(watchers.map((watcher) => watcher.poll()));
  return results.flat();
}

export function getFixtureSignals() {
  return [...fixtureSignals];
}
