# Eleos Implementation Guide

This file is the build brief for AI coding agents working on `Eleos`.

`Eleos` is an emergency-aware, voice-first safety companion. It watches live local signals, determines whether a specific user is affected, and then alerts, calls, guides, and follows up with calm, actionable instructions. The product should feel like a trusted emergency operations assistant, not a chatbot.

The first implementation target is a high-quality hackathon MVP that proves four things:

1. `Eleos` can detect a nearby emergency from live or near-live sources.
2. `Eleos` can decide whether that emergency is relevant to a specific user.
3. `Eleos` can call or message the user with clear next-step guidance.
4. `Eleos` can show its reasoning and actions on a visually compelling dashboard.

This file is intentionally detailed. Future agents should treat it as the product and technical source of truth unless the user explicitly changes direction.

## Product Summary

`Eleos` is built around a tight loop:

`detect -> verify -> assess relevance -> contact user -> guide action -> follow up`

It should behave conservatively and credibly:

- Do not over-claim certainty.
- Do not present community chatter as authoritative truth.
- Do not behave like a replacement for `911`.
- Do present one clear next step at a time.
- Do keep the user calm and supported.

## MVP Scope

The MVP is intentionally narrow.

- Single primary user profile to start.
- User location is the anchor for risk assessment.
- Support the following incident classes first:
  - `weather`
  - `fire`
  - `flood`
  - `hazmat`
  - `road_closure`
  - `shelter`
- Support the following actions first:
  - call the user
  - text the user
  - text an emergency contact
  - send route/shelter guidance
  - schedule follow-up check-ins

The MVP should not attempt to be a complete emergency dispatch platform. It is a safety companion and triage assistant.

## Core Product Principles

1. `Safety first`
Always optimize for clear, conservative guidance over cleverness.

2. `Source-backed decisions`
Every incident should be traceable to one or more sources.

3. `Visible reasoning`
The dashboard should make it easy to understand why `Eleos` acted.

4. `Human-readable state`
Every important system decision should map to a stable case state.

5. `Map-first operations`
The dashboard should feel like a live operations board, not a generic SaaS admin.

6. `MVP realism`
Build the smallest possible system that still demonstrates a complete sense-think-act loop.

## High-Level Architecture

The system is split into these logical layers:

1. `Source Watchers`
Monitor official and supporting sources for new or changing incidents.

2. `LLM-Assisted Incident Normalization`
Use an LLM to help convert raw source content into a structured incident model.

3. `Risk Engine`
Compare incidents against the user profile and determine relevance and urgency.

4. `Alert Orchestrator`
Create cases and decide whether to send an SMS, place a call, or schedule follow-up.

5. `Voice and Messaging`
Use `Twilio` for telephony and SMS, and `ElevenLabs` for the conversational voice layer.

6. `Dashboard`
Visualize incidents, cases, agent activity, and case timelines on a map-centered command board.

## LLM Role

`Eleos` should use an LLM, but in a controlled role.

Use an LLM such as `Gemini`, `GPT-4o`, or a similar capable model for:

- extracting structured facts from messy scraped pages
- classifying vague incident descriptions
- generating compact safety briefs for the voice layer
- summarizing source evidence for the dashboard
- generating user-facing SMS or call language in the correct tone
- summarizing conversations and interaction outcomes

Do not use the LLM as the sole system of record for critical product logic.

The LLM should support reasoning and language generation, while the backend owns policy and orchestration.

### LLM responsibilities

- normalize unstructured incident text into candidate structured data
- identify likely incident type and action language
- summarize sources for operator review
- rewrite instructions in a calm, concise tone
- generate short human-readable status summaries

### Deterministic backend responsibilities

- distance and radius checks
- urgency thresholds
- state transitions
- case creation and updates
- call vs SMS decisioning
- retry logic
- check-in scheduling
- action permissions and constraints

The preferred design is:

- `LLM` for `normalize + summarize + phrase`
- `backend logic` for `policy + orchestration + state`

## System Flow

The core system flow is:

