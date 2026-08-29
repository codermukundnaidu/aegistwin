import json
import time
from digital_twin import PRESETS, SafetyEnvelope, evaluate_all, obc_proposal

def line(text="", delay=0.18):
    print(text)
    time.sleep(delay)

state = PRESETS["Compound anomaly"]
envelope = SafetyEnvelope()

line("\n[OBC] Telemetry anomaly detected.")
line("[OBC] Conventional FDIR: no single deterministic rule explains correlated state.")
line("[OBC] AEGIS_ENABLE = 1")
line("[WATCHDOG] AI compute window opened.")
line("[AEGIS] Evaluating pre-approved mitigation templates...\n")

results = evaluate_all(state, envelope)

for r in results:
    status = "PASS" if r.passed else "BLOCK"
    reason = "inside safety envelope" if r.passed else " | ".join(r.failure_reasons)
    line(
        f"[TWIN] {r.action_id:<16} {status:<5} "
        f"score={r.score:5.1f}  minV={r.min_bus_voltage_v:4.2f}V  "
        f"maxI={r.max_battery_current_a:4.2f}A  {reason}",
        0.12,
    )

best = next((r for r in results if r.passed), None)

if best:
    line("\n[AEGIS] Candidate selected: " + best.action_id)
    proposal = obc_proposal(best)
    line("[AEGIS -> OBC] " + json.dumps(proposal))
    line("[OBC] Verifying whitelist, timing, safety envelope and template authority...")
    line("[OBC] AUTHORIZED: deterministic firmware may execute template.")
else:
    line("\n[AEGIS] No mitigation passed the sandbox.")
    line("[OBC] AI proposal rejected. Entering deterministic fallback policy.")

line("[OBC] AEGIS_ENABLE = 0")
line("[WATCHDOG] AI compute window closed.\n")
