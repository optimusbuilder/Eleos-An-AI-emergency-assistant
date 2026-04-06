"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { DashboardSnapshot } from "../../lib/dashboard-snapshot";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "rgba(255, 90, 80, 0.35)",
  high: "rgba(255, 124, 115, 0.30)",
  medium: "rgba(255, 179, 71, 0.28)",
  low: "rgba(180, 190, 210, 0.22)",
};

const SEVERITY_BORDER_COLORS: Record<string, string> = {
  critical: "rgba(255, 90, 80, 0.70)",
  high: "rgba(255, 124, 115, 0.55)",
  medium: "rgba(255, 179, 71, 0.50)",
  low: "rgba(180, 190, 210, 0.40)",
};

/* Approximate meters → degrees for circle radius at DC latitude */
function metersToDegrees(meters: number) {
  return meters / 111_320;
}

function buildCircleGeoJSON(
  lat: number,
  lng: number,
  radiusMeters: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const radiusDeg = metersToDegrees(radiusMeters);
  const coordinates: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dx = radiusDeg * Math.cos(angle);
    const dy = radiusDeg * Math.sin(angle) * (Math.cos((lat * Math.PI) / 180));
    coordinates.push([lng + dx, lat + dy]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coordinates] },
  };
}

/* Shelter location — placed NE of the user toward safe ground */
const SHELTER_LOCATION: [number, number] = [-77.0320, 38.9155];

function createPulsingDot(map: mapboxgl.Map): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "18px";
  el.style.height = "18px";
  el.style.borderRadius = "50%";
  el.style.background = "#79e0d8";
  el.style.boxShadow = "0 0 18px rgba(121, 224, 216, 0.75)";
  el.style.border = "2px solid rgba(255,255,255,0.6)";
  el.style.animation = "pulse-ring 2s ease-out infinite";
  return el;
}

function createShelterMarker(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "16px";
  el.style.height = "16px";
  el.style.borderRadius = "50%";
  el.style.background = "#dff6ee";
  el.style.boxShadow = "0 0 14px rgba(223, 246, 238, 0.5)";
  el.style.border = "2px solid rgba(255,255,255,0.5)";
  return el;
}

export function MapboxMap({ snapshot }: { snapshot: DashboardSnapshot }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      console.warn("Mapbox token is not configured.");
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [snapshot.user.currentLng, snapshot.user.currentLat],
      zoom: 13.5,
      attributionControl: false,
      pitch: 0,
    });

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    mapRef.current = map;

    map.on("load", () => {
      map.resize();
      /* ── User marker ──────────────────────────────────── */
      new mapboxgl.Marker({ element: createPulsingDot(map) })
        .setLngLat([snapshot.user.currentLng, snapshot.user.currentLat])
        .addTo(map);

      /* ── Incident hazard zones ────────────────────────── */
      for (const incident of snapshot.incidents) {
        const sourceId = `incident-zone-${incident.id}`;
        const circle = buildCircleGeoJSON(
          incident.centerLat,
          incident.centerLng,
          incident.radiusMeters,
        );

        map.addSource(sourceId, { type: "geojson", data: circle });

        map.addLayer({
          id: `${sourceId}-fill`,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.low,
            "fill-opacity": 1,
          },
        });

        map.addLayer({
          id: `${sourceId}-border`,
          type: "line",
          source: sourceId,
          paint: {
            "line-color":
              SEVERITY_BORDER_COLORS[incident.severity] ??
              SEVERITY_BORDER_COLORS.low,
            "line-width": 2,
          },
        });
      }

      /* ── Shelter marker ───────────────────────────────── */
      new mapboxgl.Marker({ element: createShelterMarker() })
        .setLngLat(SHELTER_LOCATION)
        .addTo(map);

      /* ── Route line (user → shelter) ──────────────────── */
      map.addSource("route-line", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [snapshot.user.currentLng, snapshot.user.currentLat],
              SHELTER_LOCATION,
            ],
          },
        },
      });

      map.addLayer({
        id: "route-line-layer",
        type: "line",
        source: "route-line",
        paint: {
          "line-color": "rgba(121, 224, 216, 0.85)",
          "line-width": 3,
          "line-dasharray": [3, 2],
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });

      /* ── Fit bounds ───────────────────────────────────── */
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([snapshot.user.currentLng, snapshot.user.currentLat]);
      for (const incident of snapshot.incidents) {
        bounds.extend([incident.centerLng, incident.centerLat]);
      }
      bounds.extend(SHELTER_LOCATION);

      map.fitBounds(bounds, { padding: 80, maxZoom: 14.5, duration: 1200 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="mapbox-container" style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />;
}
