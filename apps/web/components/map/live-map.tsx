"use client";

import { useState, useEffect } from "react";
import type { Incident } from "@eleos/shared";
import type { DashboardSnapshot } from "../../lib/dashboard-snapshot";

function findIncident(incidents: Incident[], incidentId: string) {
  return incidents.find((incident) => incident.id === incidentId) ?? incidents[0];
}

function MapboxMapLoader({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{ snapshot: DashboardSnapshot }> | null>(null);

  useEffect(() => {
    import("./mapbox-map").then((mod) => {
      setMapComponent(() => mod.MapboxMap);
    });
  }, []);

  if (!MapComponent) {
    return <div className="mapbox-container" style={{ background: "#1a1f2e" }} />;
  }

  return <MapComponent snapshot={snapshot} />;
}

export function LiveMap({ snapshot }: { snapshot: DashboardSnapshot }) {
  const activeIncident = findIncident(snapshot.incidents, snapshot.activeCase.incidentId);

  return (
    <section className="panel map-panel">
      <div className="panel-header">
        <div>
          <h2>Live Operations Map</h2>
          <p className="muted">Map-focused scene with hazard radius, user anchor, shelter, and exit corridor.</p>
        </div>
        <span className="badge">Map focus</span>
      </div>
      <div className="panel-body">
        <div className="map-canvas">
          <MapboxMapLoader snapshot={snapshot} />
          <div className="map-grid-label">Monitoring {activeIncident.locationName}</div>
          <div className="map-status-strip">
            <div className="map-status-card">
              <span className="muted">Hazard type</span>
              <strong>{activeIncident.incidentType.replaceAll("_", " ")}</strong>
            </div>
            <div className="map-status-card">
              <span className="muted">User offset</span>
              <strong>{Math.round(snapshot.activeCase.distanceMeters / 1000)} km</strong>
            </div>
            <div className="map-status-card">
              <span className="muted">Case state</span>
              <strong>{snapshot.activeCase.state.replaceAll("_", " ")}</strong>
            </div>
          </div>
          <div className="map-focus-card">
            <span className="eyebrow">Primary Action</span>
            <strong>{activeIncident.title}</strong>
            <p>{activeIncident.recommendedAction}</p>
          </div>
          <div className="map-secondary-card">
            <span className="muted">Contact loop</span>
            <strong>
              {snapshot.metadata.latestInteractionStatus === "none"
                ? "No outbound interaction logged yet"
                : `Latest status: ${snapshot.metadata.latestInteractionStatus}`}
            </strong>
            <p className="muted">
              {snapshot.metadata.checkInCount > 0
                ? `${snapshot.metadata.checkInCount} follow-up check-in${snapshot.metadata.checkInCount === 1 ? "" : "s"} scheduled from the live worker flow.`
                : "No check-in scheduled yet; Eleos is still waiting on the current outreach path."}
            </p>
          </div>
          <div className="map-legend">
            <div className="legend-row">
              <span className="legend-mark danger" />
              Active hazard radius
            </div>
            <div className="legend-row">
              <span className="legend-mark safe" />
              User / shelter anchors
            </div>
            <div className="legend-row">
              <span className="legend-mark route" />
              Recommended route
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
