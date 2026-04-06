import type { Incident } from "@eleos/shared";
import type { IncidentRepository } from "../db/repositories";
import { normalizeIncident } from "../normalizers/incident-normalizer";
import {
  collectSignalsFromWatchers,
  defaultWatchers,
  type SourceWatcher,
} from "../watchers/source-watcher";

export async function ingestWatchers(params?: {
  incidentRepository?: IncidentRepository;
  watchers?: SourceWatcher[];
}) {
  const incidentRepository = params?.incidentRepository;

  if (!incidentRepository) {
    throw new Error("An incident repository is required to ingest watcher signals.");
  }

  const watchers = params?.watchers ?? defaultWatchers;
  const signals = await collectSignalsFromWatchers(watchers);
  const seenIncidentIds = new Set<string>();

  for (const signal of signals) {
    const incident = normalizeIncident(signal);
    await incidentRepository.save(incident);
    seenIncidentIds.add(incident.id);
  }

  const incidents = await incidentRepository.list();
  const openIncidents = incidents.filter((incident) => seenIncidentIds.has(incident.id));

  return {
    signals,
    incidents: openIncidents,
    totalSignals: signals.length,
    uniqueIncidentCount: openIncidents.length,
    mergedSignalCount: signals.length - openIncidents.length,
  };
}

export function sortIncidentsForTriage(incidents: Incident[]) {
  return [...incidents].sort((left, right) => {
    if (left.severity === right.severity) {
      return right.sourceCount - left.sourceCount;
    }

    const rank = { low: 0, medium: 1, high: 2, critical: 3 };
    return rank[right.severity] - rank[left.severity];
  });
}
