# Eleos: Emergency Operations Companion

`Eleos` is an emergency-aware, voice-first safety companion. It watches live local signals, determines whether a specific user is affected, and then alerts, calls, guides, and follows up with calm, actionable instructions. It functions as a trusted emergency operations assistant.

## Features

- **Autonomous Incident Ingestion:** A `Firecrawl` + `Gemini` pipeline scrapes messy county emergency pages (like WTOP or AlertDC), parses unstructured text, and creates strict geographic hazard radii.
- **Deterministic Risk Engine:** Background workers continually correlate live incidents against user locations.
- **Orchestration & Communication:** If an incident intersects a user's location with sufficient severity, `Eleos` opens a case, triggering SMS alerts, Twilio phone calls, or scheduled check-ins.
- **EOC Command Dashboard:** A dark-mode, high-contrast Next.js operations board leveraging Mapbox to visualize live hazards, cases, case timelines, and the AI agent's decision graph in real time.

## Architecture

This is a monolithic repository powered by NPM workspaces:

- `apps/web`: The Next.js EOC Dashboard.
- `apps/worker`: The Node.js ingestion and orchestration engine.
- `packages/db`: Prisma ORM and SQLite data models.
- `packages/shared`: Shared TypeScript types across apps.

## Prerequisites

To run Eleos locally, you'll need the following environment variables defined in a `.env` file at the root:

```env
# AI & Data Scraping
GEMINI_API_KEY="..."
FIRECRAWL_API_KEY="..."

# Communications
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="..."

# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="..."

# System Config
MOCK_COMMUNICATIONS=true
```

## Running the Application

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Initialize Database**
   ```bash
   npm run db:push
   ```

3. **Start the EOC Dashboard**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000/dashboard` in your browser.

4. **Run the Ingestion Engine**
   You can manually run the background workers to scrape live incidents from the web:
   ```bash
   cd apps/worker
   npm run scrape
   ```

5. **Run the Risk Engine**
   After scraping, run the risk engine to correlate incidents with users and trigger Twilio flows:
   ```bash
   cd apps/worker
   npx tsx --env-file=../../.env src/jobs/process-incidents.ts
   ```

## Development and Testing

- **Run a Full Drill:** Instead of waiting for a real emergency, you can invoke `run-drill.ts` to simulate a life-safety incident near the user and verify the dashboard and Twilio behavior.
  ```bash
  cd apps/worker
  npx tsx --env-file=../../.env src/jobs/run-drill.ts
  ```

---
*Built as a high-quality hackathon MVP demonstrating a complete sense-think-act loop.*
