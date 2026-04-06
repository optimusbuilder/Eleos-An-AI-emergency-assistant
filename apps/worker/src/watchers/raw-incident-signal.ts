import type { IncidentStatus, IncidentType, Severity, SourceRecord } from "@eleos/shared";

export interface RawIncidentSignal {
  id: string;
  watcherId: string;
  title: string;
  excerpt: string;
  locationName: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  source: SourceRecord;
  incidentTypeHint?: IncidentType;
  severityHint?: Severity;
  status?: IncidentStatus;
  recommendedAction?: string;
  incidentKey?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
}
