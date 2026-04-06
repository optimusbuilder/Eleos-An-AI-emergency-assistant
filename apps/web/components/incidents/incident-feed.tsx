import type { Incident } from "@eleos/shared";

export function IncidentFeed({
  incidents,
  activeIncidentId,
}: {
  incidents: Incident[];
  activeIncidentId: string;
}) {
  return (
    <aside className="panel feed-panel">
      <div className="panel-header">
        <div>
          <h2>Incident Feed</h2>
          <p className="muted">Hyper-local threat triage with emphasis on fast intervention.</p>
        </div>
        <span className="badge">Live</span>
      </div>
      <div className="panel-body stack">
        <section className="feed-priority-card">
          <span className="eyebrow">Priority Queue</span>
          <strong>Calls take precedence over passive alerts on this board.</strong>
          <p className="muted">Email fallback remains armed while SMS access is pending.</p>
        </section>
        {incidents.map((incident) => (
          <article
            className={`incident-card ${incident.id === activeIncidentId ? "active" : ""}`}
            key={incident.id}
          >
            <div className="incident-card-top">
              <span className="incident-card-type">{incident.incidentType.replaceAll("_", " ")}</span>
              <span className={`badge ${incident.severity}`}>{incident.severity}</span>
            </div>
            <strong>{incident.title}</strong>
            <div className="card-row muted">
              <span>{incident.locationName}</span>
              <span>{incident.sourceCount} sources</span>
            </div>
            <p className="incident-copy">{incident.recommendedAction}</p>
            <div className="incident-card-footer">
              <span className="badge">{incident.confidence} confidence</span>
              <span className="incident-updated">Updated {incident.lastSeenAt}</span>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
