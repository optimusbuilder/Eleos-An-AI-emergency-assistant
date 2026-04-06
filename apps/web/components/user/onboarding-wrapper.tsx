"use client";

import { useRouter } from "next/navigation";
import { OnboardingModal } from "./onboarding-modal";
import type { UserProfile } from "@eleos/shared";

interface OnboardingWrapperProps {
  user: UserProfile;
  children: React.ReactNode;
}

export function OnboardingWrapper({ user, children }: OnboardingWrapperProps) {
  const router = useRouter();

  const handleComplete = (updatedUser: UserProfile) => {
    // Refresh the server actions/data
    router.refresh();
  };

  return (
    <>
      <OnboardingModal user={user} onComplete={handleComplete} />
      {children}
    </>
  );
}
