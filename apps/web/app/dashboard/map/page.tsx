import { unstable_noStore as noStore } from "next/cache";
import { buildDashboardSnapshot } from "../../../lib/dashboard-snapshot";
import { LiveMap } from "../../../components/map/live-map";

export default async function MapPage() {
  noStore();
  const snapshot = await buildDashboardSnapshot();

  return (
    <div className="dashboard-grid full-map-grid">
      <div className="dashboard-map">
        <LiveMap snapshot={snapshot} />
      </div>
    </div>
  );
}
