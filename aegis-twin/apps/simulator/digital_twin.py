from __future__ import annotations

import math

from schemas import (
    ActionProfile,
    LimitCheck,
    SafetyEnvelope,
    SimulationResult,
    SpacecraftState,
    TelemetryPoint,
)
from templates import ACTIONS


MODEL_VERSION = "aegis-rom-0.3"


def open_circuit_voltage_from_soc(soc_pct: float) -> float:
    soc = max(0.0, min(100.0, soc_pct)) / 100.0
    return 6.4 + 2.0 * soc


def thermal_step(
    temp_c: float,
    generated_w: float,
    ambient_c: float,
    thermal_mass_j_per_c: float,
    thermal_resistance_c_per_w: float,
    dt_s: float,
) -> float:
    cooling_w = (temp_c - ambient_c) / thermal_resistance_c_per_w
    dtemp = (generated_w - cooling_w) * dt_s / thermal_mass_j_per_c
    return temp_c + dtemp


def solve_loaded_bus_voltage(voc: float, resistance_ohm: float, net_battery_w: float) -> tuple[float, float]:
    if net_battery_w >= 0:
        disc = max(voc * voc - 4 * resistance_ohm * net_battery_w, 0.0)
        current_a = (voc - math.sqrt(disc)) / (2 * resistance_ohm)
        bus_v = max(0.0, voc - current_a * resistance_ohm)
        return bus_v, current_a

    current_a = max(-1.5, net_battery_w / max(voc, 0.1))
    bus_v = min(8.4, voc - current_a * resistance_ohm)
    return bus_v, current_a


def estimate_initial_ocv(initial: SpacecraftState) -> tuple[float, float]:
    """Anchor propagation to measured voltage instead of SOC-only OCV.

    The earlier prototype exposed measured bus voltage but then propagated mostly
    from SOC-derived OCV. Here the measured loaded bus voltage participates in
    the initial Thevenin state estimate: estimate current from the measured
    loaded voltage and reconstruct OCV = Vbus + I*R. Future OCV changes follow
    SOC delta from that anchored initial estimate.
    """

    load_w = max(0.5, initial.base_load_w + initial.anomaly_extra_load_w)
    net_battery_w = load_w / initial.converter_efficiency - initial.solar_power_w
    measured_v = max(initial.measured_bus_voltage_v, 0.1)
    measured_current_a = net_battery_w / measured_v
    estimated_ocv = measured_v + measured_current_a * initial.internal_resistance_ohm
    soc_ocv = open_circuit_voltage_from_soc(initial.soc_pct)
    return estimated_ocv, estimated_ocv - soc_ocv


