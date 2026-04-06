import type { RawIncidentSignal } from "../watchers/raw-incident-signal";
import { createCommunicationsProvider } from "../actions/communications";
import {
  PrismaActionRepository,
  PrismaCaseRepository,
  PrismaCheckInRepository,
  PrismaIncidentRepository,
  PrismaInteractionRepository,
  PrismaUserRepository,
} from "../db/prisma-repositories";
import { readWorkerEnv } from "../config/env";
import { normalizeIncident } from "../normalizers/incident-normalizer";
import { orchestrateAlert } from "../orchestrator/alert-orchestrator";
import { scoreIncidentForUser } from "../risk/risk-engine";

type DrillScenario = "fire-nearby" | "hazmat-route" | "road-closure";

function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function offsetLatitude(latitude: number, metersNorth: number) {
  return latitude + metersNorth / 111_111;
}

function offsetLongitude(latitude: number, longitude: number, metersEast: number) {
  return longitude + metersEast / (111_111 * Math.cos((latitude * Math.PI) / 180));
}

function buildDrillSignal(params: {
  scenario: DrillScenario;
  currentLat: number;
  currentLng: number;
}): RawIncidentSignal {
  const { scenario, currentLat, currentLng } = params;
  const centerLat = offsetLatitude(currentLat, 350);
  const centerLng = offsetLongitude(currentLat, currentLng, 180);

  const shared = {
    watcherId: "watcher_drill",
    source: {
      id: `source_drill_${scenario}`,
      sourceType: "simulation" as const,
      sourceName: "Eleos Drill Simulator",
      sourceUrl: "about:drill",
      rawTitle: "",
      rawExcerpt: "",
      publishedAt: minutesAgoIso(2),
      retrievedAt: minutesAgoIso(1),
      reliabilityScore: 1,
    },
    firstSeenAt: minutesAgoIso(2),
    lastSeenAt: minutesAgoIso(1),
  };

  if (scenario === "hazmat-route") {
    return {
      ...shared,
      id: "signal_drill_hazmat_route",
      incidentKey: "drill_hazmat_route_dc",
      title: "Hazmat spill near your route",
      excerpt: "Simulation: a hazardous materials spill has been reported along a likely outbound route near your current location.",
      locationName: "Connecticut Avenue NW corridor",
      centerLat,
      centerLng,
      radiusMeters: 900,
      incidentTypeHint: "hazmat",
      severityHint: "critical",
      recommendedAction: "Shelter in place, close windows and ventilation, and avoid travel through the affected corridor.",
      source: {
        ...shared.source,
        rawTitle: "Hazmat spill near your route",
        rawExcerpt: "Simulation: a hazardous materials spill has been reported along a likely outbound route near your current location.",
      },
    };
  }

  if (scenario === "road-closure") {
    return {
      ...shared,
      id: "signal_drill_road_closure",
      incidentKey: "drill_road_closure_dc",
      title: "Major road closure near Dupont Circle",
      excerpt: "Simulation: emergency responders have blocked a primary commuter route close to your location.",
      locationName: "Dupont Circle",
      centerLat,
      centerLng,
      radiusMeters: 1200,
      incidentTypeHint: "road_closure",
      severityHint: "high",
      recommendedAction: "Avoid the closure area and delay departure until responders reopen the route.",
      source: {
        ...shared.source,
        rawTitle: "Major road closure near Dupont Circle",
        rawExcerpt: "Simulation: emergency responders have blocked a primary commuter route close to your location.",
      },
    };
  }

  return {
    ...shared,
    id: "signal_drill_fire_nearby",
    incidentKey: "drill_fire_nearby_dc",
    title: "Structure fire near your location",
    excerpt: "Simulation: a structure fire has been reported a few blocks from your current location in Washington, DC.",
    locationName: "Near Logan Circle",
    centerLat,
    centerLng,
    radiusMeters: 700,
    incidentTypeHint: "fire",
    severityHint: "critical",
    recommendedAction: "Move away from the affected block, avoid smoke exposure, and be ready to leave immediately if conditions worsen.",
    source: {
      ...shared.source,
      rawTitle: "Structure fire near your location",
      rawExcerpt: "Simulation: a structure fire has been reported a few blocks from your current location in Washington, DC.",
    },
  };
}

async function main() {
  const env = readWorkerEnv();
  const scenario = (process.argv[2] as DrillScenario | undefined) ?? "fire-nearby";
  const incidentRepository = new PrismaIncidentRepository();
  const caseRepository = new PrismaCaseRepository();
  const actionRepository = new PrismaActionRepository();
  const interactionRepository = new PrismaInteractionRepository();
  const checkInRepository = new PrismaCheckInRepository();
  const userRepository = new PrismaUserRepository();
  const communications = createCommunicationsProvider(env.mockCommunications, {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    callOutcome: env.callSimulationMode,
    fromPhoneNumber: env.twilioPhoneNumber,
  });
  const user = await userRepository.getPrimaryUser();
  const signal = buildDrillSignal({
    scenario,
    currentLat: user.currentLat,
    currentLng: user.currentLng,
  });
  const incident = normalizeIncident(signal);

  await incidentRepository.save(incident);
  const risk = scoreIncidentForUser(incident, user);
  const orchestration = await orchestrateAlert({
    incident,
    risk,
    user,
    communications,
    caseRepository,
    actionRepository,
    interactionRepository,
    checkInRepository,
  });

  console.log("Eleos drill completed.");
  console.log("Scenario:", scenario);
  console.log("Target phone:", user.primaryPhone);
  console.log("Target email:", user.primaryEmail ?? "not configured");
  console.log("Incident:", incident.title);
  console.log("Location:", incident.locationName);
  console.log("Risk decision:", risk.decision);
  console.log("Case state:", orchestration.caseRecord.state);
  console.log("Trigger reason:", orchestration.caseRecord.triggerReason);
  console.log(
    "Actions:",
    orchestration.actionRecords.map((action) => `${action.actionType}:${action.status}`).join(", ") || "none",
  );
  console.log(
    "Provider refs:",
    orchestration.actionRecords
      .map((action) => `${action.actionType}:${action.providerReference ?? "none"}`)
      .join(", ") || "none",
  );
  console.log(
    "Interactions:",
    orchestration.interactions
      .map((interaction) => `${interaction.interactionType}:${interaction.deliveryStatus}`)
      .join(", ") || "none",
  );
  console.log(
    "Interaction summaries:",
    orchestration.interactions.map((interaction) => interaction.contentSummary).join(" | ") || "none",
  );
  console.log(
    "Interaction transcripts:",
    orchestration.interactions.map((interaction) => interaction.transcript ?? "none").join(" | ") || "none",
  );
  console.log("Check-ins:", orchestration.checkIns.length);
}

main().catch((error) => {
  console.error("Eleos drill failed.", error);
  process.exitCode = 1;
});
