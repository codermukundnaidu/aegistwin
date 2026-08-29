import sys
from pathlib import Path

from fastapi.testclient import TestClient

SIM_ROOT = Path(__file__).resolve().parents[2] / "apps" / "simulator"
sys.path.insert(0, str(SIM_ROOT))

from server import app  # noqa: E402
from templates import PRESETS  # noqa: E402


client = TestClient(app)


def payload(**overrides):
    base = {
        "state": PRESETS["Compound anomaly"],
        "rejection_scenario": "none",
        "inject_watchdog_timeout": False,
    }
    base.update(overrides)
    return base


def test_unknown_template_rejected():
    response = client.post("/simulate", json=payload(rejection_scenario="unknown_template"))
    data = response.json()

    assert response.status_code == 200
    assert data["selected_template_id"] is None
    assert "UNKNOWN_TEMPLATE" in data["rejection_reason"]


def test_malformed_message_rejected():
    response = client.post("/simulate", json=payload(rejection_scenario="malformed_message"))
    data = response.json()

    assert response.status_code == 200
    assert data["proposal"]["payload"] == "missing required fields"
    assert "MALFORMED_MESSAGE" in data["rejection_reason"]


def test_stale_proposal_rejected():
    response = client.post("/simulate", json=payload(rejection_scenario="stale_proposal"))
    data = response.json()

    assert response.status_code == 200
    assert data["proposal"]["expires_at_s"] < 0
    assert "STALE_PROPOSAL" in data["rejection_reason"]


def test_watchdog_timeout_rejected():
    response = client.post("/simulate", json=payload(inject_watchdog_timeout=True, watchdog_timeout_s=4))
    data = response.json()

    assert response.status_code == 200
    assert "WATCHDOG_TIMEOUT" in data["rejection_reason"]
    assert any("deadline expired" in line for line in data["terminal"])