1. Watchers fetch source data.
2. LLM-assisted normalization produces or updates incident records.
3. Risk engine checks whether the incident affects the user.
4. If relevant, open or update a case.
5. Orchestrator decides how to contact the user.
6. Voice agent or SMS delivers the safety instruction.
7. Actions and interactions are logged.
8. Check-ins are scheduled until the case resolves.

## Repo Architecture

Use a small monorepo. Keep it simple and implementation-friendly.

```text
eleos/
  apps/
    web/
    worker/
  packages/
    ui/
    shared/
    config/
  docs/
  AGENTS.md
```

### `apps/web`

This is the dashboard and any lightweight app/server endpoints required by the frontend.

Suggested structure:

```text
apps/web/
  app/
    dashboard/
    cases/
    incidents/
    settings/
    api/
  components/
    layout/
    map/
    incidents/
    cases/
    graph/
    status/
  lib/
    api/
    map/
    formatting/
    mock/
  styles/
```

Responsibilities:

- render the live operations dashboard
- show incident feed and filters
- show the map and overlays
- show case details and timeline
- show the agent graph / decision chain
- show source evidence and system status

### `apps/worker`

This is the engine room for ingestion, decisioning, and orchestration.

Suggested structure:

```text
apps/worker/
  src/
    watchers/
    normalizers/
    risk/
    orchestrator/
    actions/
    jobs/
    db/
    utils/
```

Responsibilities:

- poll and process sources
- normalize incident data, potentially with LLM support
- score relevance and urgency
- create and update cases
- place or schedule call/text actions
- manage follow-up check-ins

### `packages/ui`

Shared UI primitives and reusable dashboard components.

Responsibilities:

- cards
- drawers
- panels
- badges
- status pills
- toasts
- timeline elements

### `packages/shared`

Shared types, schemas, enums, and domain contracts.

Suggested contents:

```text
packages/shared/src/
  types/
    incident.ts
    case.ts
    user-profile.ts
    source.ts
    action.ts
    risk.ts
  constants/
    incident-types.ts
    severity.ts
    case-status.ts
    action-types.ts
  schemas/
    incident-schema.ts
    case-schema.ts
```

Responsibilities:

- ensure the frontend and worker use the same models
- define stable domain language
- reduce drift during implementation

### `packages/config`

Shared config and environment logic.

Use it for:

- environment schema
- feature flags
- severity thresholds
- polling intervals
- demo mode behavior
- region/source configuration

### `docs`

Store supporting project docs here over time:

- architecture overview
- source strategy
- dashboard spec
- demo runbook
- API integration notes

## Suggested Tech Stack

Prefer pragmatic choices:

- Frontend: `Next.js`
- Worker: `Node.js + TypeScript` or `Python`
- Database: `Postgres` or `Supabase/Postgres`
- Voice: `ElevenLabs`
- Telephony and SMS: `Twilio`
- Scheduling: lightweight worker jobs / cron / queue

If the implementation stays in a single language, `TypeScript` is the easiest path for type sharing. If scraping or parsing workflows are easier in `Python`, it is acceptable to keep the worker in `Python`, but still preserve a stable shared schema contract.

If an LLM provider is added to the worker, keep the model integration behind a narrow service boundary such as:

- `incident-normalization-service`
- `brief-generation-service`
- `message-generation-service`
- `interaction-summary-service`

This prevents core logic from being scattered across prompts.

## Why Twilio + ElevenLabs

For the MVP, if `Eleos` needs to call a real phone number, use `Twilio`.

Use:

- `Twilio Voice` for calls
- `Twilio SMS` for follow-up texts and emergency contact messages
- `ElevenLabs` as the conversational voice layer

Do not use `Telegram` or `Discord` as the primary emergency contact surface. They may be useful later as optional channels, but the phone system should be first.

## Call Stack

The outbound call stack should behave like this:

1. Incident triggers case creation.
2. Orchestrator decides whether the user should be called or texted.
3. `Twilio` places or receives the phone call.
4. `ElevenLabs` handles the voice conversation.
5. `Twilio SMS` sends summaries and fallback messages.
6. `Eleos` logs the interaction and schedules follow-up if needed.

