import FirecrawlApp from "@mendable/firecrawl-js";
import { readWorkerEnv } from "../config/env";
import { PrismaIncidentRepository } from "../db/prisma-repositories";
import { extractIncidentsFromMarkdown } from "../normalizers/gemini-extractor";

// Helper script designed to be run standalone or injected into a cron job.
export async function runFirecrawlPipeline(targetUrl: string, sourceName: string) {
  const env = readWorkerEnv();
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY in .env");
  }

  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  const incidentRepository = new PrismaIncidentRepository();

  console.log(`\n🔍 Scraping [${sourceName}]: ${targetUrl}...`);

  let markdown = "";
  try {
    const scrapeResult = await app.scrape(targetUrl, { formats: ["markdown"] });
    if (!scrapeResult.markdown) {
      console.warn(`⚠️ Firecrawl returned no markdown.`);
      return;
    }
    markdown = scrapeResult.markdown;
  } catch (error) {
    console.warn(`⚠️ Firecrawl failed to scrape:`, error);
    return;
  }

  console.log(`✅ Fetched ${markdown.length} bytes of markdown. Passing to Gemini API...`);

  const extractedIncidents = await extractIncidentsFromMarkdown(markdown, targetUrl, sourceName);

  if (!extractedIncidents || extractedIncidents.length === 0) {
    console.log(`🤷 Gemini could not find any active safety incidents in the page text.`);
    return;
  }

  console.log(`🚨 Gemini spotted ${extractedIncidents.length} incident(s)! Writing to database...`);

  for (const incident of extractedIncidents) {
    // Write incident, linking its sources properly
    for (const source of incident.sources as any) {
      source.incidentId = incident.id; // Assign real ID before pushing to the repository
    }
    
    await incidentRepository.save(incident);
    console.log(`  -> Saved Incident: [${incident.severity.toUpperCase()}] ${incident.title}`);
  }
  
  console.log(`🎉 Pipeline cycle complete.`);
}
