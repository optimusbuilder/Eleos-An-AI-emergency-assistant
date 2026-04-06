import type {
  ActionRecord,
  CaseRecord,
  CaseState,
  CaseTimelineEvent,
  CheckInRecord,
  Incident,
  InteractionRecord,
  RiskAssessment,
  UserProfile,
} from "@eleos/shared";
import type { CommunicationsProvider, EmailResult } from "../actions/communications";
import type {
  ActionRepository,
  CaseRepository,
  CheckInRepository,
  InteractionRepository,
} from "../db/repositories";

export interface OrchestratedCaseResult {
  caseRecord: CaseRecord;
  timeline: CaseTimelineEvent[];
  actionRecords: ActionRecord[];
  checkIns: CheckInRecord[];
  interactions: InteractionRecord[];
}

function buildCaseId(incidentId: string, userId: string) {
  return `case_${incidentId}_${userId}`;
}

function createTimelineEvent(input: {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  state: CaseState;
}): CaseTimelineEvent {
  return input;
}

function buildActionRecord(input: {
  id: string;
  caseId: string;
  actionType: ActionRecord["actionType"];
  target: string;
  resultSummary: string;
  providerReference?: string;
  status?: ActionRecord["status"];
  executedAt: string;
}): ActionRecord {
  return {
    id: input.id,
    caseId: input.caseId,
    actionType: input.actionType,
    target: input.target,
    status: input.status ?? "completed",
    resultSummary: input.resultSummary,
    providerReference: input.providerReference,
    executedAt: input.executedAt,
  };
}

function buildCheckInRecord(input: {
  id: string;
  caseId: string;
  scheduledFor: string;
  notes: string;
  status?: CheckInRecord["status"];
}): CheckInRecord {
  return {
    id: input.id,
    caseId: input.caseId,
    scheduledFor: input.scheduledFor,
    status: input.status ?? "scheduled",
    attemptCount: 0,
    notes: input.notes,
  };
}

function buildInteractionRecord(input: {
  id: string;
  caseId: string;
  interactionType: InteractionRecord["interactionType"];
  provider: string;
  providerMessageId?: string;
  deliveryStatus: InteractionRecord["deliveryStatus"];
  startedAt: string;
  endedAt?: string;
  contentSummary: string;
  transcript?: string;
}): InteractionRecord {
  return {
    id: input.id,
    caseId: input.caseId,
    interactionType: input.interactionType,
    provider: input.provider,
    providerMessageId: input.providerMessageId,
    direction: "outbound",
    deliveryStatus: input.deliveryStatus,
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? input.startedAt,
    contentSummary: input.contentSummary,
    transcript: input.transcript,
  };
}

function buildTriggerReason(risk: RiskAssessment) {
  return risk.reasons.slice(0, 3).join(" ");
}

function buildStatusSummary(params: {
  decision: RiskAssessment["decision"];
  incident: Incident;
  caseState: CaseState;
}) {
  const { decision, incident, caseState } = params;

  if (decision === "call_now" && caseState === "checkin_scheduled") {
    return `Call answered. ${incident.incidentType.replaceAll("_", " ")} guidance delivered and follow-up scheduled.`;
  }

  if (decision === "call_now" && caseState === "awaiting_response") {
    return `Call was not completed. Email fallback sent and Eleos is awaiting a response.`;
  }

  if (decision === "call_now" && caseState === "unreachable") {
    return "Direct contact failed. Email fallback sent and a retry call is queued.";
  }

  switch (decision) {
    case "call_now":
      return `Calling now with ${incident.incidentType.replaceAll("_", " ")} guidance and a scheduled follow-up check.`;
    case "alert":
      return `Alert sent with ${incident.incidentType.replaceAll("_", " ")} guidance and follow-up scheduled.`;
    case "monitor":
      return "Monitoring this incident while waiting for stronger confirmation or closer impact.";
    case "ignore":
      return "Logged for awareness but below the threshold for direct outreach.";
  }
}

