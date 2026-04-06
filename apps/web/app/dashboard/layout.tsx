import { unstable_noStore as noStore } from "next/cache";
import { getCommunicationModeConfig } from "@eleos/config";
import { OpsRail } from "../../components/layout/ops-rail";
import { TopBar } from "../../components/layout/top-bar";
import { buildDashboardSnapshot } from "../../lib/dashboard-snapshot";
import { OnboardingWrapper } from "../../components/user/onboarding-wrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const communicationMode = getCommunicationModeConfig();
  const snapshot = await buildDashboardSnapshot();

  return (
    <div className="dashboard-frame">
      <OnboardingWrapper user={snapshot.user}>
        <OpsRail />
        <div className="dashboard-shell">
          <TopBar
            user={snapshot.user}
            incidentCount={snapshot.incidents.length}
            communicationMode={communicationMode}
            lastScanAt={snapshot.metadata.lastScanAt}
            simulatedCallOutcome={snapshot.metadata.simulatedCallOutcome}
            watcherSourceMode={snapshot.metadata.watcherSourceMode}
          />
          {children}
        </div>
      </OnboardingWrapper>
    </div>
  );
}
