import assert from "node:assert/strict";
import test from "node:test";
import { createCommunicationsProvider, mapTwilioCallStatus } from "./communications";

test("mock call status lookup maps simulated outcomes to delivery states", async () => {
  const queuedProvider = createCommunicationsProvider(true, { callOutcome: "queued" });
  const queuedStatus = await queuedProvider.fetchCallStatus({ providerReference: "mock-call:queued:+12025550101" });
  assert.equal(queuedStatus.deliveryStatus, "queued");

  const answeredProvider = createCommunicationsProvider(true, { callOutcome: "answered" });
  const answeredStatus = await answeredProvider.fetchCallStatus({
    providerReference: "mock-call:answered:+12025550101",
  });
  assert.equal(answeredStatus.deliveryStatus, "completed");
  assert.equal(answeredStatus.answeredBy, "human");

  const voicemailProvider = createCommunicationsProvider(true, { callOutcome: "voicemail" });
  const voicemailStatus = await voicemailProvider.fetchCallStatus({
    providerReference: "mock-call:voicemail:+12025550101",
  });
  assert.equal(voicemailStatus.deliveryStatus, "completed");
  assert.equal(voicemailStatus.answeredBy, "machine");
});

test("twilio status mapping preserves supported call lifecycle states", () => {
  assert.equal(mapTwilioCallStatus("queued"), "queued");
  assert.equal(mapTwilioCallStatus("ringing"), "ringing");
  assert.equal(mapTwilioCallStatus("in-progress"), "in-progress");
  assert.equal(mapTwilioCallStatus("completed"), "completed");
  assert.equal(mapTwilioCallStatus("busy"), "busy");
  assert.equal(mapTwilioCallStatus("no-answer"), "no-answer");
  assert.equal(mapTwilioCallStatus("canceled"), "canceled");
  assert.equal(mapTwilioCallStatus("failed"), "failed");
  assert.equal(mapTwilioCallStatus("mystery-status"), "failed");
});