function getScheduledTime(now: Date, minutesAhead: number) {
  return new Date(now.getTime() + minutesAhead * 60_000).toISOString();
}

async function sendFallbackEmail(params: {
  caseId: string;
  user: UserProfile;
  incident: Incident;
  communications: CommunicationsProvider;
  timestamp: string;
}) {
  const { caseId, user, incident, communications, timestamp } = params;

  if (!user.primaryEmail) {
    return null;
  }

  const emailResult: EmailResult = await communications.sendEmail({
    to: user.primaryEmail,
    subject: `Eleos alert: ${incident.title}`,
    message: incident.recommendedAction,
  });

  return {
    action: buildActionRecord({
      id: `${caseId}_send_email`,
      caseId,
      actionType: "send_email",
      target: user.primaryEmail,
      resultSummary: "Fallback email sent with the current safety instruction.",
      providerReference: emailResult.providerReference,
      executedAt: timestamp,
      status: emailResult.deliveryStatus === "sent" ? "completed" : "failed",
    }),
    interaction: buildInteractionRecord({
      id: `${caseId}_interaction_email`,
      caseId,
      interactionType: "email",
      provider: emailResult.provider,
      providerMessageId: emailResult.providerReference,
      deliveryStatus: emailResult.deliveryStatus,
      startedAt: timestamp,
      contentSummary: emailResult.contentSummary,
    }),
  };
}

