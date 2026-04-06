import type { CaseRecord } from "@eleos/shared";
import type { CommunicationModeConfig } from "@eleos/config";

export function CaseSummaryCard({
  activeCase,
  communicationMode,
}: {
  activeCase: CaseRecord;
  communicationMode: CommunicationModeConfig;
}) {
  return (
    <section className="panel summary-panel">
      <div className="panel-header">
        <div>
          <h2>Case Summary</h2>
          <p className="muted">Decision snapshot for the active incident-user case.</p>
        </div>
        <span className={`badge ${activeCase.riskLevel}`}>{activeCase.riskLevel}</span>
      </div>
      <div className="panel-body stack">
        <section className="summary-hero">
          <span className="eyebrow">Current Move</span>
          <strong>{activeCase.state.replaceAll("_", " ")}</strong>
          <p className="muted">{activeCase.currentStatusSummary}</p>
        </section>
        <div className="summary-grid">
          <div className="summary-card">
            <span className="muted">User Status</span>
            <strong>{activeCase.userSafetyStatus.replaceAll("_", " ")}</strong>
            <span className="muted">{Math.round(activeCase.distanceMeters / 1000)} km from hazard center</span>
          </div>
          <div className="summary-card">
            <span className="muted">Primary Reach</span>
            <strong>{activeCase.initialChannel}</strong>
            <span className="muted">Fallback via {communicationMode.fallbackChannel}</span>
          </div>
        </div>
        <ul className="detail-list">
          <li>Trigger: {activeCase.triggerReason}</li>
          <li>Fallback channel: {communicationMode.fallbackChannel}</li>
          <li>Operations mode: {communicationMode.summary}</li>
          <li>Route affected: {activeCase.routeAffected ? "Yes" : "No"}</li>
          <li>Last action: {activeCase.lastActionAt}</li>
        </ul>
      </div>
    </section>
  );
}
