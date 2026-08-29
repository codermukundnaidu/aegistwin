from __future__ import annotations

import asyncio

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from anomaly_model import diagnostic_confidence
from digital_twin import MODEL_VERSION, evaluate_all
from mission import apply_rejection_scenario, make_events, make_proposal, terminal_lines
from schemas import MissionState, SimulationRequest, SimulationResponse, SpacecraftState
from templates import ACTIONS, PRESETS


app = FastAPI(title="AEGIS-TWIN Simulator", version=MODEL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model_version": MODEL_VERSION}


@app.get("/scenarios")
def scenarios() -> dict:
    return PRESETS


@app.get("/templates")
def templates() -> dict:
    return {key: action.model_dump() for key, action in ACTIONS.items()}


@app.post("/simulate", response_model=SimulationResponse)
def simulate(request: SimulationRequest) -> SimulationResponse:
    confidence = diagnostic_confidence(request.state)
    if request.ai_confidence != 0.91:
        confidence = request.ai_confidence

    results = evaluate_all(
        request.state,
        request.envelope,
        duration_s=request.duration_s,
        dt_s=request.dt_s,
    )
    selected = next((result for result in results if result.passed), results[0] if results else None)
    proposal = make_proposal(selected, request, confidence) if selected else {}
    proposal_or_bad, rejection_reason = apply_rejection_scenario(proposal, request) if selected else ({}, "NO_CANDIDATES")
    events = make_events(request, selected)

    if rejection_reason:
        safety_validation = "FAIL"
        mission_state = MissionState.AI_SLEEP
    else:
        safety_validation = "PASS" if selected and selected.passed else "FAIL"
        mission_state = MissionState.AI_SLEEP

    return SimulationResponse(
        model_version=MODEL_VERSION,
        mission_state=mission_state,
        selected_template_id=selected.action_id if selected and selected.passed and not rejection_reason else None,
        ai_diagnostic_confidence=confidence,
        safety_validation=safety_validation,
        proposal=proposal_or_bad,
        rejection_reason=rejection_reason,
        results=results,
        top_three=results[:3],
        events=events,
        terminal=terminal_lines(selected, proposal_or_bad, rejection_reason, events),
    )


@app.websocket("/ws/events")
async def event_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    request = SimulationRequest(state=SpacecraftState(**PRESETS["Compound anomaly"]))
    response = simulate(request)
    for event in response.events:
        await websocket.send_json(event.model_dump())
        await asyncio.sleep(0.35)
    await websocket.send_json({"state": "COMPLETE", "message": "Mission replay complete."})
