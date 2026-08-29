from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class MissionState(str, Enum):
    NOMINAL = "NOMINAL"
    ANOMALY_DETECTED = "ANOMALY_DETECTED"
    AI_WAKING = "AI_WAKING"
    AI_DIAGNOSING = "AI_DIAGNOSING"
    TWIN_EVALUATING = "TWIN_EVALUATING"
    PROPOSAL_READY = "PROPOSAL_READY"
    OBC_GATING = "OBC_GATING"
    RECOVERY_EXECUTING = "RECOVERY_EXECUTING"
    POST_VERIFY = "POST_VERIFY"
    AI_SLEEP = "AI_SLEEP"


class SpacecraftState(BaseModel):
    measured_bus_voltage_v: float = Field(7.6, ge=0)
    soc_pct: float = Field(62.0, ge=0, le=100)
    battery_temp_c: float = 31.0
    electronics_temp_c: float = 34.0
    solar_power_w: float = Field(5.5, ge=0)
    base_load_w: float = Field(6.8, ge=0)
    anomaly_extra_load_w: float = Field(0.0, ge=0)
    anomaly_heat_w: float = Field(0.0, ge=0)
    battery_capacity_ah: float = Field(4.0, gt=0)
    internal_resistance_ohm: float = Field(0.18, gt=0)
    converter_efficiency: float = Field(0.92, gt=0, le=1)


class SafetyEnvelope(BaseModel):
    min_bus_voltage_v: float = 6.95
    max_battery_temp_c: float = 48.0
    max_electronics_temp_c: float = 60.0
    max_battery_current_a: float = 2.2
    min_soc_pct: float = 15.0


class ActionProfile(BaseModel):
    action_id: str
    label: str
    steady_load_delta_w: float
    transient_extra_w: float = 0.0
    transient_duration_s: float = 0.0
    heat_delta_w: float = 0.0
    recovery_bonus: float = 0.0


class TelemetryPoint(BaseModel):
    t_s: float
    bus_voltage_v: float
    battery_current_a: float
    soc_pct: float
    battery_temp_c: float
    electronics_temp_c: float
    load_w: float


class LimitCheck(BaseModel):
    key: str
    label: str
    passed: bool
    limit: float
    predicted: float
    margin: float
    unit: str
    comparator: Literal[">=", "<="]


class SimulationResult(BaseModel):
    action_id: str
    label: str
    passed: bool
    score: float
    failure_reasons: list[str]
    checks: list[LimitCheck]
    min_bus_voltage_v: float
    max_battery_temp_c: float
    max_electronics_temp_c: float
    max_battery_current_a: float
    final_soc_pct: float
    estimated_initial_ocv_v: float
    voltage_anchor_error_v: float
    trajectory: list[TelemetryPoint]


class Proposal(BaseModel):
    message_type: Literal["AEGIS_RECOVERY_PROPOSAL"] = "AEGIS_RECOVERY_PROPOSAL"
    template_id: str
    ai_diagnostic_confidence: float
    twin_validation: Literal["PASS", "FAIL"]
    twin_safety_score: float
    predicted_min_bus_voltage_v: float
    predicted_max_battery_temp_c: float
    predicted_max_electronics_temp_c: float
    predicted_max_current_a: float
    issued_at_s: float
    expires_at_s: float
    execute_authority: Literal["OBC_ONLY"] = "OBC_ONLY"


class SimulationRequest(BaseModel):
    state: SpacecraftState = Field(default_factory=SpacecraftState)
    envelope: SafetyEnvelope = Field(default_factory=SafetyEnvelope)
    duration_s: float = Field(30.0, gt=0, le=300)
    dt_s: float = Field(0.25, gt=0, le=5)
    ai_confidence: float = Field(0.91, ge=0, le=1)
    watchdog_timeout_s: float = Field(8.0, gt=0)
    inject_watchdog_timeout: bool = False
    rejection_scenario: Literal["none", "unknown_template", "malformed_message", "stale_proposal"] = "none"


class MissionEvent(BaseModel):
    t_s: float
    state: MissionState
    source: str
    message: str
    bubble: str


class SimulationResponse(BaseModel):
    model_version: str
    mission_state: MissionState
    selected_template_id: str | None
    ai_diagnostic_confidence: float
    safety_validation: Literal["PASS", "FAIL"]
    proposal: Proposal | dict
    rejection_reason: str | None
    results: list[SimulationResult]
    top_three: list[SimulationResult]
    events: list[MissionEvent]
    terminal: list[str]