def simulate(
    initial: SpacecraftState,
    action: ActionProfile,
    envelope: SafetyEnvelope,
    duration_s: float = 30.0,
    dt_s: float = 0.25,
) -> SimulationResult:
    soc = initial.soc_pct
    battery_temp = initial.battery_temp_c
    elec_temp = initial.electronics_temp_c
    initial_ocv, voltage_anchor_error = estimate_initial_ocv(initial)

    ambient_c = 20.0
    battery_c_j_per_c = 260.0
    battery_rth_c_per_w = 8.0
    elec_c_j_per_c = 150.0
    elec_rth_c_per_w = 6.0

    trajectory: list[TelemetryPoint] = []
    failure_reasons: list[str] = []
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
            + transient,
        )
        net_battery_w = load_w / initial.converter_efficiency - initial.solar_power_w

        soc_delta_v = 2.0 * ((soc - initial.soc_pct) / 100.0)
        voc = initial_ocv + soc_delta_v
        bus_v, current_a = solve_loaded_bus_voltage(
            voc,
            initial.internal_resistance_ohm,
            net_battery_w,
        )

        soc -= (current_a * dt_s / 3600.0) / initial.battery_capacity_ah * 100.0
        soc = max(0.0, min(100.0, soc))

        battery_heat_w = (abs(current_a) ** 2) * initial.internal_resistance_ohm + 0.08 * initial.anomaly_heat_w
        electronics_heat_w = max(0.0, 0.30 * load_w + initial.anomaly_heat_w + action.heat_delta_w)

        battery_temp = thermal_step(
            battery_temp,
            battery_heat_w,
            ambient_c,
            battery_c_j_per_c,
            battery_rth_c_per_w,
            dt_s,
        )
        elec_temp = thermal_step(
            elec_temp,
            electronics_heat_w,
            ambient_c,
            elec_c_j_per_c,
            elec_rth_c_per_w,
            dt_s,
        )

        min_v = min(min_v, bus_v)
        max_i = max(max_i, abs(current_a))
        max_tb = max(max_tb, battery_temp)
        max_te = max(max_te, elec_temp)

        trajectory.append(
            TelemetryPoint(
                t_s=round(t, 3),
                bus_voltage_v=bus_v,
                battery_current_a=current_a,
                soc_pct=soc,
                battery_temp_c=battery_temp,
                electronics_temp_c=elec_temp,
                load_w=load_w,
            )
        )

    checks = [
        LimitCheck(
            key="bus_voltage",
            label="Minimum bus voltage",
            passed=min_v >= envelope.min_bus_voltage_v,
            limit=envelope.min_bus_voltage_v,
            predicted=min_v,
            margin=min_v - envelope.min_bus_voltage_v,
            unit="V",
            comparator=">=",
        ),
        LimitCheck(
            key="battery_temp",
            label="Maximum battery temperature",
            passed=max_tb <= envelope.max_battery_temp_c,
            limit=envelope.max_battery_temp_c,
            predicted=max_tb,
            margin=envelope.max_battery_temp_c - max_tb,
            unit="C",
            comparator="<=",
        ),
        LimitCheck(
            key="electronics_temp",
            label="Maximum electronics temperature",
            passed=max_te <= envelope.max_electronics_temp_c,
            limit=envelope.max_electronics_temp_c,
            predicted=max_te,
            margin=envelope.max_electronics_temp_c - max_te,
            unit="C",
            comparator="<=",
        ),
        LimitCheck(
            key="battery_current",
            label="Maximum battery current",
            passed=max_i <= envelope.max_battery_current_a,
            limit=envelope.max_battery_current_a,
            predicted=max_i,
            margin=envelope.max_battery_current_a - max_i,
            unit="A",
            comparator="<=",
        ),
        LimitCheck(
            key="reserve_soc",
            label="Minimum reserve SOC",
            passed=soc >= envelope.min_soc_pct,
            limit=envelope.min_soc_pct,
            predicted=soc,
            margin=soc - envelope.min_soc_pct,
            unit="%",
            comparator=">=",
        ),
    ]

    for check in checks:
        if not check.passed:
            failure_reasons.append(
                f"{check.label}: predicted {check.predicted:.3f}{check.unit} "
                f"violates limit {check.comparator} {check.limit:.3f}{check.unit} "
                f"(margin {check.margin:.3f}{check.unit})"
            )

    voltage_margin = (min_v - envelope.min_bus_voltage_v) / 0.8
    battery_temp_margin = (envelope.max_battery_temp_c - max_tb) / 12.0
    elec_temp_margin = (envelope.max_electronics_temp_c - max_te) / 15.0
    current_margin = (envelope.max_battery_current_a - max_i) / 1.0
    soc_margin = (soc - envelope.min_soc_pct) / 20.0

    margins = [voltage_margin, battery_temp_margin, elec_temp_margin, current_margin, soc_margin]
    margin_score = sum(max(-1.0, min(1.0, m)) for m in margins) / len(margins)
    score = 100.0 * (0.72 * ((margin_score + 1.0) / 2.0) + 0.28 * action.recovery_bonus)
    if failure_reasons:
        score -= 50.0
    score = max(0.0, min(100.0, score))

    return SimulationResult(
        action_id=action.action_id,
        label=action.label,
        passed=not failure_reasons,
        score=score,
        failure_reasons=failure_reasons,
        checks=checks,
        min_bus_voltage_v=min_v,
        max_battery_temp_c=max_tb,
        max_electronics_temp_c=max_te,
        max_battery_current_a=max_i,
        final_soc_pct=soc,
        estimated_initial_ocv_v=initial_ocv,
        voltage_anchor_error_v=voltage_anchor_error,
        trajectory=trajectory,
    )


def evaluate_all(
    initial: SpacecraftState,
    envelope: SafetyEnvelope,
    duration_s: float = 30.0,
    dt_s: float = 0.25,
) -> list[SimulationResult]:
    results = [
        simulate(initial, action, envelope=envelope, duration_s=duration_s, dt_s=dt_s)
        for action in ACTIONS.values()
    ]
    return sorted(results, key=lambda r: (r.passed, r.score), reverse=True)
