import { createCommunicationsProvider } from "../actions/communications";
import { readWorkerEnv } from "../config/env";

async function main() {
  const providerReference = process.argv[2];

  if (!providerReference) {
    console.error("Usage: npm --workspace @eleos/worker run call-status -- <twilio-call-sid>");
    process.exitCode = 1;
    return;
  }

  const env = readWorkerEnv();
  const communications = createCommunicationsProvider(false, {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromPhoneNumber: env.twilioPhoneNumber,
  });

  const status = await communications.fetchCallStatus({ providerReference });

  console.log("Eleos call status");
  console.log("Provider:", status.provider);
  console.log("Call SID:", status.providerReference);
  console.log("Delivery status:", status.deliveryStatus);
  console.log("Raw status:", status.rawStatus);
  console.log("Answered by:", status.answeredBy ?? "unknown");
  console.log("Duration seconds:", status.durationSeconds ?? "unknown");
  console.log("Started at:", status.startedAt ?? "unknown");
  console.log("Ended at:", status.endedAt ?? "unknown");
  console.log("Error:", status.errorMessage ?? "none");
}

main().catch((error) => {
  console.error("Call status lookup failed.", error);
  process.exitCode = 1;
});
