"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultRequest, fallbackResponse, simulate } from "@/lib/api";
import type { SimulationRequest, SimulationResponse } from "@/lib/types";
import { MissionControlDashboard } from "@/components/mission/MissionControlDashboard";
import { getPitchStepCount, PitchMode } from "@/components/pitch/PitchMode";

type ViewMode = "PITCH" | "DASHBOARD";

export function DemoShell({ kioskDefault = false }: { active?: string; kioskDefault?: boolean }) {
  const [viewMode, setViewMode] = useState<ViewMode>(kioskDefault ? "DASHBOARD" : "PITCH");
  const [pitchStep, setPitchStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [request, setRequest] = useState<SimulationRequest>(defaultRequest);
  const [response, setResponse] = useState<SimulationResponse>(fallbackResponse);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [activeSubsystem, setActiveSubsystem] = useState("master-obc");
  const [activeEvent, setActiveEvent] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);
      simulate(request)
        .then((next) => {
          setResponse(next);
          setOffline(false);
          setSelectedId(next.selected_template_id ?? next.top_three[0]?.action_id ?? null);
        })
        .catch(() => {
          setResponse(fallbackResponse);
          setOffline(true);
          setSelectedId("SAFE_MODE");
        })
        .finally(() => setLoading(false));
    }, 180);

    return () => window.clearTimeout(handle);
  }, [request]);

  useEffect(() => {
    if (viewMode !== "DASHBOARD" || response.events.length === 0) return undefined;

    const timer = window.setInterval(() => {
      setActiveEvent((index) => (index + 1) % response.events.length);
    }, 1450);

    return () => window.clearInterval(timer);
  }, [response.events.length, viewMode]);

  const selectedResult = useMemo(() => {
    return response.results.find((result) => result.action_id === selectedId) ?? response.results[0] ?? null;
  }, [response.results, selectedId]);

  const initializeDemo = () => {
    setTransitioning(true);
    window.setTimeout(() => setViewMode("DASHBOARD"), 720);
    window.setTimeout(() => setTransitioning(false), 1180);
  };

  const previousPitchStep = () => setPitchStep((step) => Math.max(0, step - 1));
  const nextPitchStep = () => setPitchStep((step) => Math.min(getPitchStepCount() - 1, step + 1));

  return (
    <div className={`two-state-shell ${viewMode === "DASHBOARD" ? "dashboard-mode" : "pitch-mode"} ${transitioning ? "is-transitioning" : ""}`}>
      {viewMode === "PITCH" ? (
        <PitchMode
          pitchStep={pitchStep}
          transitioning={transitioning}
          onBack={previousPitchStep}
          onNext={nextPitchStep}
          onInitialize={initializeDemo}
        />
      ) : (
        <MissionControlDashboard
          request={request}
          response={response}
          selectedResult={selectedResult}
          selectedId={selectedId}
          onRequestChange={setRequest}
          onSelectResult={setSelectedId}
          activeSubsystem={activeSubsystem}
          onSubsystem={setActiveSubsystem}
          activeEvent={activeEvent}
          onActiveEvent={setActiveEvent}
          loading={loading}
          offline={offline}
        />
      )}
    </div>
  );
}
