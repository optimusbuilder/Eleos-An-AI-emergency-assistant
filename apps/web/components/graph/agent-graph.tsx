const pipeline = [
  "Watchers",
  "Normalizer",
  "Risk Engine",
  "Voice Agent",
  "Contact Action",
  "Check-In Scheduler",
];

export function AgentGraph({
  activeNodes,
  evidence,
}: {
  activeNodes: string[];
  evidence: string[];
}) {
  return (
    <section className="panel graph-panel">
      <div className="panel-header">
        <div>
          <h2>Agent Graph</h2>
          <p className="muted">System proof that Eleos is sensing, deciding, and acting.</p>
        </div>
        <span className="badge">Live chain</span>
      </div>
      <div className="panel-body stack">
        <div className="agent-graph">
          {pipeline.map((node) => (
            <div className={`agent-node ${activeNodes.includes(node) ? "active" : ""}`} key={node}>
              <span className="agent-node-dot" />
              <strong>{node}</strong>
              <span className="muted">{activeNodes.includes(node) ? "active" : "ready"}</span>
            </div>
          ))}
        </div>
        <div className="evidence-card">
          <h3>Decision Evidence</h3>
          <ul className="detail-list">
            {evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