## Call Lifecycle

The call workflow should be deterministic.

### When answered

The agent should:

1. identify the threat
2. state the first safety step
3. ask whether the user is safe
4. ask whether they are at home, driving, or elsewhere
5. provide one clear next instruction
6. offer one or two limited support actions
7. confirm the next follow-up

### When not answered

If the call is missed:

- send SMS immediately
- include the threat and first action
- schedule retry if urgency remains high

### When voicemail answers

Leave a very short voicemail and send the real information via SMS.

### When the call fails

Log the failure, send SMS if possible, and queue a follow-up attempt if appropriate.

## Supported User Actions

The MVP should support these concrete actions:

1. send a safety text to the user
2. send an "I am safe" or status message to an emergency contact
3. send route or shelter guidance
4. place a confirmed follow-up call to an emergency contact
5. schedule timed check-ins

Avoid fully autonomous high-risk actions in v1.

Do not automatically:

- contact emergency services on the user's behalf without clear justification and explicit design
- book rides or transportation
- make claims of guaranteed route safety

## Incident Source Strategy

The ingestion layer should rely on a trust hierarchy.

### Tier 1: highest trust

Use these as the backbone:

- National Weather Service and official weather alerts
- county/city emergency management pages
- sheriff/police/fire department alerts
- state or local DOT road closures
- official shelter and emergency operations pages

### Tier 2: supporting sources

- reputable local media
- local TV and news breaking posts
- local traffic and incident pages

### Tier 3: noisy signals

- X/Twitter
- scanner-style feeds
- community posts

Use Tier 3 only as a signal or corroboration source. Do not trigger a high-confidence user call based on Tier 3 alone.

## Incident Normalization Model

Every watcher should eventually output or update a shared incident shape with the following semantic fields:

- incident type
- title
- summary
- severity
- status
- confidence
- location name
- center latitude / longitude
- radius or geometry
- recommended action
- first seen timestamp
- last seen timestamp
- source references

The worker should merge duplicate reports about the same event when reasonable.

Use the LLM to help extract and normalize this data from unstructured content, but validate the result before the incident becomes authoritative.

## Risk Engine

The risk engine is the product core.

It should compare each incident against the user profile:

- home location
- current location if available
- distance from the incident
- whether a known route is affected
- severity
- confidence
- freshness

It should classify incidents into:

- `ignore`
- `monitor`
- `alert`
- `call_now`

### Trigger guidance

Use clear trigger logic:

- `call_now` for high-severity, high-confidence incidents near the user
- `alert` for medium urgency
- `monitor` for low-confidence or distant incidents

The engine should prefer conservative, source-backed decisions.

The risk engine should not delegate final policy decisions entirely to the LLM.

## Case State Model

Every user-incident relationship should be represented by a `case`.

Use stable states such as:

- `monitoring`
- `alert_sent`
- `calling`
- `in_call`
- `awaiting_response`
- `checkin_scheduled`
- `resolved`
- `unreachable`
- `escalated`

The dashboard and orchestration logic should both depend on these state values.

## Database Schema

The database should center around these tables.

### `users`

Suggested fields:

- `id`
- `full_name`
- `primary_phone`
- `home_lat`
- `home_lng`
- `current_lat`
- `current_lng`
- `location_updated_at`
- `transport_mode`
- `mobility_notes`
- `timezone`
- `preferred_channel`
- `status`
- `created_at`
- `updated_at`

### `emergency_contacts`

Suggested fields:

- `id`
- `user_id`
- `name`
- `phone`
- `relationship`
- `priority_order`
- `notify_enabled`
- `created_at`

### `incidents`

Suggested fields:

- `id`
- `incident_type`
- `title`
- `description`
- `severity`
- `status`
- `confidence`
- `source_count`
- `location_name`
- `center_lat`
- `center_lng`
- `radius_meters`
- `geojson`
- `recommended_action`
- `first_seen_at`
- `last_seen_at`
- `resolved_at`
- `created_at`
- `updated_at`

