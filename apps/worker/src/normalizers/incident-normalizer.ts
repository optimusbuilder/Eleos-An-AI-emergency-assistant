import type {
  Incident,
  IncidentConfidence,
  IncidentType,
  Severity,
} from "@eleos/shared";
import type { RawIncidentSignal } from "../watchers/raw-incident-signal";

const severityRank: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function inferIncidentType(signal: RawIncidentSignal): IncidentType {
  if (signal.incidentTypeHint) {
    return signal.incidentTypeHint;
  }

  const haystack = `${signal.title} ${signal.excerpt}`.toLowerCase();

  if (haystack.includes("flood")) return "flood";
  if (haystack.includes("hazmat") || haystack.includes("chemical")) return "hazmat";
  if (haystack.includes("fire") || haystack.includes("smoke")) return "fire";
  if (haystack.includes("shelter")) return "shelter";
  if (haystack.includes("road") || haystack.includes("closure") || haystack.includes("connector")) {
    return "road_closure";
  }

  return "weather";
}

function inferSeverity(signal: RawIncidentSignal, incidentType: IncidentType): Severity {
  if (signal.severityHint) {
    return signal.severityHint;
  }

  const haystack = `${signal.title} ${signal.excerpt}`.toLowerCase();

  if (haystack.includes("evacuate") || haystack.includes("life-threatening")) return "critical";
  if (haystack.includes("warning") || haystack.includes("severe")) return "high";
  if (incidentType === "road_closure" || haystack.includes("closure")) return "medium";

  return "low";
}

function inferConfidence(reliabilityScore: number): IncidentConfidence {
  if (reliabilityScore >= 0.9) return "high";
  if (reliabilityScore >= 0.65) return "medium";
  return "low";
}

function defaultAction(incidentType: IncidentType): string {
  switch (incidentType) {
    case "weather":
      return "Move indoors now and stay away from windows while Eleos verifies route conditions.";
    case "road_closure":
      return "Avoid the affected route and wait for an official reopening before traveling through the area.";
    case "fire":
      return "Avoid the affected area and prepare to leave if officials issue evacuation guidance.";
    case "flood":
      return "Move to higher ground and avoid driving through standing water.";
    case "hazmat":
      return "Shelter in place, close windows and ventilation, and wait for official guidance.";
    case "shelter":
      return "Review the nearest open shelter and prepare essential items before leaving.";
  }
}

export function buildIncidentFingerprint(signal: RawIncidentSignal): string {
  const incidentType = inferIncidentType(signal);

  if (signal.incidentKey) {
    return slugify(signal.incidentKey);
  }

  return slugify(`${incidentType}_${signal.locationName}_${signal.title}`);
}

export function normalizeIncident(signal: RawIncidentSignal): Incident {
  const incidentType = inferIncidentType(signal);
  const severity = inferSeverity(signal, incidentType);

  return {
    id: `incident_${buildIncidentFingerprint(signal)}`,
    incidentType,
    title: signal.title,
    description: signal.excerpt,
    severity,
    status: signal.status ?? "active",
    confidence: inferConfidence(signal.source.reliabilityScore),
    sourceCount: 1,
    locationName: signal.locationName,
    centerLat: signal.centerLat,
    centerLng: signal.centerLng,
    radiusMeters: signal.radiusMeters,
    recommendedAction: signal.recommendedAction ?? defaultAction(incidentType),
    firstSeenAt: signal.firstSeenAt ?? signal.source.publishedAt,
    lastSeenAt: signal.lastSeenAt ?? signal.source.retrievedAt,
    sources: [signal.source],
  };
}

export function pickHigherSeverity(left: Severity, right: Severity): Severity {
  return severityRank[left] >= severityRank[right] ? left : right;
}
