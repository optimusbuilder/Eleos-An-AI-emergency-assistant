export const pollingIntervals = {
  officialMs: 60_000,
  localMediaMs: 5 * 60_000,
  communityMs: 5 * 60_000,
};

export const riskThresholds = {
  callRadiusMeters: 3_200,
  highUrgencyRadiusMeters: 8_000,
};

export const appFlags = {
  mockCommunicationsDefault: true,
  demoModeDefault: true,
  emailFallbackDefault: true,
};

export const requiredEnvironmentKeys = [
  "DATABASE_URL",
  "ELEVENLABS_API_KEY",
  "FIRECRAWL_API_KEY",
  "MAPBOX_ACCESS_TOKEN",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
] as const;

export const optionalEnvironmentKeys = [
  "CALL_SIMULATION_MODE",
  "EMAIL_FROM_ADDRESS",
  "PRIMARY_USER_CURRENT_LAT",
  "PRIMARY_USER_CURRENT_LNG",
  "PRIMARY_USER_EMAIL",
  "PRIMARY_USER_HOME_LABEL",
  "PRIMARY_USER_HOME_LAT",
  "PRIMARY_USER_HOME_LNG",
  "PRIMARY_USER_NAME",
  "PRIMARY_USER_PHONE",
  "WATCHER_SOURCE_MODE",
] as const;

export interface CommunicationModeConfig {
  primaryChannel: "call";
  fallbackChannel: "email";
  summary: string;
  note: string;
}

export function getCommunicationModeConfig(): CommunicationModeConfig {
  return {
    primaryChannel: "call",
    fallbackChannel: "email",
    summary: "Call-first with email fallback",
    note: "Testing mode while SMS registration is pending.",
  };
}
