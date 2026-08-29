# AEGIS-TWIN

Interactive demonstrator for bounded spacecraft autonomy.

Core sentence:

```text
AI diagnoses. The twin predicts. Deterministic logic decides.
```

This repository contains a Next.js 16.3.3 + React/TypeScript frontend and a
FastAPI simulation backend. The prototype is offline-first and hackathon-safe:
it demonstrates the trust boundary, state machine, predictive micro-simulation,
and OBC gating without claiming flight qualification.

## Run Locally

Backend:

```powershell
cd apps\simulator
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```powershell
cd apps\web
npm.cmd install
npm.cmd run dev
```

Open:

```text
http://localhost:7860
```

## Hackathon Flow

1. Start in Demo mode.
2. Inject the compound anomaly.
3. Show the mission state machine from `NOMINAL` to `AI_SLEEP`.
4. Click spacecraft subsystems in the 3D CubeSat.
5. Compare three ghost future branches.
6. Point to a real `✓ PASS` or `✕ BLOCK` margin calculation.
7. Trigger watchdog timeout or protocol rejection scenarios.
8. Show the JSON proposal and OBC terminal replay.

## Safety Claim

This is a reduced-order architecture prototype. A flight system would require
mission-specific EPS and thermal models, radiation analysis, qualification,
hardware-in-the-loop validation, FMEA/FMECA, command whitelisting under
configuration control, and mission-level verification.
