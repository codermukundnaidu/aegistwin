export type MissionMode = "architecture" | "evidence" | "hardware" | "protocol" | "sandbox" | "demo";

export type MissionState =
  | "NOMINAL"
  | "ANOMALY_DETECTED"
  | "AI_WAKING"
  | "AI_DIAGNOSING"
  | "TWIN_EVALUATING"
  | "PROPOSAL_READY"
  | "OBC_GATING"
  | "RECOVERY_EXECUTING"
  | "POST_VERIFY"
  | "AI_SLEEP";

export type RejectionScenario = "none" | "unknown_template" | "malformed_message" | "stale_proposal";

export interface SpacecraftState {
  measured_bus_voltage_v: number;
  soc_pct: number;
  battery_temp_c: number;
  electronics_temp_c: number;
  solar_power_w: number;
  base_load_w: number;
  anomaly_extra_load_w: number;
  anomaly_heat_w: number;
  battery_capacity_ah: number;
  internal_resistance_ohm: number;
  converter_efficiency: number;
}

export interface SafetyEnvelope {
  min_bus_voltage_v: number;
  max_battery_temp_c: number;
  max_electronics_temp_c: number;
  max_battery_current_a: number;
  min_soc_pct: number;
}

export interface SimulationRequest {
  state: SpacecraftState;
  envelope: SafetyEnvelope;
  duration_s: number;
  dt_s: number;
  ai_confidence: number;
  watchdog_timeout_s: number;
  inject_watchdog_timeout: boolean;
  rejection_scenario: RejectionScenario;
}

export interface TelemetryPoint {
  t_s: number;
  bus_voltage_v: number;
  battery_current_a: number;
  soc_pct: number;
  battery_temp_c: number;
  electronics_temp_c: number;
  load_w: number;
}

export interface LimitCheck {
  key: string;
  label: string;
  passed: boolean;
  limit: number;
  predicted: number;
  margin: number;
  unit: string;
  comparator: ">=" | "<=";
}

export interface SimulationResult {
  action_id: string;
  label: string;
  passed: boolean;
  score: number;
  failure_reasons: string[];
  checks: LimitCheck[];
  min_bus_voltage_v: number;
  max_battery_temp_c: number;
  max_electronics_temp_c: number;
  max_battery_current_a: number;
  final_soc_pct: number;
  estimated_initial_ocv_v: number;
  voltage_anchor_error_v: number;
  trajectory: TelemetryPoint[];
}

export interface MissionEvent {
  t_s: number;
  state: MissionState;
  source: string;
  message: string;
  bubble: string;
}

export interface Proposal {
  message_type?: string;
  template_id?: string;
  ai_diagnostic_confidence?: number;
  twin_validation?: "PASS" | "FAIL";
  twin_safety_score?: number;
  predicted_min_bus_voltage_v?: number;
  predicted_max_battery_temp_c?: number;
  predicted_max_electronics_temp_c?: number;
  predicted_max_current_a?: number;
  issued_at_s?: number;
  expires_at_s?: number;
  execute_authority?: "OBC_ONLY";
  payload?: string;
}

export interface SimulationResponse {
  model_version: string;
  mission_state: MissionState;
  selected_template_id: string | null;
  ai_diagnostic_confidence: number;
  safety_validation: "PASS" | "FAIL";
  proposal: Proposal;
  rejection_reason: string | null;
  results: SimulationResult[];
  top_three: SimulationResult[];
  events: MissionEvent[];
  terminal: string[];
}
