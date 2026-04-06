import type { CommunicationModeConfig } from "@eleos/config";
import type { DashboardSnapshot } from "../../lib/dashboard-snapshot";
import { AgentGraph } from "../graph/agent-graph";
import { CaseSummaryCard } from "../cases/case-summary-card";
import { CaseTimeline } from "../cases/case-timeline";
import { IncidentFeed } from "../incidents/incident-feed";
import { LiveMap } from "../map/live-map";
import { OpsRail } from "./ops-rail";
import { TopBar } from "./top-bar";

export function DashboardShell({
  snapshot,
  communicationMode,
}: {
  snapshot: DashboardSnapshot;
  communicationMode: CommunicationModeConfig;
}) {
  return (
    <div className="dashboard-frame">
      <OpsRail />
      <div className="dashboard-shell">
        <TopBar
          user={snapshot.user}
          incidentCount={snapshot.incidents.length}
          communicationMode={communicationMode}
          lastScanAt={snapshot.metadata.lastScanAt}
          simulatedCallOutcome={snapshot.metadata.simulatedCallOutcome}
          watcherSourceMode={snapshot.metadata.watcherSourceMode}
        />
        <div className="dashboard-grid">
          <div className="dashboard-feed">
            <IncidentFeed incidents={snapshot.incidents} activeIncidentId={snapshot.activeCase.incidentId} />
          </div>
          <div className="dashboard-map">
            <LiveMap snapshot={snapshot} />
          </div>
          <div className="dashboard-summary">
            <CaseSummaryCard activeCase={snapshot.activeCase} communicationMode={communicationMode} />
          </div>
          <div className="dashboard-timeline">
            <CaseTimeline activeCase={snapshot.activeCase} timeline={snapshot.timeline} />
          </div>
          <div className="dashboard-graph">
            <AgentGraph activeNodes={snapshot.activeNodes} evidence={snapshot.evidence} />
          </div>
        </div>
      </div>
    </div>
  );
}