### `incident_sources`

Suggested fields:

- `id`
- `incident_id`
- `source_type`
- `source_name`
- `source_url`
- `raw_title`
- `raw_excerpt`
- `published_at`
- `retrieved_at`
- `reliability_score`
- `created_at`

### `cases`

Suggested fields:

- `id`
- `user_id`
- `incident_id`
- `risk_level`
- `state`
- `trigger_reason`
- `distance_meters`
- `route_affected`
- `initial_channel`
- `current_status_summary`
- `user_safety_status`
- `opened_at`
- `last_action_at`
- `resolved_at`
- `created_at`
- `updated_at`

### `interactions`

Suggested fields:

- `id`
- `case_id`
- `interaction_type`
- `provider`
- `provider_message_id`
- `direction`
- `delivery_status`
- `started_at`
- `ended_at`
- `content_summary`
- `transcript`
- `created_at`

### `actions`

Suggested fields:

- `id`
- `case_id`
- `action_type`
- `target`
- `status`
- `payload_json`
- `result_summary`
- `executed_at`
- `created_at`

### `check_ins`

Suggested fields:

- `id`
- `case_id`
- `scheduled_for`
- `status`
- `attempt_count`
- `last_attempt_at`
- `notes`
- `created_at`
- `updated_at`

## Frontend Dashboard Vision

The dashboard should be the visual proof that `Eleos` is doing real-time triage.

It should not look like a generic admin panel.

The dashboard should feel like a live emergency operations board with a map at the center.

### Desktop layout

Use this structure:

- top bar
- left incident rail
- center live map
- right intelligence rail
- bottom case timeline drawer

### Top bar

Show:

- `Eleos` identity
- current monitored user/location
- region badge
- system health pills
- last scan time
- active incident count
- quick search

### Left rail: incident feed

Show:

- active incidents as stacked cards
- severity
- confidence
- distance from user
- last updated time
- source count
- one-line recommended action

### Center panel: live map

The map is the hero.

Show:

- user location
- incident zones
- shelters
- road closures
- route guidance
- optional weather overlays

The visual tone should be closer to an operations board than a standard app map.

Use a dark base, clear hazard colors, and restrained motion.

### Right rail: intelligence and agent graph

Show:

- case summary
- risk reason
- current recommendation
- agent graph
- decision evidence

The graph should make the system pipeline visible:

- `Watchers`
- `Normalizer`
- `Risk Engine`
- `Voice Agent`
- `Contact Action`
- `Check-In Scheduler`

### Bottom drawer: case timeline

Show a time-ordered sequence of:

- incident detected
- risk scored
- call initiated
- user responded
- contact notified
- check-in scheduled

This is the proof layer of the product.

## Dashboard Component Architecture

Suggested components:

```text
apps/web/components/
  layout/
    dashboard-shell.tsx
    top-bar.tsx
    left-rail.tsx
    right-rail.tsx
    bottom-drawer.tsx

  map/
    live-map.tsx
    user-marker.tsx
    incident-layer.tsx
    shelter-layer.tsx
    route-layer.tsx
    map-controls.tsx

  incidents/
    incident-feed.tsx
    incident-card.tsx
    incident-filters.tsx
    incident-detail-popover.tsx

  cases/
    case-summary-card.tsx
    case-timeline.tsx
    case-timeline-event.tsx
    conversation-summary.tsx
    user-safety-card.tsx

  graph/
    agent-graph.tsx
    agent-node.tsx
    decision-evidence.tsx

  status/
    health-pill.tsx
    alert-counter.tsx
    action-toast.tsx
```

## Dashboard Design Direction

The UI should feel intentional and cinematic, but still readable under pressure.

Visual direction:

- dark or charcoal operations-canvas background
- warm glow for active hazards
- cyan/teal for safe or assistive states
- glassy or translucent panels over map content
- subtle animation, not constant motion

Design goals:

