import type { UserProfile } from "@eleos/shared";
import type { CommunicationModeConfig } from "@eleos/config";

export function TopBar({
  user,
  incidentCount,
  communicationMode,
  lastScanAt,
  simulatedCallOutcome,
  watcherSourceMode,
}: {
  user: UserProfile;
  incidentCount: number;
  communicationMode: CommunicationModeConfig;
  lastScanAt: string;
  simulatedCallOutcome: string;
  watcherSourceMode: string;
}) {

  return (
    <header className="top-bar">
      <div className="brand">
        <span className="eyebrow">Eleos Command Grid</span>
        <h1>{user.homeLabel}</h1>
        <p>{user.fullName} is the monitored user for this active board.</p>
        <p className="top-bar-note">{communicationMode.note}</p>
      </div>

      <div className="top-bar-status">
        <span className="status-pill">
          <span className="status-dot" />
          Watchers Online
        </span>
        <span className="status-pill">
          <span className="status-dot" />
          Voice Ready
        </span>
        <span className="status-pill status-pill-comm">
          {communicationMode.summary}
        </span>
        <span className="status-pill">Last scan {lastScanAt}</span>
        <span className="status-pill">Scenario {simulatedCallOutcome}</span>
        <span className="status-pill">Watchers {watcherSourceMode}</span>
        <span className="status-pill">{incidentCount} Active Incident{incidentCount === 1 ? "" : "s"}</span>
      </div>
      <div className="top-bar-search">
        <button className="top-bar-action" type="button">
          Region Locked
        </button>
        <input aria-label="Search incidents or places" defaultValue="Washington, DC" />
      </div>
    </header>
  );
}
