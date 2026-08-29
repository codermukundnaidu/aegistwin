from __future__ import annotations

from schemas import SpacecraftState


def diagnostic_confidence(state: SpacecraftState) -> float:
    power_stress = max(0.0, 7.6 - state.measured_bus_voltage_v) / 1.4
    thermal_stress = max(0.0, state.electronics_temp_c - 42.0) / 22.0
    load_stress = min(1.0, state.anomaly_extra_load_w / 5.0)
    confidence = 0.48 + 0.22 * power_stress + 0.18 * thermal_stress + 0.12 * load_stress
    return round(max(0.0, min(0.99, confidence)), 3)
