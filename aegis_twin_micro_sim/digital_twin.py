from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List, Tuple
import math

# ---------------------------------------------------------------------
# AEGIS-TWIN Predictive Micro-Simulation Sandbox
# Physics-inspired hackathon model — NOT flight-qualified.
# ---------------------------------------------------------------------

@dataclass
class SpacecraftState:
    bus_voltage_v: float = 7.6
    soc_pct: float = 62.0
    battery_temp_c: float = 31.0
    electronics_temp_c: float = 34.0
    solar_power_w: float = 5.5
    base_load_w: float = 6.8
    anomaly_extra_load_w: float = 0.0
    anomaly_heat_w: float = 0.0

@dataclass
class SafetyEnvelope:
    min_bus_voltage_v: float = 6.95
    max_battery_temp_c: float = 48.0
    max_electronics_temp_c: float = 60.0
    max_battery_current_a: float = 2.2
    min_soc_pct: float = 15.0

@dataclass
class ActionProfile:
    action_id: str
    label: str
    steady_load_delta_w: float
    transient_extra_w: float = 0.0
    transient_duration_s: float = 0.0
    heat_delta_w: float = 0.0
    recovery_bonus: float = 0.0

@dataclass
class SimulationResult:
    action_id: str
    label: str
    passed: bool
    score: float
    failure_reasons: List[str]
    min_bus_voltage_v: float
    max_battery_temp_c: float
    max_electronics_temp_c: float
    max_battery_current_a: float
    final_soc_pct: float
    trajectory: List[Dict[str, float]]

ACTIONS: Dict[str, ActionProfile] = {
    "NO_ACTION": ActionProfile(
        "NO_ACTION", "No action", 0.0, recovery_bonus=0.0
    ),
    "SHED_PAYLOAD": ActionProfile(
        "SHED_PAYLOAD", "Shed non-critical payload", -2.4, heat_delta_w=-0.7, recovery_bonus=0.72
    ),
    "REDUCE_COMPUTE": ActionProfile(
        "REDUCE_COMPUTE", "Throttle onboard compute", -1.2, heat_delta_w=-0.5, recovery_bonus=0.55
    ),
    "SAFE_MODE": ActionProfile(
        "SAFE_MODE", "Enter power-safe mode", -3.4, heat_delta_w=-0.9, recovery_bonus=0.90
    ),
    "RESTART_ADCS": ActionProfile(
        "RESTART_ADCS", "Restart ADCS controller", -0.3, transient_extra_w=5.0,
        transient_duration_s=3.0, heat_delta_w=0.4, recovery_bonus=0.82
    ),
}

PRESETS: Dict[str, SpacecraftState] = {
    "Nominal": SpacecraftState(),
    "Power anomaly": SpacecraftState(
        bus_voltage_v=7.25, soc_pct=42, battery_temp_c=35,
        electronics_temp_c=38, solar_power_w=3.2, base_load_w=7.0,
        anomaly_extra_load_w=2.8, anomaly_heat_w=0.5
    ),
    "Thermal anomaly": SpacecraftState(
        bus_voltage_v=7.45, soc_pct=58, battery_temp_c=41,
        electronics_temp_c=52, solar_power_w=5.0, base_load_w=6.5,
        anomaly_extra_load_w=0.8, anomaly_heat_w=3.0
    ),
    "Compound anomaly": SpacecraftState(
        bus_voltage_v=7.15, soc_pct=36, battery_temp_c=42,
        electronics_temp_c=51, solar_power_w=2.8, base_load_w=7.1,
        anomaly_extra_load_w=3.1, anomaly_heat_w=2.4
    ),
}

def _open_circuit_voltage(soc_pct: float) -> float:
    # Simple 2S Li-ion approximation for demo.
    # ~6.4 V near depleted, ~8.4 V near full.
    soc = max(0.0, min(100.0, soc_pct)) / 100.0
    return 6.4 + 2.0 * soc

def _thermal_step(temp_c: float, generated_w: float, ambient_c: float,
                  thermal_mass_j_per_c: float, thermal_resistance_c_per_w: float,
                  dt_s: float) -> float:
    # First-order lumped thermal model:
    # C*dT/dt = Pgen - (T-Tamb)/Rth
    cooling_w = (temp_c - ambient_c) / thermal_resistance_c_per_w
    dtemp = (generated_w - cooling_w) * dt_s / thermal_mass_j_per_c
    return temp_c + dtemp

