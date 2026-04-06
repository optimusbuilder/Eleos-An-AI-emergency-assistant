import { createCommunicationsProvider } from "../actions/communications";
import {
  PrismaActionRepository,
  PrismaCaseRepository,
  PrismaCheckInRepository,
  PrismaIncidentRepository,
  PrismaInteractionRepository,
  PrismaUserRepository,
} from "../db/prisma-repositories";
import { orchestrateAlert } from "../orchestrator/alert-orchestrator";
import { scoreIncidentForUser } from "../risk/risk-engine";
import { readWorkerEnv } from "../config/env";
import { ingestWatchers, sortIncidentsForTriage } from "./ingest-watchers";
import { buildSourceWatchers } from "../watchers/source-watcher";

export async function runBootstrapDemo() {
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
  const incident = prioritizedIncidents[0];

  if (!incident) {
    throw new Error("Bootstrap demo did not produce any incidents.");
  }

  const user = await userRepository.getPrimaryUser();
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

  return {
    env,
    watchers,
    ingestion,
    incident,
    risk,
    orchestration,
  };
}
