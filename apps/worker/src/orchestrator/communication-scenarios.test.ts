import assert from "node:assert/strict";
import test from "node:test";
import type { Incident, UserProfile } from "@eleos/shared";
import { createCommunicationsProvider, type CallOutcome } from "../actions/communications";
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

const incident: Incident = {
  id: "incident_phase4_call",
  incidentType: "weather",
  title: "Severe Thunderstorm Warning",
  description: "Fast-moving storm approaching the monitored area.",
  severity: "high",
  status: "active",
  confidence: "high",
  sourceCount: 2,
  locationName: "Central Washington, DC",
  centerLat: 38.9132,
  centerLng: -77.0386,
  radiusMeters: 3200,
  recommendedAction: "Move indoors immediately and stay away from windows.",
  firstSeenAt: "2026-03-21T00:54:00Z",
  lastSeenAt: "2026-03-21T00:58:00Z",
  sources: [],
};

const expectations: Record<
  CallOutcome,
  {
    state: string;
    actionTypes: string[];
    interactionStatuses: string[];
    checkIns: number;
  }
> = {
  answered: {
    state: "checkin_scheduled",
    actionTypes: ["place_call", "schedule_checkin"],
    interactionStatuses: ["answered"],
    checkIns: 1,
  },
  queued: {
    state: "calling",
    actionTypes: ["place_call"],
    interactionStatuses: ["queued"],
    checkIns: 0,
  },
  missed: {
    state: "awaiting_response",
    actionTypes: ["place_call", "send_email", "place_followup_call"],
    interactionStatuses: ["missed", "sent"],
    checkIns: 0,
  },
  voicemail: {
    state: "awaiting_response",
    actionTypes: ["place_call", "send_email"],
    interactionStatuses: ["voicemail", "sent"],
    checkIns: 0,
  },
  failed: {
    state: "unreachable",
    actionTypes: ["place_call", "send_email", "place_followup_call"],
    interactionStatuses: ["failed", "sent"],
    checkIns: 0,
  },
};

test("call scenarios branch correctly for answered, missed, voicemail, and failed outcomes", async () => {
  const now = new Date("2026-03-21T01:00:00Z");
  const risk = scoreIncidentForUser(incident, user, now);

  assert.equal(risk.decision, "call_now");

  for (const outcome of ["answered", "queued", "missed", "voicemail", "failed"] as const) {
    const communications = createCommunicationsProvider(true, { callOutcome: outcome });
    const caseRepository = new InMemoryCaseRepository();
    const actionRepository = new InMemoryActionRepository();
    const interactionRepository = new InMemoryInteractionRepository();
    const checkInRepository = new InMemoryCheckInRepository();

    const result = await orchestrateAlert({
      incident,
      risk,
      user,
      communications,
      caseRepository,
      actionRepository,
      interactionRepository,
      checkInRepository,
      now,
    });

    assert.equal(result.caseRecord.state, expectations[outcome].state, outcome);
    assert.deepEqual(
      result.actionRecords.map((action) => action.actionType),
      expectations[outcome].actionTypes,
      outcome,
    );
    assert.deepEqual(
      result.interactions.map((interaction) => interaction.deliveryStatus),
      expectations[outcome].interactionStatuses,
      outcome,
    );
    assert.equal(result.checkIns.length, expectations[outcome].checkIns, outcome);
  }
});
