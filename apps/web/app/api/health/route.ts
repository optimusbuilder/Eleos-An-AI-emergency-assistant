import { getCommunicationModeConfig } from "@eleos/config";
import { buildDashboardSnapshot } from "../../../lib/dashboard-snapshot";

export async function GET() {
  const communicationMode = getCommunicationModeConfig();
  const snapshot = await buildDashboardSnapshot();

  return Response.json({
    ok: true,
    service: "web",
    communicationMode,
    dashboard: {
      actionCount: snapshot.metadata.actionCount,
      checkInCount: snapshot.metadata.checkInCount,
      interactionCount: snapshot.metadata.interactionCount,
      lastScanAt: snapshot.metadata.lastScanAt,
      simulatedCallOutcome: snapshot.metadata.simulatedCallOutcome,
      watcherSourceMode: snapshot.metadata.watcherSourceMode,
    },
    timestamp: new Date().toISOString(),
  });
}
