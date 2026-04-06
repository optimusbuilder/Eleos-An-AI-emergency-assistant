import { unstable_noStore as noStore } from "next/cache";
import { buildDashboardSnapshot } from "../../../lib/dashboard-snapshot";
import { CaseTimeline } from "../../../components/cases/case-timeline";
import { AgentGraph } from "../../../components/graph/agent-graph";

export default async function CasesPage() {
  noStore();
  const snapshot = await buildDashboardSnapshot();

  return (
    <div className="dashboard-grid cases-grid">
      <div className="dashboard-timeline">
        <CaseTimeline activeCase={snapshot.activeCase} timeline={snapshot.timeline} />
      </div>
      <div className="dashboard-graph">
        <AgentGraph activeNodes={snapshot.activeNodes} evidence={snapshot.evidence} />
      </div>
    </div>
  );
}
