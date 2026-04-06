import { runFirecrawlPipeline } from "../watchers/firecrawl-pipeline";

async function main() {
  const targetUrl = process.argv[2] ?? "https://wtop.com/local/traffic/";
  const sourceName = process.argv[3] ?? "WTOP Local News";
  
  await runFirecrawlPipeline(targetUrl, sourceName);
}

main().catch(console.error);