export async function orchestrateAlert(params: {
  incident: Incident;
  risk: RiskAssessment;
  user: UserProfile;
  communications: CommunicationsProvider;
  caseRepository: CaseRepository;
  actionRepository: ActionRepository;
  interactionRepository: InteractionRepository;
  checkInRepository: CheckInRepository;
  now?: Date;
}) {
  const {
    incident,
    risk,
    user,
    communications,
    caseRepository,
    actionRepository,
    interactionRepository,
    checkInRepository,
    now = new Date(),
  } = params;

  const timestamp = now.toISOString();
  const caseId = buildCaseId(incident.id, user.id);
  const timeline: CaseTimelineEvent[] = [
    createTimelineEvent({
      id: `${caseId}_opened`,
      timestamp,
      title: "Case opened",
      detail: buildTriggerReason(risk),
      state: "monitoring",
    }),
  ];

  const actionRecords: ActionRecord[] = [];
  const interactions: InteractionRecord[] = [];
  const checkIns: CheckInRecord[] = [];

  let state: CaseState = "monitoring";
  let initialChannel: CaseRecord["initialChannel"] = "email";
  let lastActionAt = timestamp;

  if (risk.decision === "call_now") {
    const callResult = await communications.placeCall({
      to: user.primaryPhone,
      summary: `${incident.title} near ${user.homeLabel}. First action: ${incident.recommendedAction}`,
    });

    actionRecords.push(
      buildActionRecord({
        id: `${caseId}_place_call`,
        caseId,
        actionType: "place_call",
        target: user.primaryPhone,
        resultSummary: `Outbound safety call ${callResult.outcome}.`,
        providerReference: callResult.providerReference,
        executedAt: timestamp,
        status: callResult.outcome === "failed" ? "failed" : "completed",
      }),
    );
    interactions.push(
      buildInteractionRecord({
        id: `${caseId}_interaction_call`,
        caseId,
        interactionType: callResult.outcome === "voicemail" ? "voicemail" : "call",
        provider: callResult.provider,
        providerMessageId: callResult.providerReference,
        deliveryStatus: callResult.outcome,
        startedAt: timestamp,
        contentSummary: callResult.contentSummary,
        transcript: callResult.transcript,
      }),
    );
    initialChannel = "call";

    if (callResult.outcome === "answered") {
      state = "checkin_scheduled";
      const scheduledCheckIn = buildCheckInRecord({
        id: `${caseId}_checkin_answered`,
        caseId,
        scheduledFor: getScheduledTime(now, 20),
        notes: "User answered the call. Follow up to confirm they remain safe.",
      });
      checkIns.push(scheduledCheckIn);
      actionRecords.push(
        buildActionRecord({
          id: `${caseId}_schedule_checkin`,
          caseId,
          actionType: "schedule_checkin",
          target: user.primaryPhone,
          resultSummary: "Follow-up check-in scheduled after a successful call.",
          status: "pending",
          executedAt: timestamp,
        }),
      );
      timeline.push(
        createTimelineEvent({
          id: `${caseId}_answered`,
          timestamp,
          title: "Call answered",
          detail: "The user answered the call and Eleos delivered the first safety instruction.",
          state,
        }),
        createTimelineEvent({
          id: `${caseId}_checkin_scheduled`,
          timestamp,
          title: "Check-in scheduled",
          detail: "A follow-up check-in was scheduled after the completed conversation.",
          state,
        }),
      );
    } else if (callResult.outcome === "queued") {
      state = "calling";
      timeline.push(
        createTimelineEvent({
          id: `${caseId}_queued`,
          timestamp,
          title: "Call queued",
          detail: "The outbound call was accepted by the provider and is currently in progress or queued.",
          state,
        }),
      );
    } else if (callResult.outcome === "missed") {
      state = "awaiting_response";
      const fallbackEmail = await sendFallbackEmail({
        caseId,
        user,
        incident,
        communications,
        timestamp,
      });
      if (fallbackEmail) {
        actionRecords.push(fallbackEmail.action);
        interactions.push(fallbackEmail.interaction);
      }
      actionRecords.push(
        buildActionRecord({
          id: `${caseId}_retry_call`,
          caseId,
          actionType: "place_followup_call",
          target: user.primaryPhone,
          resultSummary: "Retry call queued because the first call was missed.",
          status: "pending",
          executedAt: timestamp,
        }),
      );
      timeline.push(
        createTimelineEvent({
          id: `${caseId}_missed`,
          timestamp,
          title: "Call missed",
          detail: "The user did not answer. Email fallback was sent and a retry call was queued.",
          state,
        }),
      );
    } else if (callResult.outcome === "voicemail") {
      state = "awaiting_response";
      const fallbackEmail = await sendFallbackEmail({
        caseId,
        user,
        incident,
        communications,
        timestamp,
      });
      if (fallbackEmail) {
        actionRecords.push(fallbackEmail.action);
        interactions.push(fallbackEmail.interaction);
      }
      timeline.push(
        createTimelineEvent({
          id: `${caseId}_voicemail`,
          timestamp,
          title: "Voicemail reached",
          detail: "A short voicemail was left and the full safety brief was sent by email.",
          state,
        }),
      );
    } else {
      state = "unreachable";
      const fallbackEmail = await sendFallbackEmail({
        caseId,
        user,
        incident,
        communications,
        timestamp,
      });
      if (fallbackEmail) {
        actionRecords.push(fallbackEmail.action);
        interactions.push(fallbackEmail.interaction);
      }
      actionRecords.push(
        buildActionRecord({
          id: `${caseId}_followup_call`,
          caseId,
          actionType: "place_followup_call",
          target: user.primaryPhone,
          resultSummary: "Another call attempt was queued after the initial failure.",
          status: "pending",
          executedAt: timestamp,
        }),
      );
      timeline.push(
        createTimelineEvent({
          id: `${caseId}_failed`,
          timestamp,
          title: "Call failed",
          detail: "The call failed before connecting. Email fallback was sent and a retry call was queued.",
          state,
        }),
      );
    }
  } else if (risk.decision === "alert") {
    if (user.primaryEmail) {
      const emailResult = await communications.sendEmail({
        to: user.primaryEmail,
        subject: `Eleos alert: ${incident.title}`,
        message: incident.recommendedAction,
      });

      initialChannel = "email";
      state = "alert_sent";
      actionRecords.push(
        buildActionRecord({
          id: `${caseId}_send_email`,
          caseId,
          actionType: "send_email",
          target: user.primaryEmail,
          resultSummary: "Email alert sent for the active incident.",
          providerReference: emailResult.providerReference,
          executedAt: timestamp,
          status: emailResult.deliveryStatus === "sent" ? "completed" : "failed",
        }),
        buildActionRecord({
          id: `${caseId}_schedule_checkin`,
          caseId,
          actionType: "schedule_checkin",
          target: user.primaryEmail,
          resultSummary: "Follow-up check scheduled for the active alert case.",
          status: "pending",
          executedAt: timestamp,
        }),
      );
      interactions.push(
        buildInteractionRecord({
          id: `${caseId}_interaction_email`,
          caseId,
          interactionType: "email",
          provider: emailResult.provider,
          providerMessageId: emailResult.providerReference,
          deliveryStatus: emailResult.deliveryStatus,
          startedAt: timestamp,
          contentSummary: emailResult.contentSummary,
        }),
      );
      checkIns.push(
        buildCheckInRecord({
          id: `${caseId}_checkin_alert`,
          caseId,
          scheduledFor: getScheduledTime(now, 30),
          notes: "Follow up on the email alert if the incident remains active.",
        }),
      );
    } else {
      initialChannel = "call";
      state = "calling";
      const callResult = await communications.placeCall({
        to: user.primaryPhone,
        summary: `${incident.title} near ${user.homeLabel}. First action: ${incident.recommendedAction}`,
      });
      actionRecords.push(
        buildActionRecord({
          id: `${caseId}_fallback_call`,
          caseId,
          actionType: "place_call",
          target: user.primaryPhone,
          resultSummary: "Call placed because no email fallback address was available.",
          providerReference: callResult.providerReference,
          executedAt: timestamp,
          status: callResult.outcome === "failed" ? "failed" : "completed",
        }),
      );
      interactions.push(
        buildInteractionRecord({
          id: `${caseId}_interaction_call`,
          caseId,
          interactionType: "call",
          provider: callResult.provider,
          providerMessageId: callResult.providerReference,
          deliveryStatus: callResult.outcome,
          startedAt: timestamp,
          contentSummary: callResult.contentSummary,
          transcript: callResult.transcript,
        }),
      );
    }

    timeline.push(
      createTimelineEvent({
        id: `${caseId}_alert_sent`,
        timestamp,
        title: "Alert dispatched",
        detail: "The incident met the alert threshold and guidance was sent through the configured fallback channel.",
        state,
      }),
    );
  } else if (risk.decision === "monitor") {
    state = "monitoring";
    initialChannel = "email";
    timeline.push(
      createTimelineEvent({
        id: `${caseId}_monitoring`,
        timestamp,
        title: "Monitoring only",
        detail: "The incident remains below direct-outreach thresholds but is retained for watchful tracking.",
        state,
      }),
    );
  } else {
    state = "monitoring";
    initialChannel = "email";
    timeline.push(
      createTimelineEvent({
        id: `${caseId}_ignore`,
        timestamp,
        title: "Below action threshold",
        detail: "The incident was logged for awareness but is too distant or uncertain for outreach.",
        state,
      }),
    );
  }

  const caseRecord: CaseRecord = {
    id: caseId,
    userId: user.id,
    incidentId: incident.id,
    riskLevel: risk.riskLevel,
    state,
    triggerReason: buildTriggerReason(risk),
    distanceMeters: risk.distanceMeters,
    routeAffected: risk.routeAffected,
    initialChannel,
    currentStatusSummary: buildStatusSummary({
      decision: risk.decision,
      incident,
      caseState: state,
    }),
    userSafetyStatus: "unknown",
    openedAt: timestamp,
    lastActionAt,
  };

  await caseRepository.save(caseRecord);
  for (const action of actionRecords) {
    await actionRepository.save(action);
  }
  for (const interaction of interactions) {
    await interactionRepository.save(interaction);
  }
  for (const checkIn of checkIns) {
    await checkInRepository.save(checkIn);
  }

  return {
    caseRecord,
    timeline,
    actionRecords,
    checkIns,
    interactions,
  } satisfies OrchestratedCaseResult;
}
