import type {
  CaseRecord,
  CaseTimelineEvent,
  Incident,
  UserProfile,
} from "@eleos/shared";
import type { DashboardSnapshot } from "./dashboard-snapshot";

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
  contacts: [
    {
      id: "contact_1",
      name: "Primary Emergency Contact",
      phone: "+1 555-555-0102",
      email: "contact@example.com",
      relationship: "Family",
      priorityOrder: 1,
      notifyEnabled: true,
    },
  ],
};

const incidents: Incident[] = [
  {
    id: "incident_weather_1",
    incidentType: "weather",
    title: "Severe Thunderstorm Warning",
    description: "A fast-moving line of storms is crossing the District with damaging wind potential.",
    severity: "high",
    status: "active",
    confidence: "high",
    sourceCount: 3,
    locationName: "Central Washington, DC",
    centerLat: 38.9132,
    centerLng: -77.0386,
    radiusMeters: 3000,
    recommendedAction: "Move indoors now, stay away from windows, and avoid travel until the storm cell passes the District.",
    firstSeenAt: "8:41 PM",
    lastSeenAt: "8:44 PM",
    sources: [
      {
        id: "source_nws_1",
        sourceType: "official",
        sourceName: "NWS Baltimore/Washington",
        sourceUrl: "https://example.com/nws/dc",
        rawTitle: "Severe Thunderstorm Warning",
        rawExcerpt: "Damaging wind gusts possible across central Washington, DC.",
        publishedAt: "2026-03-21T00:41:00Z",
        retrievedAt: "2026-03-21T00:42:00Z",
        reliabilityScore: 1,
      },
    ],
  },
  {
    id: "incident_road_1",
    incidentType: "road_closure",
    title: "Road Closure Near Rock Creek Parkway",
    description: "Storm debris has closed a key commuter route near Dupont Circle.",
    severity: "medium",
    status: "active",
    confidence: "medium",
    sourceCount: 2,
    locationName: "Rock Creek Parkway",
    centerLat: 38.9145,
    centerLng: -77.0458,
    radiusMeters: 1500,
    recommendedAction: "Avoid Rock Creek Parkway and use alternate downtown routes if travel is necessary.",
    firstSeenAt: "8:38 PM",
    lastSeenAt: "8:43 PM",
    sources: [],
  },
];

const activeCase: CaseRecord = {
  id: "case_1",
  userId: user.id,
  incidentId: incidents[0].id,
  riskLevel: "high",
  state: "calling",
  triggerReason: "User is within the primary warning radius and the incident is source-verified.",
  distanceMeters: 1800,
  routeAffected: true,
  initialChannel: "call",
  currentStatusSummary: "Calling now with shelter guidance and email fallback prepared.",
  userSafetyStatus: "unknown",
  openedAt: "8:42 PM",
  lastActionAt: "8:43 PM",
};

const timeline: CaseTimelineEvent[] = [
  {
    id: "event_1",
    timestamp: "8:41 PM",
    title: "Warning detected",
    detail: "Watcher ingested a new NWS Baltimore/Washington warning and normalized it into an incident.",
    state: "monitoring",
  },
  {
    id: "event_2",
    timestamp: "8:42 PM",
    title: "Risk matched to user",
    detail: "Risk engine marked the incident as relevant based on radius, severity, and user location.",
    state: "alert_sent",
  },
  {
    id: "event_3",
    timestamp: "8:43 PM",
    title: "Voice call initiated",
    detail: "Twilio adapter selected the user's phone channel and prepared the ElevenLabs crisis brief.",
    state: "calling",
  },
  {
    id: "event_4",
    timestamp: "8:44 PM",
    title: "Email fallback armed",
    detail: "Mock communications layer queued a fallback email with indoor shelter guidance.",
    state: "awaiting_response",
  },
];

export const demoDashboardSnapshot: DashboardSnapshot = {
  user,
  incidents,
  activeCase,
  timeline,
  activeNodes: ["Watchers", "Normalizer", "Risk Engine", "Voice Agent"],
  evidence: [
    "Official warning detected within 2 miles of the user.",
    "Severity threshold exceeded for immediate outreach.",
    "Route guidance prepared because local travel is affected.",
  ],
  metadata: {
    actionCount: 2,
    checkInCount: 0,
    interactionCount: 1,
    lastScanAt: "8:44 PM",
    latestInteractionStatus: "calling",
    simulatedCallOutcome: "answered",
    watcherSourceMode: "fixture",
  },
};
