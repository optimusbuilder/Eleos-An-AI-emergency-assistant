import { getCommunicationModeConfig } from "@eleos/config";
import { runBootstrapDemo } from "./jobs/bootstrap";
import { createServer } from "./server";

async function main() {
  const demo = await runBootstrapDemo();
  const communicationMode = getCommunicationModeConfig();

  console.log("Eleos worker scaffold ready.");
  console.log("Watcher mode:", demo.env.watcherSourceMode);
  console.log("Configured watchers:", demo.watchers.map((watcher) => watcher.label).join(", "));
  console.log("Signals ingested:", demo.ingestion.totalSignals);
  console.log("Unique incidents:", demo.ingestion.uniqueIncidentCount);
  console.log("Merged duplicates:", demo.ingestion.mergedSignalCount);
  console.log("Communication mode:", communicationMode.summary);
  console.log("Communication note:", communicationMode.note);
  console.log("Simulated call outcome:", demo.env.callSimulationMode);
  console.log("Email sender:", demo.env.emailFromAddress ?? "not configured");
  console.log("Current incident:", demo.incident.title);
  console.log("Risk decision:", demo.risk.decision);
  console.log("Case state:", demo.orchestration.caseRecord.state);
  console.log(
    "Logged actions:",
    demo.orchestration.actionRecords.map((action) => action.actionType).join(", ") || "none",
  );
  console.log("Logged interactions:", demo.orchestration.interactions.map((interaction) => interaction.deliveryStatus).join(", ") || "none");
  console.log("Scheduled check-ins:", demo.orchestration.checkIns.length);

  const server = await createServer();
  await server.listen({ port: 8080, host: "0.0.0.0" });
  console.log(`WebSocket server listening on ws://localhost:8080`);
}

main().catch((error) => {
  console.error("Worker bootstrap failed.", error);
  process.exitCode = 1;
});
