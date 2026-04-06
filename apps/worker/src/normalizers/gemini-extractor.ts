import { GoogleGenAI, Type, Schema } from "@google/genai";
import crypto from "node:crypto";
import type { Incident } from "@eleos/shared";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const incidentSchema: Schema = {
  type: Type.ARRAY,
  description: "A list of isolated emergency incidents extracted from the messy text.",
  items: {
    type: Type.OBJECT,
    properties: {
      incidentType: {
        type: Type.STRING,
        enum: ["weather", "fire", "flood", "hazmat", "road_closure", "shelter"],
      },
      title: { type: Type.STRING, description: "A punchy, clear 3-5 word title for the event." },
      description: { type: Type.STRING, description: "A detailed but calm 1-2 sentence description of the threat." },
      severity: {
        type: Type.STRING,
        enum: ["low", "medium", "high", "critical"],
      },
      confidence: {
        type: Type.STRING,
        enum: ["low", "medium", "high"],
      },
      locationName: { type: Type.STRING, description: "Plain english name of the affected street, county, or landmark." },
      centerLat: { type: Type.NUMBER, description: "Best guess latitude centroid based on the text." },
      centerLng: { type: Type.NUMBER, description: "Best guess longitude centroid based on the text." },
      radiusMeters: { type: Type.NUMBER, description: "How wide the impact zone is in meters. Use context clues." },
      recommendedAction: { type: Type.STRING, description: "One clear imperative sentence on what the citizen should do." },
      status: {
        type: Type.STRING,
        enum: ["monitoring", "active", "resolved"],
      },
    },
    required: [
      "incidentType",
      "title",
      "description",
      "severity",
      "confidence",
      "locationName",
      "centerLat",
      "centerLng",
      "radiusMeters",
      "recommendedAction",
      "status",
    ],
  },
};

export async function extractIncidentsFromMarkdown(markdown: string, sourceUrl: string, sourceName: string): Promise<Incident[]> {
  const prompt = `You are a triage analyst for an emergency operations center (EOC).
Read the following messy website text (scraped via markdown). Look strictly for active, physical threats to public safety (e.g. structure fires, active weather, hazmat). Do not treat crime reports or political news as incidents unless there is an active lockdown or road closure.
If multiple unrelated incidents exist, split them. Extract every detail. 
For coordinates, if Washington DC or local counties are mentioned, ensure coordinates fit the true geographic area in the DMV region.

TEXT DUMP:
${markdown}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: incidentSchema,
      temperature: 0.1,
    },
  });

  const parsedText = response.text;
  if (!parsedText) return [];

  try {
    const records = JSON.parse(parsedText) as any[];
    return records.map((record) => {
      const now = new Date().toISOString();
      return {
        id: crypto.randomUUID(),
        incidentType: record.incidentType,
        title: record.title,
        description: record.description,
        severity: record.severity,
        status: record.status,
        confidence: record.confidence,
        locationName: record.locationName,
        centerLat: record.centerLat,
        centerLng: record.centerLng,
        radiusMeters: record.radiusMeters,
        recommendedAction: record.recommendedAction,
        firstSeenAt: now,
        lastSeenAt: now,
        sourceCount: 1,
        sources: [
          {
            id: crypto.randomUUID(),
            sourceType: "news",
            sourceName: sourceName,
            sourceUrl: sourceUrl,
            rawTitle: record.title,
            rawExcerpt: record.description,
            publishedAt: now,
            retrievedAt: now,
            reliabilityScore: 1.0,
          },
        ],
      } as Incident;
    });
  } catch (e) {
    console.error("Failed to parse Gemini incident extraction.", e);
    return [];
  }
}
