import sys
from pathlib import Path

SIM_ROOT = Path(__file__).resolve().parents[2] / "apps" / "simulator"
sys.path.insert(0, str(SIM_ROOT))

from digital_twin import estimate_initial_ocv, evaluate_all  # noqa: E402
from schemas import SafetyEnvelope, SpacecraftState  # noqa: E402
from templates import ACTIONS, PRESETS  # noqa: E402


def test_measured_bus_voltage_anchors_prediction_path():
    low = SpacecraftState(**PRESETS["Compound anomaly"])
    high = low.model_copy(update={"measured_bus_voltage_v": low.measured_bus_voltage_v + 0.4})

    low_results = evaluate_all(low, SafetyEnvelope())
    high_results = evaluate_all(high, SafetyEnvelope())

    low_restart = next(result for result in low_results if result.action_id == "RESTART_ADCS")
    high_restart = next(result for result in high_results if result.action_id == "RESTART_ADCS")

    assert high_restart.min_bus_voltage_v > low_restart.min_bus_voltage_v + 0.25


def test_every_template_returns_limit_checks_and_trajectory():
    results = evaluate_all(SpacecraftState(**PRESETS["Compound anomaly"]), SafetyEnvelope())

    assert len(results) == len(ACTIONS)
    assert all(len(result.checks) == 5 for result in results)
    assert all(len(result.trajectory) == 121 for result in results)


def test_initial_ocv_reports_soc_bias_for_traceability():
    state = SpacecraftState(**{**PRESETS["Compound anomaly"], "measured_bus_voltage_v": 7.25})
    estimated_ocv, anchor_error = estimate_initial_ocv(state)

    assert estimated_ocv > state.measured_bus_voltage_v
    assert abs(anchor_error) > 0.01
