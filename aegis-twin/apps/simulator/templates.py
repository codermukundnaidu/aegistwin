from __future__ import annotations

from schemas import ActionProfile


ACTIONS: dict[str, ActionProfile] = {
    "NO_ACTION": ActionProfile(
        action_id="NO_ACTION",
        label="No action",
        steady_load_delta_w=0.0,
        recovery_bonus=0.0,
    ),
    "SHED_PAYLOAD": ActionProfile(
        action_id="SHED_PAYLOAD",
        label="Shed non-critical payload",
        steady_load_delta_w=-2.4,
        heat_delta_w=-0.7,
        recovery_bonus=0.72,
    ),
    "REDUCE_COMPUTE": ActionProfile(
        action_id="REDUCE_COMPUTE",
        label="Throttle onboard compute",
        steady_load_delta_w=-1.2,
        heat_delta_w=-0.5,
        recovery_bonus=0.55,
    ),
    "SAFE_MODE": ActionProfile(
        action_id="SAFE_MODE",
        label="Enter power-safe mode",
        steady_load_delta_w=-3.4,
        heat_delta_w=-0.9,
        recovery_bonus=0.90,
    ),
    "RESTART_ADCS": ActionProfile(
        action_id="RESTART_ADCS",
        label="Restart ADCS controller",
        steady_load_delta_w=-0.3,
        transient_extra_w=5.0,
        transient_duration_s=3.0,
        heat_delta_w=0.4,
        recovery_bonus=0.82,
    ),
}


PRESETS = {
    "Nominal": {
        "measured_bus_voltage_v": 7.6,
        "soc_pct": 62.0,
        "battery_temp_c": 31.0,
        "electronics_temp_c": 34.0,
        "solar_power_w": 5.5,
        "base_load_w": 6.8,
        "anomaly_extra_load_w": 0.0,
        "anomaly_heat_w": 0.0,
    },
    "Power anomaly": {
        "measured_bus_voltage_v": 7.25,
        "soc_pct": 42,
        "battery_temp_c": 35,
        "electronics_temp_c": 38,
        "solar_power_w": 3.2,
        "base_load_w": 7.0,
        "anomaly_extra_load_w": 2.8,
        "anomaly_heat_w": 0.5,
    },
    "Thermal anomaly": {
        "measured_bus_voltage_v": 7.45,
        "soc_pct": 58,
        "battery_temp_c": 41,
        "electronics_temp_c": 52,
        "solar_power_w": 5.0,
        "base_load_w": 6.5,
        "anomaly_extra_load_w": 0.8,
        "anomaly_heat_w": 3.0,
    },
    "Compound anomaly": {
        "measured_bus_voltage_v": 6.9,
        "soc_pct": 36,
        "battery_temp_c": 42,
        "electronics_temp_c": 51,
        "solar_power_w": 2.8,
        "base_load_w": 7.1,
        "anomaly_extra_load_w": 3.1,
        "anomaly_heat_w": 2.4,
    },
}
