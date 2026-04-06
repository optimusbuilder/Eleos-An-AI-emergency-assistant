import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface WorkerEnv {
  callSimulationMode: "answered" | "failed" | "missed" | "voicemail";
  databaseUrl: string;
  mockCommunications: boolean;
  primaryUserCurrentLat: number;
  primaryUserCurrentLng: number;
  primaryUserEmail?: string;
  primaryUserHomeLabel: string;
  primaryUserHomeLat: number;
  primaryUserHomeLng: number;
  primaryUserName: string;
  primaryUserPhone: string;
  watcherSourceMode: "auto" | "fixture" | "live";
  twilioPhoneNumber?: string;
  emailFromAddress?: string;
  elevenLabsAgentId?: string;
  publicWorkerUrl?: string;
}

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEnvValue(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

let envLoaded = false;

function findEnvPath() {
  let currentDirectory = process.cwd();

  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = resolve(currentDirectory, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  return null;
}

function loadDotEnv() {
  if (envLoaded) {
    return;
  }

  const envPath = findEnvPath();
  if (!envPath) {
    envLoaded = true;
    return;
  }

  const contents = readFileSync(envPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = normalizeEnvValue(line.slice(separatorIndex + 1));

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  envLoaded = true;
}

export function readWorkerEnv(): WorkerEnv {
  loadDotEnv();

  return {
    callSimulationMode:
      process.env.CALL_SIMULATION_MODE === "missed" ||
      process.env.CALL_SIMULATION_MODE === "voicemail" ||
      process.env.CALL_SIMULATION_MODE === "failed"
        ? process.env.CALL_SIMULATION_MODE
        : "answered",
    databaseUrl: process.env.DATABASE_URL ?? "postgresql://localhost:5432/eleos",
    mockCommunications: process.env.MOCK_COMMUNICATIONS !== "false",
    primaryUserCurrentLat: readNumber(process.env.PRIMARY_USER_CURRENT_LAT, 38.9091),
    primaryUserCurrentLng: readNumber(process.env.PRIMARY_USER_CURRENT_LNG, -77.0417),
    primaryUserEmail: process.env.PRIMARY_USER_EMAIL,
    primaryUserHomeLabel: process.env.PRIMARY_USER_HOME_LABEL ?? "Washington, DC",
    primaryUserHomeLat: readNumber(process.env.PRIMARY_USER_HOME_LAT, 38.9072),
    primaryUserHomeLng: readNumber(process.env.PRIMARY_USER_HOME_LNG, -77.0369),
    primaryUserName: process.env.PRIMARY_USER_NAME ?? "Oluwa",
    primaryUserPhone: process.env.PRIMARY_USER_PHONE ?? "+1 555-555-0101",
    watcherSourceMode:
      process.env.WATCHER_SOURCE_MODE === "fixture" || process.env.WATCHER_SOURCE_MODE === "live"
        ? process.env.WATCHER_SOURCE_MODE
        : "auto",
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    emailFromAddress: process.env.EMAIL_FROM_ADDRESS,
    elevenLabsAgentId: process.env.ELEVENLABS_AGENT_ID,
    publicWorkerUrl: process.env.PUBLIC_WORKER_URL,
  };
}
