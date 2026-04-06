import fastify from "fastify";
import websocket from "@fastify/websocket";
import { WebSocket, RawData } from "ws";
import { readWorkerEnv } from "./config/env";
import { decodeUlawToPcm16, encodePcm16ToUlaw } from "./utils/transcoder";

export async function createServer() {
  const env = readWorkerEnv();
  const app = fastify({ logger: true });

  await app.register(websocket);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.register(async function (fastify) {
    fastify.get("/api/twilio/stream", { websocket: true }, (connection: any, req) => {
      const agentId = env.elevenLabsAgentId;
      if (!agentId) {
        app.log.error("ELEVENLABS_AGENT_ID is not configured");
        connection.close();
        return;
      }

      const elevenLabsWs = new WebSocket(`wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}&output_format=ulaw_8000`);
      let streamSid: string | null = null;
      let isElevenLabsOpen = false;

      let initMessage: any = null;

      // Handle message from ElevenLabs to Twilio
      elevenLabsWs.on("open", () => {
        isElevenLabsOpen = true;
        app.log.info("Connected to ElevenLabs Conversational AI");
        if (initMessage) {
          elevenLabsWs.send(JSON.stringify(initMessage));
          initMessage = null;
        }
      });

      elevenLabsWs.on("message", (data) => {
        try {
          const msgString = data.toString();
          const msg = JSON.parse(msgString);
          
          if (msg.type !== "audio" && msg.type !== "interruption") {
            app.log.info({ msg }, "Non-audio message from ElevenLabs");
          }

          if (msg.type === "audio" && msg.audio_event?.audio_base_64 && streamSid) {
            // Transcode PCM16 from ElevenLabs to uLaw for Twilio
            const pcmBuf = Buffer.from(msg.audio_event.audio_base_64, "base64");
            const pcm16kData = new Int16Array(pcmBuf.buffer, pcmBuf.byteOffset, pcmBuf.length / 2);
            const ulawData = encodePcm16ToUlaw(pcm16kData);
            const ulawBase64 = Buffer.from(ulawData).toString("base64");

            // Forward audio to Twilio
            const audioData = {
              event: "media",
              streamSid: streamSid,
              media: {
                payload: ulawBase64,
              },
            };
            connection.send(JSON.stringify(audioData));
          } else if (msg.type === "interruption" && streamSid) {
             // Tell Twilio to clear its buffer
             const clearData = {
               event: "clear",
               streamSid: streamSid,
             };
             connection.send(JSON.stringify(clearData));
          }
        } catch (error) {
          app.log.error({ err: error }, "Error parsing ElevenLabs message");
        }
      });

      elevenLabsWs.on("error", (error) => {
        app.log.error({ err: error }, "ElevenLabs WebSocket error");
      });

      elevenLabsWs.on("close", (code, reason) => {
        app.log.info({ code, reason: reason.toString() }, "ElevenLabs connection closed");
        connection.close();
      });

      // Handle message from Twilio to ElevenLabs
      connection.on("message", (message: RawData) => {
        try {
          const msg = JSON.parse(message.toString());
          
          if (msg.event === "start") {
            streamSid = msg.start.streamSid;
            app.log.info({ streamSid }, "Twilio stream started");

            const customParameters = msg.start.customParameters || {};
            const summary = customParameters.summary || "You are Eleos.";

            // Initialize ElevenLabs conversation
            const msgToQueue = {
              type: "conversation_initiation_client_data",
              custom_llm_extra_body: {
                dynamic_variables: {
                  summary: summary,
                },
              },
            };
            
            if (isElevenLabsOpen) {
              elevenLabsWs.send(JSON.stringify(msgToQueue));
            } else {
              initMessage = msgToQueue;
            }

          } else if (msg.event === "media") {
            if (isElevenLabsOpen) {
              // Transcode Twilio uLaw to PCM16 for ElevenLabs
              const ulawBuf = Buffer.from(msg.media.payload, "base64");
              const ulawData = new Uint8Array(ulawBuf.buffer, ulawBuf.byteOffset, ulawBuf.length);
              const pcm16kData = decodeUlawToPcm16(ulawData);
              const pcmBuf = Buffer.from(pcm16kData.buffer, pcm16kData.byteOffset, pcm16kData.byteLength);
              
              const audioData = {
                type: "user_audio_chunk",
                user_audio_chunk: pcmBuf.toString("base64"),
              };
              elevenLabsWs.send(JSON.stringify(audioData));
            }
          } else if (msg.event === "stop") {
            app.log.info("Twilio stream stopped");
            elevenLabsWs.close();
          }
        } catch (error) {
          app.log.error({ err: error }, "Error parsing Twilio message");
        }
      });

      connection.on("close", () => {
        app.log.info("Twilio connection closed");
        elevenLabsWs.close();
      });
    });
  });

  return app;
}
