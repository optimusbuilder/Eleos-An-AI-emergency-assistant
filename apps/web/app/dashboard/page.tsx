import { unstable_noStore as noStore } from "next/cache";
import { buildDashboardSnapshot } from "../../lib/dashboard-snapshot";
import { getCommunicationModeConfig } from "@eleos/config";
import { IncidentFeed } from "../../components/incidents/incident-feed";
import { CaseSummaryCard } from "../../components/cases/case-summary-card";

export default async function DashboardPage() {
  noStore();
  const snapshot = await buildDashboardSnapshot();
  const communicationMode = getCommunicationModeConfig();

  return (
    <div className="dashboard-grid">
      <div className="dashboard-feed">
        <IncidentFeed incidents={snapshot.incidents} activeIncidentId={snapshot.activeCase.incidentId} />
      </div>
      <div className="dashboard-summary">
        <CaseSummaryCard activeCase={snapshot.activeCase} communicationMode={communicationMode} />
      </div>
    </div>
  );
}
