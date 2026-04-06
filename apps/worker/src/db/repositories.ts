import type {
  ActionRecord,
  CaseRecord,
  CheckInRecord,
  Incident,
  IncidentConfidence,
  InteractionRecord,
  Severity,
  UserProfile,
} from "@eleos/shared";
import { readWorkerEnv } from "../config/env";
import { pickHigherSeverity } from "../normalizers/incident-normalizer";

const confidenceRank: Record<IncidentConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const severityRank: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export interface IncidentRepository {
  save(incident: Incident): Promise<Incident>;
  list(): Promise<Incident[]>;
}

export interface UserRepository {
  getPrimaryUser(): Promise<UserProfile>;
}

export interface CaseRepository {
  save(caseRecord: CaseRecord): Promise<CaseRecord>;
  list(): Promise<CaseRecord[]>;
}

export interface ActionRepository {
  save(action: ActionRecord): Promise<ActionRecord>;
  list(): Promise<ActionRecord[]>;
}

export interface InteractionRepository {
  save(interaction: InteractionRecord): Promise<InteractionRecord>;
  list(): Promise<InteractionRecord[]>;
}

export interface CheckInRepository {
  save(checkIn: CheckInRecord): Promise<CheckInRecord>;
  list(): Promise<CheckInRecord[]>;
}

function earliestTimestamp(left: string, right: string) {
  return new Date(left).getTime() <= new Date(right).getTime() ? left : right;
}

function latestTimestamp(left: string, right: string) {
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function pickHigherConfidence(left: IncidentConfidence, right: IncidentConfidence): IncidentConfidence {
  return confidenceRank[left] >= confidenceRank[right] ? left : right;
}

function choosePreferredText(existing: string, incoming: string, preferIncoming: boolean) {
  return preferIncoming && incoming ? incoming : existing;
}

function mergeIncidentRecords(existing: Incident, incoming: Incident): Incident {
  const sourceMap = new Map(existing.sources.map((source) => [source.id, source]));
  for (const source of incoming.sources) {
    sourceMap.set(source.id, source);
  }

  const preferIncomingText =
    confidenceRank[incoming.confidence] > confidenceRank[existing.confidence] ||
    severityRank[incoming.severity] > severityRank[existing.severity];

  return {
    ...existing,
    title: choosePreferredText(existing.title, incoming.title, preferIncomingText),
    description: choosePreferredText(existing.description, incoming.description, preferIncomingText),
    severity: pickHigherSeverity(existing.severity, incoming.severity),
    status: incoming.status === "active" ? "active" : existing.status,
    confidence: pickHigherConfidence(existing.confidence, incoming.confidence),
    locationName: choosePreferredText(existing.locationName, incoming.locationName, preferIncomingText),
    centerLat: incoming.centerLat,
    centerLng: incoming.centerLng,
    radiusMeters: Math.max(existing.radiusMeters, incoming.radiusMeters),
    recommendedAction: choosePreferredText(
      existing.recommendedAction,
      incoming.recommendedAction,
      preferIncomingText,
    ),
    firstSeenAt: earliestTimestamp(existing.firstSeenAt, incoming.firstSeenAt),
    lastSeenAt: latestTimestamp(existing.lastSeenAt, incoming.lastSeenAt),
    sourceCount: sourceMap.size,
    sources: Array.from(sourceMap.values()),
  };
}

export class InMemoryIncidentRepository implements IncidentRepository {
  private readonly incidents = new Map<string, Incident>();

  async save(incident: Incident) {
    const existing = this.incidents.get(incident.id);
    const nextRecord = existing ? mergeIncidentRecords(existing, incident) : incident;
    this.incidents.set(incident.id, nextRecord);
    return nextRecord;
  }

  async list() {
    return Array.from(this.incidents.values());
  }
}

export class InMemoryUserRepository implements UserRepository {
  async getPrimaryUser(): Promise<UserProfile> {
    const env = readWorkerEnv();

    return {
      id: "user_oluwa",
      fullName: env.primaryUserName,
      primaryPhone: env.primaryUserPhone,
      primaryEmail: env.primaryUserEmail,
      homeLabel: env.primaryUserHomeLabel,
      homeLat: env.primaryUserHomeLat,
      homeLng: env.primaryUserHomeLng,
      currentLat: env.primaryUserCurrentLat,
      currentLng: env.primaryUserCurrentLng,
      timezone: "America/New_York",
      transportMode: "car",
      preferredChannel: "call",
      contacts: [],
    };
  }
}

export class InMemoryCaseRepository implements CaseRepository {
  private readonly caseRecords = new Map<string, CaseRecord>();

  async save(caseRecord: CaseRecord) {
    this.caseRecords.set(caseRecord.id, caseRecord);
    return caseRecord;
  }

  async list() {
    return Array.from(this.caseRecords.values());
  }
}

export class InMemoryActionRepository implements ActionRepository {
  private readonly actions: ActionRecord[] = [];

  async save(action: ActionRecord) {
    this.actions.push(action);
    return action;
  }

  async list() {
    return [...this.actions];
  }
}

export class InMemoryInteractionRepository implements InteractionRepository {
  private readonly interactions: InteractionRecord[] = [];

  async save(interaction: InteractionRecord) {
    this.interactions.push(interaction);
    return interaction;
  }

  async list() {
    return [...this.interactions];
  }
}

export class InMemoryCheckInRepository implements CheckInRepository {
  private readonly checkIns: CheckInRecord[] = [];

  async save(checkIn: CheckInRecord) {
    this.checkIns.push(checkIn);
    return checkIn;
  }

  async list() {
    return [...this.checkIns];
  }
}
