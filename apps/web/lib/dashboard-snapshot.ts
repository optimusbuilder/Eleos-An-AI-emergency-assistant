import type {
  CaseRecord,
  CaseTimelineEvent,
  Incident,
  UserProfile,
} from "@eleos/shared";
import {
  PrismaActionRepository,
  PrismaCaseRepository,
  PrismaCheckInRepository,
  PrismaIncidentRepository,
  PrismaInteractionRepository,
  PrismaUserRepository,
} from "@eleos/db";
import { createCommunicationsProvider } from "@eleos/worker/src/actions/communications";
import { readWorkerEnv } from "@eleos/worker/src/config/env";
import { ingestWatchers, sortIncidentsForTriage } from "@eleos/worker/src/jobs/ingest-watchers";
import { normalizeIncident } from "@eleos/worker/src/normalizers/incident-normalizer";
import { orchestrateAlert } from "@eleos/worker/src/orchestrator/alert-orchestrator";
import { scoreIncidentForUser } from "@eleos/worker/src/risk/risk-engine";
import { buildSourceWatchers } from "@eleos/worker/src/watchers/source-watcher";

export interface DashboardSnapshot {
  user: UserProfile;
  incidents: Incident[];
  activeCase: CaseRecord;
  timeline: CaseTimelineEvent[];
  activeNodes: string[];
  evidence: string[];
  metadata: {
    actionCount: number;
    checkInCount: number;
    interactionCount: number;
    lastScanAt: string;
    latestInteractionStatus: string;
    simulatedCallOutcome: string;
    watcherSourceMode: string;
  };
}

function formatClock(input: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  }).format(new Date(input));
}

function formatIncidentForDashboard(incident: Incident): Incident {
  return {
    ...incident,
    firstSeenAt: formatClock(incident.firstSeenAt),
    lastSeenAt: formatClock(incident.lastSeenAt),
  };
}

function formatCaseForDashboard(caseRecord: CaseRecord): CaseRecord {
  return {
    ...caseRecord,
    openedAt: formatClock(caseRecord.openedAt),
    lastActionAt: formatClock(caseRecord.lastActionAt),
    resolvedAt: caseRecord.resolvedAt ? formatClock(caseRecord.resolvedAt) : undefined,
  };
}

function buildTimeline(params: {
  activeIncident: Incident;
  ingestion: Awaited<ReturnType<typeof ingestWatchers>>;
  orchestration: Awaited<ReturnType<typeof orchestrateAlert>>;
  risk: ReturnType<typeof scoreIncidentForUser>;
}): CaseTimelineEvent[] {
  const { activeIncident, ingestion, orchestration, risk } = params;

  const prelude: CaseTimelineEvent[] = [
    {
      id: `${activeIncident.id}_watchers`,
      timestamp: formatClock(activeIncident.firstSeenAt),
      title: "Signals ingested",
      detail: `${ingestion.totalSignals} raw watcher signals produced ${ingestion.uniqueIncidentCount} active incidents.`,
      state: "monitoring",
    },
    {
      id: `${activeIncident.id}_normalized`,
      timestamp: formatClock(activeIncident.lastSeenAt),
      title: "Incident normalized",
      detail: `${activeIncident.title} merged ${activeIncident.sourceCount} corroborating source${activeIncident.sourceCount === 1 ? "" : "s"} into one incident record.`,
      state: "monitoring",
    },
    {
      id: `${activeIncident.id}_risk`,
      timestamp: formatClock(orchestration.caseRecord.openedAt),
      title: "Risk matched to user",
      detail: risk.reasons.slice(0, 3).join(" "),
      state: "alert_sent",
    },
  ];

  const orchestrationEvents = orchestration.timeline.map((event) => ({
    ...event,
    timestamp: formatClock(event.timestamp),
  }));

  return [...prelude, ...orchestrationEvents];
}

function buildActiveNodes(params: {
  decision: ReturnType<typeof scoreIncidentForUser>["decision"];
  interactions: Awaited<ReturnType<typeof orchestrateAlert>>["interactions"];
  checkInCount: number;
}) {
  const nodes = ["Watchers", "Normalizer", "Risk Engine"];

  if (params.decision === "call_now") {
    nodes.push("Voice Agent", "Contact Action");
  } else if (params.decision === "alert") {
    nodes.push("Contact Action");
  }

  if (params.interactions.length > 0 && !nodes.includes("Contact Action")) {
    nodes.push("Contact Action");
  }

  if (params.checkInCount > 0) {
    nodes.push("Check-In Scheduler");
  }

  return nodes;
}

