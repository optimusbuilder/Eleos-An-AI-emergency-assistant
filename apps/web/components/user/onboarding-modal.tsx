"use client";

import { useState, useEffect } from "react";
import type { UserProfile } from "@eleos/shared";

interface OnboardingModalProps {
  user: UserProfile;
  onComplete: (user: UserProfile) => void;
}

export function OnboardingModal({ user, onComplete }: OnboardingModalProps) {
  const [formData, setFormData] = useState({
    fullName: user.fullName || "",
    primaryEmail: user.primaryEmail || "",
    primaryPhone: user.primaryPhone || "",
    homeLabel: user.homeLabel || "Home",
    lat: user.currentLat || 38.9072,
    lng: user.currentLng || -77.0369,
  });

  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Set initial location from user if available
  useEffect(() => {
    if (user.currentLat && user.currentLng) {
      setFormData(prev => ({ ...prev, lat: user.currentLat, lng: user.currentLng }));
    }
  }, [user]);

  const handleDetectLocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }));
        setLocating(false);
      },
      (error) => {
        console.error("Error detecting location:", error);
        alert("Failed to detect location. Please enter coordinates manually if needed.");
        setLocating(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          primaryEmail: formData.primaryEmail,
          primaryPhone: formData.primaryPhone,
          homeLabel: formData.homeLabel,
          homeLat: formData.lat,
          homeLng: formData.lng,
          currentLat: formData.lat,
          currentLng: formData.lng,
        }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        onComplete(updatedUser);
      } else {
        alert("Failed to save profile. Please try again.");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Determine if profile is incomplete
  const isIncomplete = !user.fullName || user.fullName === "Oluwa" || !user.primaryPhone || user.primaryPhone.includes("555-555");
  
  if (!isIncomplete && !saving) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-max-w-md bg-[#12141a] border border-[#2a2e3a] rounded-xl shadow-2xl overflow-hidden glass-panel">
        <div className="p-6 border-b border-[#2a2e3a] bg-[#1a1d26]">
          <h2 className="text-xl font-bold text-[#79e0d8] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#79e0d8] animate-pulse" />
            Operator Identity Required
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Setting up your local emergency monitoring perimeter.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                className="w-full bg-[#0a0b0f] border border-[#2a2e3a] rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-[#79e0d8] transition-colors"
                placeholder="Enter your name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="w-full bg-[#0a0b0f] border border-[#2a2e3a] rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-[#79e0d8] transition-colors"
                  placeholder="name@example.com"
                  value={formData.primaryEmail}
                  onChange={(e) => setFormData({ ...formData, primaryEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  className="w-full bg-[#0a0b0f] border border-[#2a2e3a] rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-[#79e0d8] transition-colors"
                  placeholder="+1 555-555-5555"
                  value={formData.primaryPhone}
                  onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Deployment Anchor (Location)
              </label>
              <div className="bg-[#0a0b0f] border border-[#2a2e3a] rounded-lg p-3 space-y-3">
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={locating}
                  className="w-full flex items-center justify-center gap-2 bg-[#1a1d26] hover:bg-[#2a2e3a] border border-[#3a3f4e] text-slate-200 py-2 rounded-md transition-all active:scale-[0.98]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={locating ? "animate-spin" : ""}>
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  {locating ? "Detecting GPS..." : "Auto-detect My Location"}
                </button>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500">Latitude</span>
                    <code className="bg-[#12141a] px-2 py-1 rounded text-[#79e0d8] border border-[#2a2e3a]">
                      {formData.lat.toFixed(6)}
                    </code>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500">Longitude</span>
                    <code className="bg-[#12141a] px-2 py-1 rounded text-[#79e0d8] border border-[#2a2e3a]">
                      {formData.lng.toFixed(6)}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#79e0d8] hover:bg-[#68d0c8] text-[#12141a] font-bold py-3 rounded-lg transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Finalizing Profile..." : "Initialize Dashboard"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .glass-panel {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        @keyframes pulse-ring {
          0% { transform: scale(.95); opacity: 1; }
          50% { transform: scale(1); opacity: .7; }
          100% { transform: scale(.95); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