def simulate(
    initial: SpacecraftState,
    action: ActionProfile,
    envelope: SafetyEnvelope = SafetyEnvelope(),
    duration_s: float = 30.0,
    dt_s: float = 0.5,
) -> SimulationResult:
    soc = initial.soc_pct
    battery_temp = initial.battery_temp_c
    elec_temp = initial.electronics_temp_c

    # Demo electrical assumptions
    capacity_ah = 4.0
    internal_resistance_ohm = 0.18
    converter_efficiency = 0.92
    ambient_c = 20.0

    # Thermal lumped parameters
    battery_c_j_per_c = 260.0
    battery_rth_c_per_w = 8.0
    elec_c_j_per_c = 150.0
    elec_rth_c_per_w = 6.0

    trajectory: List[Dict[str, float]] = []
    failure_reasons: List[str] = []
    min_v = 99.0
    max_i = 0.0
    max_tb = -99.0
    max_te = -99.0

    steps = max(1, int(duration_s / dt_s))
    for k in range(steps + 1):
        t = k * dt_s
        transient = action.transient_extra_w if t <= action.transient_duration_s else 0.0

        load_w = max(
            0.5,
            initial.base_load_w
            + initial.anomaly_extra_load_w
            + action.steady_load_delta_w
            + transient
        )
        net_battery_w = load_w / converter_efficiency - initial.solar_power_w

        voc = _open_circuit_voltage(soc)
        if net_battery_w >= 0:
            # Solve I from P = (Voc - I*R) * I
            # R I^2 - Voc I + P = 0 ; use physically-small root.
            disc = max(voc * voc - 4 * internal_resistance_ohm * net_battery_w, 0.0)
            current_a = (voc - math.sqrt(disc)) / (2 * internal_resistance_ohm)
            bus_v = max(0.0, voc - current_a * internal_resistance_ohm)
            soc -= (current_a * dt_s / 3600.0) / capacity_ah * 100.0
        else:
            # Charging case; clamp simple charge current.
            current_a = max(-1.5, net_battery_w / max(voc, 0.1))
            bus_v = min(8.4, voc - current_a * internal_resistance_ohm)
            soc -= (current_a * dt_s / 3600.0) / capacity_ah * 100.0

        soc = max(0.0, min(100.0, soc))

        battery_heat_w = (abs(current_a) ** 2) * internal_resistance_ohm + 0.08 * initial.anomaly_heat_w
        electronics_heat_w = max(0.0, 0.30 * load_w + initial.anomaly_heat_w + action.heat_delta_w)

        battery_temp = _thermal_step(
            battery_temp, battery_heat_w, ambient_c,
            battery_c_j_per_c, battery_rth_c_per_w, dt_s
        )
        elec_temp = _thermal_step(
            elec_temp, electronics_heat_w, ambient_c,
            elec_c_j_per_c, elec_rth_c_per_w, dt_s
        )

        min_v = min(min_v, bus_v)
        max_i = max(max_i, abs(current_a))
        max_tb = max(max_tb, battery_temp)
        max_te = max(max_te, elec_temp)

        trajectory.append({
            "t_s": round(t, 3),
            "bus_voltage_v": bus_v,
            "battery_current_a": current_a,
            "soc_pct": soc,
            "battery_temp_c": battery_temp,
            "electronics_temp_c": elec_temp,
            "load_w": load_w,
        })

    if min_v < envelope.min_bus_voltage_v:
        failure_reasons.append(
            f"Bus voltage {min_v:.2f} V fell below {envelope.min_bus_voltage_v:.2f} V"
        )
    if max_tb > envelope.max_battery_temp_c:
        failure_reasons.append(
            f"Battery temperature {max_tb:.1f} °C exceeded {envelope.max_battery_temp_c:.1f} °C"
        )
    if max_te > envelope.max_electronics_temp_c:
        failure_reasons.append(
            f"Electronics temperature {max_te:.1f} °C exceeded {envelope.max_electronics_temp_c:.1f} °C"
        )
    if max_i > envelope.max_battery_current_a:
        failure_reasons.append(
            f"Battery current {max_i:.2f} A exceeded {envelope.max_battery_current_a:.2f} A"
        )
    if soc < envelope.min_soc_pct:
        failure_reasons.append(
            f"SOC {soc:.1f}% fell below reserve {envelope.min_soc_pct:.1f}%"
        )

    passed = len(failure_reasons) == 0

    # Safety-margin score for ranking only. This is not an ML confidence score.
    voltage_margin = (min_v - envelope.min_bus_voltage_v) / 0.8
    battery_temp_margin = (envelope.max_battery_temp_c - max_tb) / 12.0
    elec_temp_margin = (envelope.max_electronics_temp_c - max_te) / 15.0
    current_margin = (envelope.max_battery_current_a - max_i) / 1.0

    margins = [
        max(-1.0, min(1.0, voltage_margin)),
        max(-1.0, min(1.0, battery_temp_margin)),
        max(-1.0, min(1.0, elec_temp_margin)),
        max(-1.0, min(1.0, current_margin)),
    ]
    margin_score = sum(margins) / len(margins)

    # Combine physical margin with how strongly the action addresses the anomaly.
    score = 100.0 * (0.72 * ((margin_score + 1.0) / 2.0) + 0.28 * action.recovery_bonus)
    if not passed:
        score -= 50.0
    score = max(0.0, min(100.0, score))

    return SimulationResult(
        action_id=action.action_id,
        label=action.label,
        passed=passed,
        score=score,
        failure_reasons=failure_reasons,
        min_bus_voltage_v=min_v,
        max_battery_temp_c=max_tb,
        max_electronics_temp_c=max_te,
        max_battery_current_a=max_i,
        final_soc_pct=soc,
        trajectory=trajectory,
    )

def evaluate_all(
    initial: SpacecraftState,
    envelope: SafetyEnvelope = SafetyEnvelope(),
    duration_s: float = 30.0
) -> List[SimulationResult]:
    results = [
        simulate(initial, action, envelope=envelope, duration_s=duration_s)
        for action in ACTIONS.values()
    ]
    return sorted(results, key=lambda r: (r.passed, r.score), reverse=True)

def obc_proposal(result: SimulationResult, ai_confidence: float = 0.91) -> Dict:
    return {
        "message_type": "AEGIS_RECOVERY_PROPOSAL",
        "template_id": result.action_id,
        "ai_diagnostic_confidence": round(float(ai_confidence), 3),
        "twin_validation": "PASS" if result.passed else "FAIL",
        "twin_safety_score": round(result.score / 100.0, 3),
        "predicted_min_bus_voltage_v": round(result.min_bus_voltage_v, 3),
        "predicted_max_battery_temp_c": round(result.max_battery_temp_c, 2),
        "predicted_max_electronics_temp_c": round(result.max_electronics_temp_c, 2),
        "predicted_max_current_a": round(result.max_battery_current_a, 3),
        "execute_authority": "OBC_ONLY",
    }
