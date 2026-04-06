import { riskThresholds } from "@eleos/config";
import type { Incident, RiskAssessment, UserProfile } from "@eleos/shared";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
) {
  const earthRadiusMeters = 6_371_000;
  const deltaLat = toRadians(destinationLat - originLat);
  const deltaLng = toRadians(destinationLng - originLng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(destinationLat)) *
      Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

function getFreshnessMinutes(lastSeenAt: string, now: Date) {
  return Math.round((now.getTime() - new Date(lastSeenAt).getTime()) / 60_000);
}

function isFreshIncident(lastSeenAt: string, now: Date) {
  return getFreshnessMinutes(lastSeenAt, now) <= 180;
}

export function scoreIncidentForUser(
  incident: Incident,
  user: UserProfile,
  now: Date = new Date(),
): RiskAssessment {
  const distanceMeters = calculateDistanceMeters(
    user.currentLat,
    user.currentLng,
    incident.centerLat,
    incident.centerLng,
  );

  const withinCallRadius = distanceMeters <= riskThresholds.callRadiusMeters;
  const withinAlertRadius = distanceMeters <= riskThresholds.highUrgencyRadiusMeters;
  const fresh = isFreshIncident(incident.lastSeenAt, now);
  const highConfidence = incident.confidence === "high";
  const mediumConfidenceOrBetter = incident.confidence === "high" || incident.confidence === "medium";
  const severeIncident = incident.severity === "high" || incident.severity === "critical";
  const routeAffected = incident.incidentType === "road_closure" || incident.incidentType === "weather";

  let decision: RiskAssessment["decision"] = "ignore";

  if (withinCallRadius && highConfidence && severeIncident && fresh) {
    decision = "call_now";
  } else if (withinAlertRadius && mediumConfidenceOrBetter && fresh) {
    decision = "alert";
  } else if ((withinAlertRadius || routeAffected) && fresh) {
    decision = "monitor";
  }

  const freshnessMinutes = getFreshnessMinutes(incident.lastSeenAt, now);

  return {
    incidentId: incident.id,
    userId: user.id,
    decision,
    riskLevel: incident.severity,
    distanceMeters,
    routeAffected,
    reasons: [
      `Incident severity is ${incident.severity}.`,
      `Incident confidence is ${incident.confidence}.`,
      `${distanceMeters} meters from the user's current location.`,
      fresh
        ? `Incident was updated ${freshnessMinutes} minutes ago.`
        : `Incident is stale at ${freshnessMinutes} minutes since the last update.`,
      routeAffected
        ? "Known travel routes may be affected."
        : "No route impact has been inferred from the incident type.",
    ],
  };
}
