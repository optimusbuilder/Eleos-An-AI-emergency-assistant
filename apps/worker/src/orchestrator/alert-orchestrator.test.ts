import assert from "node:assert/strict";
import test from "node:test";
import type { Incident, UserProfile } from "@eleos/shared";
import { createCommunicationsProvider } from "../actions/communications";
import {
  InMemoryActionRepository,
  InMemoryCaseRepository,
  InMemoryCheckInRepository,
  InMemoryInteractionRepository,
} from "../db/repositories";
import { orchestrateAlert } from "./alert-orchestrator";
import { scoreIncidentForUser } from "../risk/risk-engine";

const user: UserProfile = {
  id: "user_oluwa",
  fullName: "Oluwa",
  primaryPhone: "+1 555-555-0101",
  primaryEmail: "oluwa@example.com",
  homeLabel: "Washington, DC",
  homeLat: 38.9072,
  homeLng: -77.0369,
  currentLat: 38.9091,
  currentLng: -77.0417,
  timezone: "America/New_York",
  transportMode: "car",
  preferredChannel: "call",
  contacts: [],
};

function buildIncident(input: Partial<Incident> & Pick<Incident, "id" | "incidentType" | "title">): Incident {
  return {
    id: input.id,
    incidentType: input.incidentType,
    title: input.title,
    description: input.description ?? `${input.title} incident fixture`,
    severity: input.severity ?? "medium",
    status: input.status ?? "active",
    confidence: input.confidence ?? "medium",
    sourceCount: input.sourceCount ?? 1,
    locationName: input.locationName ?? "Washington, DC",
    centerLat: input.centerLat ?? 38.9132,
    centerLng: input.centerLng ?? -77.0386,
    radiusMeters: input.radiusMeters ?? 3200,
    recommendedAction: input.recommendedAction ?? "Follow the recommended safety step.",
    firstSeenAt: input.firstSeenAt ?? "2026-03-21T00:45:00Z",
    lastSeenAt: input.lastSeenAt ?? "2026-03-21T00:55:00Z",
    sources: input.sources ?? [],
  };
}

test("risk engine and orchestrator stay deterministic across fixed scenarios", async () => {
  const now = new Date("2026-03-21T01:00:00Z");
  const communications = createCommunicationsProvider(true);

  const scenarios = [
    {
      label: "nearby high severity incident triggers a call",
      incident: buildIncident({
        id: "incident_call_now",
        incidentType: "weather",
        title: "Severe Thunderstorm Warning",
        severity: "high",
        confidence: "high",
        centerLat: 38.9132,
        centerLng: -77.0386,
        recommendedAction: "Move indoors immediately.",
      }),
      expectedDecision: "call_now",
      expectedState: "checkin_scheduled",
      expectedActionTypes: ["place_call", "schedule_checkin"],
    },
    {
      label: "mid-range official closure triggers an alert",
      incident: buildIncident({
        id: "incident_alert",
        incidentType: "road_closure",
        title: "Connector Road Closure",
        severity: "medium",
        confidence: "medium",
        centerLat: 38.9289,
        centerLng: -77.0418,
        radiusMeters: 1500,
        recommendedAction: "Avoid the connector and use the bypass.",
      }),
      expectedDecision: "alert",
      expectedState: "alert_sent",
      expectedActionTypes: ["send_email", "schedule_checkin"],
    },
    {
      label: "low-confidence distant incident is ignored",
      incident: buildIncident({
        id: "incident_ignore",
        incidentType: "weather",
        title: "Unconfirmed storm report",
        severity: "low",
        confidence: "low",
        centerLat: 39.28,
        centerLng: -76.62,
        lastSeenAt: "2026-03-20T18:00:00Z",
      }),
      expectedDecision: "ignore",
      expectedState: "monitoring",
      expectedActionTypes: [],
    },
  ] as const;

  for (const scenario of scenarios) {
    const risk = scoreIncidentForUser(scenario.incident, user, now);
    assert.equal(risk.decision, scenario.expectedDecision, scenario.label);
    assert.ok(risk.reasons.length >= 3, `${scenario.label} should provide a human-readable reason set`);

    const caseRepository = new InMemoryCaseRepository();
    const actionRepository = new InMemoryActionRepository();
    const interactionRepository = new InMemoryInteractionRepository();
    const checkInRepository = new InMemoryCheckInRepository();

    const result = await orchestrateAlert({
      incident: scenario.incident,
      risk,
      user,
      communications,
      caseRepository,
      actionRepository,
      interactionRepository,
      checkInRepository,
      now,
    });

    assert.equal(result.caseRecord.state, scenario.expectedState, scenario.label);
    assert.ok(result.caseRecord.triggerReason.includes("Incident severity"), `${scenario.label} should summarize the trigger`);
    assert.deepEqual(
      result.actionRecords.map((action) => action.actionType),
      scenario.expectedActionTypes,
      scenario.label,
    );
    assert.ok(result.interactions.length >= (scenario.expectedActionTypes.length ? 1 : 0));
    assert.ok(result.timeline.length >= 2, `${scenario.label} should log state transitions`);
  }
});
