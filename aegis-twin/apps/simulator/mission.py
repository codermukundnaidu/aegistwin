from __future__ import annotations

from schemas import MissionEvent, MissionState, Proposal, SimulationRequest, SimulationResult


MISSION_SCRIPT = [
    (0.0, MissionState.NOMINAL, "OBC", "Nominal telemetry loop active.", "Deterministic flight software owns the spacecraft."),
    (0.8, MissionState.ANOMALY_DETECTED, "OBC", "Correlated power and thermal anomaly detected.", "The anomaly is ambiguous enough to wake advisory AI."),
    (1.5, MissionState.AI_WAKING, "OBC", "Edge AI power domain enabled; watchdog armed.", "The AI gets a timed compute window, not permanent authority."),
    (2.4, MissionState.AI_DIAGNOSING, "EDGE_AI", "Diagnostic model ranks approved recovery templates.", "Confidence helps ranking, but it is not permission."),
    (3.6, MissionState.TWIN_EVALUATING, "TWIN", "Digital twin propagates candidate futures.", "Each candidate has its own voltage, current, SOC and thermal path."),
    (5.2, MissionState.PROPOSAL_READY, "EDGE_AI", "Structured recovery proposal emitted.", "The proposal contains a template ID, not actuator commands."),
    (6.0, MissionState.OBC_GATING, "OBC", "Whitelist, freshness, deadline and safety margins checked.", "One violated hard limit beats any diagnostic confidence."),
    (7.2, MissionState.RECOVERY_EXECUTING, "OBC", "Verified recovery routine executing.", "Only deterministic firmware can execute the template."),
    (8.8, MissionState.POST_VERIFY, "OBC", "Post-action telemetry verification running.", "The OBC checks that the spacecraft is recovering."),
    (10.0, MissionState.AI_SLEEP, "OBC", "AI power domain disabled.", "The expensive advisory domain goes back to sleep."),
]


def make_events(request: SimulationRequest, selected: SimulationResult | None) -> list[MissionEvent]:
    if request.inject_watchdog_timeout:
        return [
            MissionEvent(t_s=t, state=state, source=source, message=message, bubble=bubble)
            for t, state, source, message, bubble in MISSION_SCRIPT[:5]
        ] + [
            MissionEvent(
                t_s=request.watchdog_timeout_s,
                state=MissionState.OBC_GATING,
                source="WATCHDOG",
                message="AI compute deadline expired; proposal rejected.",
                bubble="The watchdog proves the AI can fail without taking the spacecraft with it.",
            ),
            MissionEvent(
                t_s=request.watchdog_timeout_s + 0.4,
                state=MissionState.AI_SLEEP,
                source="OBC",
                message="AI domain powered down; deterministic fallback selected.",
                bubble="Authority remains on the Master OBC side of the boundary.",
            ),
        ]

    events = [MissionEvent(t_s=t, state=state, source=source, message=message, bubble=bubble) for t, state, source, message, bubble in MISSION_SCRIPT]
    if selected and not selected.passed:
        events[6].message = "OBC hard gates blocked every candidate."
        events[7].message = "Deterministic fallback policy executing."
    return events


def make_proposal(selected: SimulationResult, request: SimulationRequest, confidence: float) -> Proposal:
    issued_at = 5.2
    expires_at = issued_at + request.watchdog_timeout_s
    return Proposal(
        template_id=selected.action_id,
        ai_diagnostic_confidence=round(float(confidence), 3),
        twin_validation="PASS" if selected.passed else "FAIL",
        twin_safety_score=round(selected.score / 100.0, 3),
        predicted_min_bus_voltage_v=round(selected.min_bus_voltage_v, 3),
        predicted_max_battery_temp_c=round(selected.max_battery_temp_c, 2),
        predicted_max_electronics_temp_c=round(selected.max_electronics_temp_c, 2),
        predicted_max_current_a=round(selected.max_battery_current_a, 3),
        issued_at_s=issued_at,
        expires_at_s=expires_at,
    )


def apply_rejection_scenario(proposal: Proposal, request: SimulationRequest) -> tuple[Proposal | dict, str | None]:
    if request.inject_watchdog_timeout:
        return proposal, "WATCHDOG_TIMEOUT: AI compute window expired before a valid proposal reached OBC."
    if request.rejection_scenario == "unknown_template":
        bad = proposal.model_dump()
        bad["template_id"] = "DEPLOY_UNAPPROVED_THRUSTER"
        return bad, "UNKNOWN_TEMPLATE: proposal template_id is not in the OBC whitelist."
    if request.rejection_scenario == "malformed_message":
        return {"message_type": "AEGIS_RECOVERY_PROPOSAL", "payload": "missing required fields"}, "MALFORMED_MESSAGE: required proposal fields are absent."
    if request.rejection_scenario == "stale_proposal":
        bad = proposal.model_copy(update={"issued_at_s": -60.0, "expires_at_s": -50.0})
        return bad, "STALE_PROPOSAL: proposal freshness window has expired."
    return proposal, None


def terminal_lines(
    selected: SimulationResult | None,
    proposal: Proposal | dict,
    rejection_reason: str | None,
    events: list[MissionEvent],
) -> list[str]:
    lines = [f"[{event.source}] {event.state.value}: {event.message}" for event in events]
    if selected:
        lines.append(f"[TWIN] selected={selected.action_id} gate={'PASS' if selected.passed else 'BLOCK'} score={selected.score:.1f}")
    if rejection_reason:
        lines.append(f"[OBC] REJECTED: {rejection_reason}")
    else:
        lines.append(f"[AEGIS -> OBC] {proposal}")
        lines.append("[OBC] AUTHORIZED: deterministic firmware may execute whitelisted template.")
    return lines
