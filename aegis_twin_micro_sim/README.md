# AEGIS-TWIN Predictive Micro-Simulation

This is a hackathon demonstration of the **Digital Twin Sandbox** concept.

It is intentionally a small, explainable, physics-inspired model rather than a high-fidelity
spacecraft simulator. The purpose is to prove the architecture:

1. OBC detects an ambiguous anomaly.
2. AEGIS receives a telemetry snapshot.
3. Every **pre-approved mitigation template** is simulated over a short horizon.
4. Predicted voltage, current and thermal values are checked against hard safety limits.
5. Unsafe candidates are blocked.
6. AEGIS returns a structured proposal containing only a template ID.
7. The deterministic OBC remains the sole execution authority.

## Run the hackathon prototype site

```bash
cd aegis_twin_micro_sim
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run dashboard.py
```

Open the Streamlit URL shown in the terminal. The prototype site is the main judge-facing
experience: it combines the mission console, fault injection controls, mitigation screening,
prediction charts, OBC proposal JSON and a short demo script.

On this Windows workspace, the working local command is:

```powershell
.\.venv\Scripts\python.exe -m streamlit run dashboard.py --server.address 0.0.0.0 --server.port 8501 --server.headless true
```

Then open:

```text
http://localhost:8501
```

### Best live demo sequence

1. Select **Compound anomaly**.
2. Show the candidate table: some actions PASS, others BLOCK.
3. Select `RESTART_ADCS` and point out its temporary power spike.
4. Increase the minimum allowed bus voltage or fault load.
5. Show that a previously accepted mitigation becomes BLOCKED.
6. Select `SAFE_MODE` and show the predicted voltage and thermal trajectories.
7. Show the JSON proposal and point out:
   - `template_id`
   - `twin_validation`
   - predicted safety values
   - `execute_authority: OBC_ONLY`

This makes it clear the demo is not a canned animation.

## Run the terminal architecture demo

```bash
python3 obc_demo.py
```

This prints the Master OBC → AEGIS → Digital Twin → OBC safety-gate sequence.

## Model used

### Electrical model

The demo treats the battery as an open-circuit voltage source with internal resistance.

- `V_oc` is approximated from battery state of charge.
- Net battery power is spacecraft load minus solar input.
- Battery current is solved from the power relationship.
- Predicted bus voltage includes internal-resistance sag.

### Thermal model

Each thermal node is represented by a first-order lumped model:

`C * dT/dt = P_generated - (T - T_ambient) / R_thermal`

The prototype tracks:
- battery temperature
- electronics temperature

### Hard safety envelope

The OBC checks:
- minimum bus voltage
- maximum battery temperature
- maximum electronics temperature
- maximum battery current
- minimum state of charge

## What NOT to claim

Do not call this a flight-qualified digital twin.

Say:

> "This prototype demonstrates the decision architecture using a reduced-order predictive
> model. In a flight system, these equations would be replaced or calibrated using the
> spacecraft's actual EPS, thermal and subsystem parameters plus hardware-in-the-loop tests."

That answer is technically stronger than pretending the hackathon model has flight fidelity.