function buildEvidence(params: {
  activeIncident: Incident;
  risk: ReturnType<typeof scoreIncidentForUser>;
  orchestration: Awaited<ReturnType<typeof orchestrateAlert>>;
}) {
  const { activeIncident, risk, orchestration } = params;
  const sourceNames = activeIncident.sources.map((source) => source.sourceName).slice(0, 2).join(", ");
  const interactionStatuses = orchestration.interactions.map((interaction) => interaction.deliveryStatus).join(", ");

  return [
    `${activeIncident.sourceCount} corroborating source${activeIncident.sourceCount === 1 ? "" : "s"} backing this incident${sourceNames ? `: ${sourceNames}.` : "."}`,
    ...risk.reasons,
    interactionStatuses
      ? `Latest communication statuses: ${interactionStatuses}.`
      : "No outbound communication has been triggered yet.",
    orchestration.checkIns.length
      ? `${orchestration.checkIns.length} follow-up check-in${orchestration.checkIns.length === 1 ? "" : "s"} scheduled.`
      : "No follow-up check-ins are scheduled yet.",
  ];
}

import { cache } from "react";

export const buildDashboardSnapshot = cache(async (): Promise<DashboardSnapshot> => {
  const env = readWorkerEnv();
  const incidentRepository = new PrismaIncidentRepository();
  const caseRepository = new PrismaCaseRepository();
  const actionRepository = new PrismaActionRepository();
  const interactionRepository = new PrismaInteractionRepository();
  const checkInRepository = new PrismaCheckInRepository();
  const userRepository = new PrismaUserRepository();
  const watchers = buildSourceWatchers(env.watcherSourceMode);
  const communications = createCommunicationsProvider(env.mockCommunications, {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    callOutcome: env.callSimulationMode,
    fromPhoneNumber: env.twilioPhoneNumber,
  });

  const ingestion = await ingestWatchers({ incidentRepository, watchers });
  const prioritizedIncidents = sortIncidentsForTriage(ingestion.incidents);
  const activeIncident = prioritizedIncidents[0] ?? normalizeIncident(ingestion.signals[0]);
  const user = await userRepository.getPrimaryUser();
  const risk = scoreIncidentForUser(activeIncident, user);
  const orchestration = await orchestrateAlert({
    incident: activeIncident,
    risk,
    user,
    communications,
    caseRepository,
    actionRepository,
    interactionRepository,
    checkInRepository,
  });

  const dbIncidents = await incidentRepository.list();
  
  // Merge the mock/demo incidents with the actual live database ones, remove duplicates by ID
  const allIncidentsMap = new Map<string, Incident>();
  for (const inc of dbIncidents) allIncidentsMap.set(inc.id, inc);
  for (const inc of prioritizedIncidents) allIncidentsMap.set(inc.id, inc);

  const mergedIncidents = Array.from(allIncidentsMap.values())
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  const incidents = mergedIncidents.map(formatIncidentForDashboard);
  const activeCase = formatCaseForDashboard(orchestration.caseRecord);
  const timeline = buildTimeline({
    activeIncident,
    ingestion,
    orchestration,
    risk,
  });

  return {
    user,
    incidents,
    activeCase,
    timeline,
    activeNodes: buildActiveNodes({
      decision: risk.decision,
      interactions: orchestration.interactions,
      checkInCount: orchestration.checkIns.length,
    }),
    evidence: buildEvidence({
      activeIncident,
      risk,
      orchestration,
    }),
    metadata: {
      actionCount: orchestration.actionRecords.length,
      checkInCount: orchestration.checkIns.length,
      interactionCount: orchestration.interactions.length,
      lastScanAt: formatClock(new Date().toISOString()),
      latestInteractionStatus:
        orchestration.interactions[orchestration.interactions.length - 1]?.deliveryStatus ?? "none",
      simulatedCallOutcome: env.callSimulationMode,
      watcherSourceMode: env.watcherSourceMode,
    },
  };
});
