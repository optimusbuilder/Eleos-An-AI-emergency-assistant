import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryIncidentRepository } from "../db/repositories";
import { ingestWatchers } from "./ingest-watchers";
import { fixtureWatchers } from "../watchers/source-watcher";

test("ingestWatchers merges duplicate reports into one incident with combined sources", async () => {
  const incidentRepository = new InMemoryIncidentRepository();

  const result = await ingestWatchers({ incidentRepository, watchers: fixtureWatchers });

  assert.equal(result.totalSignals, 3);
  assert.equal(result.uniqueIncidentCount, 2);
  assert.equal(result.mergedSignalCount, 1);

  const weatherIncident = result.incidents.find((incident) => incident.incidentType === "weather");
  assert.ok(weatherIncident);
  assert.equal(weatherIncident.sourceCount, 2);
  assert.equal(weatherIncident.sources.length, 2);
  assert.equal(weatherIncident.confidence, "high");
  assert.equal(weatherIncident.locationName, "Central Washington, DC");

  const roadIncident = result.incidents.find((incident) => incident.incidentType === "road_closure");
  assert.ok(roadIncident);
  assert.equal(roadIncident.sourceCount, 1);
  assert.equal(roadIncident.severity, "medium");
});
