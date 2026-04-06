import type { InteractionDeliveryStatus } from "@eleos/shared";

export type CallOutcome = "answered" | "failed" | "missed" | "queued" | "voicemail";

export interface CallResult {
  provider: string;
  providerReference: string;
  outcome: CallOutcome;
  contentSummary: string;
  transcript?: string;
}

export interface EmailResult {
  provider: string;
  providerReference: string;
  deliveryStatus: "failed" | "sent";
  contentSummary: string;
}

export interface CallStatusResult {
  provider: string;
  providerReference: string;
  deliveryStatus: InteractionDeliveryStatus;
  rawStatus: string;
  answeredBy?: string;
  durationSeconds?: number;
  startedAt?: string;
  endedAt?: string;
  errorMessage?: string;
}

export interface CommunicationsProvider {
  placeCall(input: { to: string; summary: string }): Promise<CallResult>;
  sendEmail(input: { to: string; subject: string; message: string }): Promise<EmailResult>;
  fetchCallStatus(input: { providerReference: string }): Promise<CallStatusResult>;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function buildTwilioAuthHeader(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function toOptionalNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapMockOutcomeToDeliveryStatus(outcome: CallOutcome): InteractionDeliveryStatus {
  switch (outcome) {
    case "answered":
      return "completed";
    case "failed":
      return "failed";
    case "missed":
      return "no-answer";
    case "queued":
      return "queued";
    case "voicemail":
      return "completed";
  }
}

export function mapTwilioCallStatus(status: string | undefined): InteractionDeliveryStatus {
  switch (status) {
    case "busy":
    case "canceled":
    case "completed":
    case "failed":
    case "in-progress":
    case "no-answer":
    case "queued":
    case "ringing":
      return status;
    default:
      return "failed";
  }
}

class MockCommunicationsProvider implements CommunicationsProvider {
  constructor(private readonly callOutcome: CallOutcome) {}

  async placeCall(input: { to: string; summary: string }) {
    const transcript =
      this.callOutcome === "answered"
        ? "User confirmed they are sheltering indoors and agreed to the next Eleos check-in."
        : this.callOutcome === "voicemail"
          ? "Left a short voicemail directing the user to check their email for the full safety brief."
          : undefined;

    return {
      provider: "mock",
      providerReference: `mock-call:${this.callOutcome}:${input.to}`,
      outcome: this.callOutcome,
      contentSummary: input.summary,
      transcript,
    } satisfies CallResult;
  }

  async sendEmail(input: { to: string; subject: string; message: string }) {
    return {
      provider: "mock",
      providerReference: `mock-email:${input.to}:${input.subject}`,
      deliveryStatus: "sent",
      contentSummary: `${input.subject}. ${input.message}`,
    } satisfies EmailResult;
  }

  async fetchCallStatus(input: { providerReference: string }) {
    return {
      provider: "mock",
      providerReference: input.providerReference,
      deliveryStatus: mapMockOutcomeToDeliveryStatus(this.callOutcome),
      rawStatus: this.callOutcome,
      answeredBy: this.callOutcome === "voicemail" ? "machine" : this.callOutcome === "answered" ? "human" : undefined,
    } satisfies CallStatusResult;
  }
}

class IntegratedCommunicationsProvider implements CommunicationsProvider {
  constructor(private readonly config: {
    accountSid: string;
    authToken: string;
    fromPhoneNumber: string;
    publicWorkerUrl: string | undefined;
  }) {}

  private hasCredentials() {
    return Boolean(this.config.accountSid && this.config.authToken);
  }

  async placeCall(input: { to: string; summary: string }) {
    if (!this.hasCredentials()) {
      return {
        provider: "twilio",
        providerReference: "twilio-call-error:not-configured",
        outcome: "failed",
        contentSummary: `${input.summary} (Twilio credentials are not configured.)`,
      } satisfies CallResult;
    }

    const spokenSummary = escapeXml(input.summary);
    
    // Connect Twilio to our local websocket relay so we can authorize and parse the audio
    const twiml = this.config.publicWorkerUrl
      ? `<Response><Connect><Stream url="${this.config.publicWorkerUrl}/api/twilio/stream"><Parameter name="summary" value="${spokenSummary}" /></Stream></Connect></Response>`
      : `<Response><Say language="en-US">This is Eleos.</Say><Pause length="1"/><Say language="en-US">${spokenSummary}</Say><Pause length="1"/><Say language="en-US">If you are safe, check your email for follow up details. Goodbye.</Say></Response>`;

    const body = new URLSearchParams({
      To: input.to,
      From: this.config.fromPhoneNumber,
      Twiml: twiml,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: buildTwilioAuthHeader(this.config.accountSid, this.config.authToken),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        provider: "twilio",
        providerReference: `twilio-call-error:${response.status}`,
        outcome: "failed",
        contentSummary: `${input.summary} (${errorText.slice(0, 200)})`,
      } satisfies CallResult;
    }

    const payload = (await response.json()) as { sid?: string; status?: string };
    return {
      provider: "twilio",
      providerReference: payload.sid ?? `twilio-call:${input.to}`,
      outcome: "queued",
      contentSummary: input.summary,
      transcript: `Twilio accepted the outbound call request with status ${payload.status ?? "queued"}.`,
    } satisfies CallResult;
  }

  async sendEmail(input: { to: string; subject: string; message: string }) {
    return {
      provider: "email",
      providerReference: `email-not-configured:${input.to}`,
      deliveryStatus: "sent",
      contentSummary: `${input.subject}. ${input.message}`,
    } satisfies EmailResult;
  }

  async fetchCallStatus(input: { providerReference: string }) {
    if (!this.hasCredentials()) {
      return {
        provider: "twilio",
        providerReference: input.providerReference,
        deliveryStatus: "failed",
        rawStatus: "not-configured",
        errorMessage: "Twilio credentials are not configured.",
      } satisfies CallStatusResult;
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls/${input.providerReference}.json`,
      {
        headers: {
          Authorization: buildTwilioAuthHeader(this.config.accountSid, this.config.authToken),
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        provider: "twilio",
        providerReference: input.providerReference,
        deliveryStatus: "failed",
        rawStatus: `http_${response.status}`,
        errorMessage: errorText.slice(0, 400),
      } satisfies CallStatusResult;
    }

    const payload = (await response.json()) as {
      sid?: string;
      status?: string;
      answered_by?: string;
      duration?: string;
      start_time?: string;
      end_time?: string;
    };

    return {
      provider: "twilio",
      providerReference: payload.sid ?? input.providerReference,
      deliveryStatus: mapTwilioCallStatus(payload.status),
      rawStatus: payload.status ?? "unknown",
      answeredBy: payload.answered_by ?? undefined,
      durationSeconds: toOptionalNumber(payload.duration),
      startedAt: payload.start_time ?? undefined,
      endedAt: payload.end_time ?? undefined,
    } satisfies CallStatusResult;
  }
}

export function createCommunicationsProvider(
  mockCommunications: boolean,
  options?: {
    accountSid?: string;
    authToken?: string;
    callOutcome?: CallOutcome;
    fromPhoneNumber?: string;
  },
): CommunicationsProvider {
  return mockCommunications
    ? new MockCommunicationsProvider(options?.callOutcome ?? "answered")
    : new IntegratedCommunicationsProvider({
        accountSid: options?.accountSid ?? "",
        authToken: options?.authToken ?? "",
        fromPhoneNumber: options?.fromPhoneNumber ?? "",
        publicWorkerUrl: process.env.PUBLIC_WORKER_URL,
      });
}
