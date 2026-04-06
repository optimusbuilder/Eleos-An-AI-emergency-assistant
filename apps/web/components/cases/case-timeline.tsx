import type { CaseRecord, CaseTimelineEvent } from "@eleos/shared";

export function CaseTimeline({
  activeCase,
  timeline,
}: {
  activeCase: CaseRecord;
  timeline: CaseTimelineEvent[];
}) {
  return (
    <section className="bottom-drawer">
      <div className="bottom-drawer-summary">
        <div>
          <span className="eyebrow">Case Timeline</span>
          <strong>Case Active</strong>
          <p className="muted">{activeCase.currentStatusSummary}</p>
        </div>
        <span className="badge">{activeCase.state}</span>
      </div>
      <div className="panel-body timeline">
        {timeline.map((event) => (
          <article className="timeline-event" key={event.id}>
            <time>{event.timestamp}</time>
            <div>
              <strong>{event.title}</strong>
              <p className="muted">{event.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
