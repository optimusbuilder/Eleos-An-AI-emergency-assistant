import { prisma } from "@eleos/db";
import { createCommunicationsProvider } from "../actions/communications.js";
import {
  PrismaActionRepository,
  PrismaCaseRepository,
  PrismaCheckInRepository,
  PrismaIncidentRepository,
  PrismaInteractionRepository,
  PrismaUserRepository,
} from "../db/prisma-repositories.js";
import { orchestrateAlert } from "../orchestrator/alert-orchestrator.js";
import { scoreIncidentForUser } from "../risk/risk-engine.js";

async function run() {
  console.log("Starting Incident Processing Job...");
  const incidentRepo = new PrismaIncidentRepository();
  const userRepo = new PrismaUserRepository();
  const caseRepo = new PrismaCaseRepository();
  const actionRepo = new PrismaActionRepository();
  const interactionRepo = new PrismaInteractionRepository();
  const checkInRepo = new PrismaCheckInRepository();

  const mockCommunications = process.env.TWILIO_ACCOUNT_SID ? false : true;
  const communications = createCommunicationsProvider(mockCommunications, {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    callOutcome: "answered",
  });

  const user = await userRepo.getPrimaryUser();
  const incidents = await incidentRepo.list();

  // Find all active incidents
  const activeIncidents = incidents.filter((i) => i.status !== "resolved");

  console.log(`Found ${activeIncidents.length} active incidents to process.`);

  for (const incident of activeIncidents) {
    const risk = scoreIncidentForUser(incident, user);

    if (risk.decision === "ignore") {
      continue;
    }

    // Check if we already have an active case for this user + incident combination
    const existingCase = await prisma.case.findFirst({
      where: {
        userId: user.id,
        incidentId: incident.id,
      },
    });

    if (!existingCase) {
      console.log(`[New Case] Action required for Incident ${incident.id} (${incident.title}) -> Decision: ${risk.decision}`);
      
      await orchestrateAlert({
        incident,
        risk,
        user,
        communications,
        caseRepository: caseRepo,
        actionRepository: actionRepo,
        interactionRepository: interactionRepo,
        checkInRepository: checkInRepo,
      });
      
      console.log(`Successfully orchestrated response and case state for ${incident.id}`);
    } else {
      // Future Phase: Escalate if severity increases.
      // For now, avoid spamming duplicate calls for the same incident.
      // console.log(`[Skip] Case already exists for Incident ${incident.id}`);
    }
  }

  console.log("Finished Incident Processing Job.");
}

run()
  .catch((err) => {
    console.error("Job failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
