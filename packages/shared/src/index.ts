export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "monitoring" | "active" | "resolved";
export type IncidentConfidence = "low" | "medium" | "high";
export type IncidentType = "weather" | "road_closure" | "fire" | "flood" | "hazmat" | "shelter" | string;

export interface IncidentSource {
  id: string;
  incidentId?: string;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  rawTitle?: string;
  rawExcerpt?: string;
  publishedAt?: string;
  retrievedAt: string;
  reliabilityScore: number;
}

export type SourceRecord = IncidentSource;

export interface Incident {
  id: string;
  incidentType: IncidentType;
  title: string;
  description?: string;
  severity: Severity;
  status: IncidentStatus;
  confidence: IncidentConfidence;
  sourceCount: number;
  locationName: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  geojson?: string;
  recommendedAction?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
  sources: IncidentSource[];
}

export interface UserProfile {
  id: string;
  fullName: string;
  primaryPhone: string;
  primaryEmail?: string;
  homeLabel?: string;
  homeLat: number;
  homeLng: number;
  currentLat: number;
  currentLng: number;
  timezone: string;
  transportMode: string;
  preferredChannel: string;
  contacts: EmergencyContact[];
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  priorityOrder: number;
  notifyEnabled: boolean;
}

export type CaseState =
  | "monitoring"
  | "alert_sent"
  | "calling"
  | "in_call"
  | "awaiting_response"
  | "checkin_scheduled"
  | "resolved"
  | "unreachable"
  | "escalated";

export interface CaseRecord {
  id: string;
  userId: string;
  incidentId: string;
  riskLevel: Severity;
  state: CaseState;
  triggerReason?: string;
  distanceMeters?: number;
  routeAffected: boolean;
  initialChannel?: string;
  currentStatusSummary?: string;
  userSafetyStatus?: string;
  openedAt: string;
  lastActionAt?: string;
  resolvedAt?: string;
}

export interface CaseTimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  state: CaseState;
}

export interface InteractionRecord {
  id: string;
  caseId: string;
  interactionType: string;
  provider: string;
  providerMessageId?: string;
  direction: "inbound" | "outbound";
  deliveryStatus: string;
  startedAt: string;
  endedAt?: string;
  contentSummary?: string;
  transcript?: string;
}

export interface ActionRecord {
  id: string;
  caseId: string;
  actionType: string;
  target?: string;
  status: "pending" | "executing" | "completed" | "failed";
  resultSummary?: string;
  executedAt?: string;
  providerReference?: string;
}

export interface CheckInRecord {
  id: string;
  caseId: string;
  scheduledFor: string;
  status: "pending" | "completed" | "cancelled" | "missed" | "scheduled";
  attemptCount: number;
  lastAttemptAt?: string;
  notes?: string;
}

export interface RiskAssessment {
  incidentId: string;
  userId: string;
  decision: "ignore" | "monitor" | "alert" | "call_now";
  riskLevel: Severity;
  distanceMeters: number;
  routeAffected: boolean;
  reasons: string[];
}
