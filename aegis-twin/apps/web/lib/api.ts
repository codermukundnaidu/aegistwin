import type { SafetyEnvelope, SimulationRequest, SimulationResponse, SpacecraftState } from "./types";

const API_URL = process.env.NEXT_PUBLIC_SIM_API_URL ?? "http://localhost:8000";

export const defaultState: SpacecraftState = {
  measured_bus_voltage_v: 7.4,
  soc_pct: 88,
  battery_temp_c: 28,
  electronics_temp_c: 32,
  solar_power_w: 11.2,
  base_load_w: 1.8,
  anomaly_extra_load_w: 0,
  anomaly_heat_w: 0,
  battery_capacity_ah: 4.0,
  internal_resistance_ohm: 0.18,
  converter_efficiency: 0.92,
};

export const defaultEnvelope: SafetyEnvelope = {
  min_bus_voltage_v: 6.0,
  max_battery_temp_c: 65,
  max_electronics_temp_c: 65,
  max_battery_current_a: 3.5,
  min_soc_pct: 30,
};

export const defaultRequest: SimulationRequest = {
  state: defaultState,
  envelope: defaultEnvelope,
  duration_s: 30,
  dt_s: 0.25,
  ai_confidence: 0.91,
  watchdog_timeout_s: 10,
  inject_watchdog_timeout: false,
  rejection_scenario: "none",
};

export async function simulate(request: SimulationRequest): Promise<SimulationResponse> {
  const response = await fetch(`${API_URL}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Simulator returned ${response.status}`);
  }
  return response.json() as Promise<SimulationResponse>;
}

export const fallbackResponse: SimulationResponse = {
  model_version: "offline-fallback",
  mission_state: "AI_SLEEP",
  selected_template_id: "SAFE_MODE",
  ai_diagnostic_confidence: 0.91,
  safety_validation: "PASS",
  rejection_reason: null,
  proposal: {
    message_type: "AEGIS_RECOVERY_PROPOSAL",
    template_id: "SAFE_MODE",
    ai_diagnostic_confidence: 0.91,
    twin_validation: "PASS",
    twin_safety_score: 0.807,
    predicted_min_bus_voltage_v: 6.995,
    predicted_max_battery_temp_c: 42.0,
    predicted_max_electronics_temp_c: 50.99,
    predicted_max_current_a: 0.656,
    issued_at_s: 5.2,
    expires_at_s: 13.2,
    execute_authority: "OBC_ONLY",
  },
  events: [
    { t_s: 0, state: "NOMINAL", source: "OBC", message: "Nominal telemetry loop active.", bubble: "The deterministic OBC owns the spacecraft." },
    { t_s: 1, state: "ANOMALY_DETECTED", source: "OBC", message: "Compound anomaly detected.", bubble: "Ambiguous telemetry wakes advisory AI." },
    { t_s: 2, state: "AI_WAKING", source: "OBC", message: "Edge AI powered; watchdog armed.", bubble: "The AI receives a timed compute window." },
    { t_s: 3, state: "TWIN_EVALUATING", source: "TWIN", message: "Candidate recoveries propagated.", bubble: "The twin predicts alternate futures before execution." },
    { t_s: 6, state: "OBC_GATING", source: "OBC", message: "Safety margins checked.", bubble: "Confidence is not permission." },
    { t_s: 10, state: "AI_SLEEP", source: "OBC", message: "AI domain disabled.", bubble: "The adviser goes back to sleep." },
  ],
  terminal: [
    "[OBC] ANOMALY_DETECTED: Compound anomaly detected.",
    "[TWIN] selected=SAFE_MODE gate=PASS",
    "[OBC] AUTHORIZED: deterministic firmware may execute whitelisted template.",
  ],
  results: [],
  top_three: [],
};