- emergency operations aesthetic
- fast readability
- map-first storytelling
- obvious status changes
- strong hierarchy

Do not build a generic white-card enterprise dashboard.

## Recommended Interaction Model

When the user selects an incident:

1. the map zooms to the hazard area
2. the user marker and affected zone are highlighted
3. the case summary updates
4. the agent graph highlights the active pipeline stage
5. the case timeline becomes visible or updates

When a live case changes state:

- show a toast or status animation
- append the new event to the timeline
- keep the map and case state synchronized

## API and Integration Boundaries

Keep implementation boundaries clear.

### Worker responsibilities

- poll sources
- normalize source content
- write incidents
- create and update cases
- invoke call/text providers
- log actions and interactions

The worker may call an LLM service as part of normalization, summarization, and message drafting, but deterministic services should remain the source of truth for case state and action flow.

### Web responsibilities

- read and display data
- provide operator interaction surfaces
- optionally expose thin server endpoints
- avoid embedding core risk or orchestration logic in the client

### Provider boundaries

- `Twilio` owns telephony and SMS delivery
- `ElevenLabs` owns conversational voice
- `Eleos` owns decisioning, orchestration, and case state

## Demo Strategy

The MVP should be demoable even before every real data source is integrated.

Support a `demo mode` that can:

- simulate incoming incidents
- update incident state live
- animate the dashboard flow
- trigger a call or SMS path
- show the full timeline progression

The strongest demo moment is:

1. incident appears or changes
2. `Eleos` detects the change
3. the case opens
4. the dashboard lights through the pipeline
5. the user receives the alert/call

## Implementation Phases

Future agents should work in sensible stages.

### Phase 1: foundations

- initialize repo
- establish monorepo structure
- set up frontend app
- set up worker app
- define shared types
- define environment configuration

### Phase 2: data and domain

- implement database schema
- implement core repositories
- seed initial user profile
- define case and incident enums

### Phase 3: ingestion

- build first watcher(s)
- normalize sample incident data
- add LLM-assisted extraction where useful
- write incidents and sources into storage

### Phase 4: risk and orchestration

- implement relevance scoring
- implement urgency classification
- create cases
- implement follow-up scheduling

Keep phase 4 policy logic deterministic even if phase 3 uses an LLM.

### Phase 5: dashboard shell

- build map-centered layout
- build incident feed
- build case summary
- build timeline drawer
- build agent graph

### Phase 6: communications

- connect `Twilio`
- connect `ElevenLabs`
- implement call and SMS workflows
- log interactions

### Phase 7: demo polish

- animate state changes
- improve map overlays
- support demo mode
- refine operator clarity and case explainability

## Non-Goals for MVP

Do not overbuild these in v1:

- multi-tenant organizations
- complex auth
- role-based permissions
- ride-booking automations
- direct emergency-services dispatch
- many UI themes
- overly abstract agent orchestration layers
- microservices for every subsystem

## Quality Bar

Future agents should optimize for:

- readable code
- strong domain naming
- small, composable modules
- explicit state transitions
- source traceability
- visual coherence

If there is a tradeoff between flash and clarity, prefer clarity.

## Guidance for Future AI Coding Agents

When implementing, keep these priorities in order:

1. preserve the `detect -> assess -> act -> follow up` loop
2. keep the case state model consistent
3. ensure incidents remain source-backed
4. make the dashboard map-first
5. keep the call/SMS flow deterministic
6. avoid unbounded scope growth

If something is ambiguous, prefer the smallest implementation that still demonstrates the full product loop.

When choosing between multiple architectural options:

- prefer simpler deployment over clever architecture
- prefer explicit state over hidden behavior
- prefer a real user-visible flow over internal abstractions
- prefer building the dashboard proof points early

## Short Product Tagline

`Eleos watches, warns, guides, and follows up.`

## One-Sentence Build Goal

Build a credible emergency-aware assistant that can detect a nearby threat, decide that it matters to the user, contact them through a real phone call or SMS, and show the full reasoning and response on a map-centered operations dashboard.
