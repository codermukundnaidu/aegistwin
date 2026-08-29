from __future__ import annotations

import json
from typing import Iterable

import altair as alt
import pandas as pd
import streamlit as st

from digital_twin import (
    ACTIONS,
    PRESETS,
    SafetyEnvelope,
    SpacecraftState,
    evaluate_all,
    obc_proposal,
)


st.set_page_config(
    page_title="AEGIS-TWIN Mission Console",
    page_icon="AEGIS",
    layout="wide",
    initial_sidebar_state="expanded",
)


ACCENT = "#00a6a6"
SUCCESS = "#1f9d55"
DANGER = "#d64545"
INK = "#18212f"
MUTED = "#667085"
PANEL = "#f5f7fb"
LINE = "#d9e2ec"


st.markdown(
    f"""
    <style>
    :root {{
        --accent: {ACCENT};
        --success: {SUCCESS};
        --danger: {DANGER};
        --ink: {INK};
        --muted: {MUTED};
        --panel: {PANEL};
        --line: {LINE};
    }}
    .stApp {{
        background:
            radial-gradient(circle at top left, rgba(0, 166, 166, 0.11), transparent 28rem),
            linear-gradient(180deg, #ffffff 0%, #f7fafc 48%, #eef4f7 100%);
        color: var(--ink);
    }}
    h1, h2, h3 {{
        letter-spacing: 0;
    }}
    section[data-testid="stSidebar"] {{
        background: #101828;
        color: #ffffff;
    }}
    section[data-testid="stSidebar"] label,
    section[data-testid="stSidebar"] p,
    section[data-testid="stSidebar"] span {{
        color: rgba(255, 255, 255, 0.86);
    }}
    section[data-testid="stSidebar"] h2,
    section[data-testid="stSidebar"] h3 {{
        color: #ffffff;
    }}
    .hero {{
        border: 1px solid rgba(24, 33, 47, 0.10);
        border-radius: 8px;
        background:
            linear-gradient(135deg, rgba(16, 24, 40, 0.96), rgba(17, 65, 80, 0.94)),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 64px);
        color: #ffffff;
        padding: 1.35rem 1.5rem;
        margin-bottom: 1rem;
    }}
    .hero h1 {{
        margin: 0 0 0.35rem 0;
        font-size: clamp(2.1rem, 5vw, 4.3rem);
        line-height: 1;
    }}
    .hero p {{
        max-width: 70rem;
        color: rgba(255, 255, 255, 0.78);
        font-size: 1.03rem;
        margin: 0;
    }}
    .signal-grid {{
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.75rem;
        margin: 0.75rem 0 1.1rem;
    }}
    .signal {{
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.84);
        padding: 0.85rem 0.95rem;
        min-height: 5.2rem;
    }}
    .signal span {{
        display: block;
        color: var(--muted);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.05rem;
    }}
    .signal strong {{
        display: block;
        margin-top: 0.28rem;
        color: var(--ink);
        font-size: 1.45rem;
        line-height: 1.1;
    }}
    .stage {{
        border-left: 4px solid var(--accent);
        background: rgba(255, 255, 255, 0.72);
        padding: 0.95rem 1rem;
        margin: 0.4rem 0 1rem;
    }}
    .stage strong {{
        color: var(--ink);
    }}
    .pill {{
        display: inline-block;
        border-radius: 999px;
        padding: 0.2rem 0.6rem;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.03rem;
        text-transform: uppercase;
    }}
    .pass {{
        background: rgba(31, 157, 85, 0.12);
        color: var(--success);
    }}
    .block {{
        background: rgba(214, 69, 69, 0.12);
        color: var(--danger);
    }}
    .muted {{
        color: var(--muted);
    }}
    .small {{
        font-size: 0.88rem;
    }}
    div[data-testid="stMetric"] {{
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.82);
        border-radius: 8px;
        padding: 0.8rem 0.9rem;
    }}
    div[data-testid="stDataFrame"] {{
        border: 1px solid var(--line);
        border-radius: 8px;
        overflow: hidden;
    }}
    .stButton button {{
        border-radius: 8px;
        font-weight: 700;
    }}
    @media (max-width: 900px) {{
        .signal-grid {{
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }}
        .hero h1 {{
            font-size: 2.3rem;
        }}
    }}
    @media (max-width: 560px) {{
        .signal-grid {{
            grid-template-columns: 1fr;
        }}
    }}
    </style>
    """,
    unsafe_allow_html=True,
)


_default_preset = list(PRESETS.keys())[3]
if "active_preset" not in st.session_state:
    st.session_state.active_preset = _default_preset
if "fault_extra" not in st.session_state:
    st.session_state.fault_extra = float(PRESETS[_default_preset].anomaly_extra_load_w)
if "fault_heat" not in st.session_state:
    st.session_state.fault_heat = float(PRESETS[_default_preset].anomaly_heat_w)


def fmt(value: float, suffix: str, digits: int = 1) -> str:
    return f"{value:.{digits}f}{suffix}"


def result_status(result) -> str:
    return "PASS" if result.passed else "BLOCK"


def dataframe_for_results(results: Iterable) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Template ID": r.action_id,
                "Mitigation": r.label,
                "Twin gate": result_status(r),
                "Score": round(r.score, 1),
                "Min bus V": round(r.min_bus_voltage_v, 2),
                "Max current A": round(r.max_battery_current_a, 2),
                "Max battery C": round(r.max_battery_temp_c, 1),
                "Max electronics C": round(r.max_electronics_temp_c, 1),
                "Safety rationale": "Inside safety envelope"
                if r.passed
                else "; ".join(r.failure_reasons),
            }
            for r in results
        ]
    )


def line_chart(
    source: pd.DataFrame,
    y: str,
    label: str,
    color: str,
    limit_value: float | None = None,
    limit_label: str | None = None,
) -> alt.Chart:
    base = alt.Chart(source).encode(x=alt.X("t_s:Q", title="Prediction horizon, seconds"))
    chart = base.mark_line(point=False, strokeWidth=3, color=color).encode(
        y=alt.Y(f"{y}:Q", title=label),
        tooltip=[
            alt.Tooltip("t_s:Q", title="t", format=".1f"),
            alt.Tooltip(f"{y}:Q", title=label, format=".3f"),
        ],
    )
    if limit_value is None:
        return chart.properties(height=260)

    limit = (
        alt.Chart(pd.DataFrame({"limit": [limit_value], "name": [limit_label or "limit"]}))
        .mark_rule(strokeDash=[6, 5], color=DANGER, strokeWidth=2)
        .encode(y="limit:Q", tooltip=["name:N", "limit:Q"])
    )
    return (chart + limit).properties(height=260)


def thermal_chart(source: pd.DataFrame, envelope: SafetyEnvelope) -> alt.Chart:
    thermal = source[["t_s", "battery_temp_c", "electronics_temp_c"]].melt(
        id_vars="t_s", var_name="node", value_name="temperature_c"
    )
    thermal["node"] = thermal["node"].map(
        {
            "battery_temp_c": "Battery",
            "electronics_temp_c": "Electronics",
        }
    )
    temps = (
        alt.Chart(thermal)
        .mark_line(strokeWidth=3)
        .encode(
            x=alt.X("t_s:Q", title="Prediction horizon, seconds"),
            y=alt.Y("temperature_c:Q", title="Temperature, C"),
            color=alt.Color(
                "node:N",
                scale=alt.Scale(range=["#e9862a", "#7a5cff"]),
                legend=alt.Legend(title=None),
            ),
            tooltip=[
                alt.Tooltip("t_s:Q", title="t", format=".1f"),
                "node:N",
                alt.Tooltip("temperature_c:Q", title="temp C", format=".2f"),
            ],
        )
    )
    limits = pd.DataFrame(
        {
            "limit": [envelope.max_battery_temp_c, envelope.max_electronics_temp_c],
            "name": ["Battery limit", "Electronics limit"],
        }
    )
    limit_rules = (
        alt.Chart(limits)
        .mark_rule(strokeDash=[6, 5], color=DANGER, strokeWidth=2)
        .encode(y="limit:Q", tooltip=["name:N", "limit:Q"])
    )
    return (temps + limit_rules).properties(height=260)


with st.sidebar:
    st.header("Mission Inputs")

    st.subheader("Fault Scenario")
    _preset_keys = list(PRESETS.keys())
    _sc = st.columns(2)
    for _pi, _pname in enumerate(_preset_keys):
        _active = st.session_state.active_preset == _pname
        if _sc[_pi % 2].button(
            f"{'▶ ' if _active else ''}{_pname}",
            use_container_width=True,
            key=f"preset_btn_{_pi}",
            type="primary" if _active else "secondary",
        ):
            st.session_state.active_preset = _pname
            st.session_state.fault_extra = float(PRESETS[_pname].anomaly_extra_load_w)
            st.session_state.fault_heat = float(PRESETS[_pname].anomaly_heat_w)
            st.rerun()

    st.subheader("OBC Safety Envelope")
    min_v = st.slider("Minimum bus voltage, V", 5.0, 8.0, 6.95, 0.05)
    max_batt_t = st.slider("Maximum battery temperature, C", 20.0, 80.0, 48.0, 0.5)
    max_elec_t = st.slider("Maximum electronics temperature, C", 30.0, 100.0, 60.0, 0.5)
    max_i = st.slider("Maximum battery current, A", 0.2, 6.0, 2.2, 0.1)
    min_soc = st.slider("Minimum reserve SOC, %", 0.0, 50.0, 15.0, 1.0)

p = PRESETS[st.session_state.active_preset]
preset_name = st.session_state.active_preset
bus_v = p.bus_voltage_v
soc = p.soc_pct
batt_t = p.battery_temp_c
elec_t = p.electronics_temp_c
solar = p.solar_power_w
base = p.base_load_w
extra = st.session_state.fault_extra
heat = st.session_state.fault_heat

state = SpacecraftState(
    bus_voltage_v=bus_v,
    soc_pct=soc,
    battery_temp_c=batt_t,
    electronics_temp_c=elec_t,
    solar_power_w=solar,
    base_load_w=base,
    anomaly_extra_load_w=extra,
    anomaly_heat_w=heat,
)
envelope = SafetyEnvelope(
    min_bus_voltage_v=min_v,
    max_battery_temp_c=max_batt_t,
    max_electronics_temp_c=max_elec_t,
    max_battery_current_a=max_i,
    min_soc_pct=min_soc,
)
results = evaluate_all(state, envelope)
best = next((r for r in results if r.passed), results[0])
best_is_authorized = best.passed
proposal = obc_proposal(best, ai_confidence=0.91)

st.markdown(
    """
    <div class="hero">
        <h1>AEGIS-TWIN</h1>
        <p>
        A predictive recovery sandbox for spacecraft anomalies. The AI proposes only a
        whitelisted mitigation template; the digital twin simulates the consequences;
        the deterministic OBC remains the execution authority.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

gate_class = "pass" if best_is_authorized else "block"
gate_text = "Authorized candidate" if best_is_authorized else "No safe candidate"
st.markdown(
    f"""
    <div class="signal-grid">
        <div class="signal"><span>Active scenario</span><strong>{preset_name}</strong></div>
        <div class="signal"><span>Best template</span><strong>{best.action_id}</strong></div>
        <div class="signal"><span>Twin gate</span><strong><span class="pill {gate_class}">{gate_text}</span></strong></div>
        <div class="signal"><span>Prediction horizon</span><strong>30 s</strong></div>
    </div>
    """,
    unsafe_allow_html=True,
)

if best_is_authorized:
    st.success(
        f"The sandbox selects {best.action_id}: predicted voltage, current, thermal state, "
        "and reserve SOC stay inside the configured OBC envelope."
    )
else:
    st.error(
        "Every candidate violates at least one hard boundary. The AI proposal is blocked "
        "and the deterministic fallback policy should take over."
    )

st.markdown(
    """
    <div class="stage">
        <strong>Prototype thesis.</strong>
        The demo is not trying to replace flight software. It shows a safety architecture:
        ambiguous telemetry enters a bounded simulator, every pre-approved action is scored
        against hard limits, and only a template identifier can be returned to firmware.
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown("**Inject Fault**")
_FAULT_SCENARIOS = [
    ("No Fault",        0.0,  0.0),
    ("Power Surge",     4.0,  0.5),
    ("Thermal Spike",   0.8,  5.0),
    ("Elec. Storm",     8.0,  1.0),
    ("Thermal Runaway", 2.0,  7.0),
    ("Compound",        3.1,  2.4),
]
_fcols = st.columns(len(_FAULT_SCENARIOS))
for _i, (_lbl, _ex, _ht) in enumerate(_FAULT_SCENARIOS):
    _active = (
        abs(st.session_state.fault_extra - _ex) < 0.01
        and abs(st.session_state.fault_heat - _ht) < 0.01
    )
    if _fcols[_i].button(
        f"{'▶ ' if _active else ''}{_lbl}",
        use_container_width=True,
        key=f"fault_btn_{_i}",
        type="primary" if _active else "secondary",
    ):
        st.session_state.fault_extra = _ex
        st.session_state.fault_heat = _ht
        st.rerun()
st.caption(f"Active fault: **{extra:.1f} W** extra load · **{heat:.1f} W** heat injection")

st.subheader("Live Mission Console")
mc1, mc2, mc3, mc4 = st.columns(4)
mc1.metric("Bus voltage", fmt(bus_v, " V", 2), delta=f"limit {min_v:.2f} V")
mc2.metric("Battery SOC", fmt(soc, "%", 0), delta=f"reserve {min_soc:.0f}%")
mc3.metric("Fault load", fmt(extra, " W", 1), delta=f"solar {solar:.1f} W")
mc4.metric("Fault heat", fmt(heat, " W", 1), delta=f"electronics {elec_t:.1f} C")

st.subheader("Candidate Mitigation Screening")
screening = dataframe_for_results(results)
st.dataframe(
    screening,
    width="stretch",
    hide_index=True,
    column_config={
        "Score": st.column_config.ProgressColumn(
            "Score",
            help="Ranking score derived from safety margins and mitigation fit.",
            min_value=0,
            max_value=100,
            format="%.1f",
        ),
    },
)

ids = [r.action_id for r in results]
selected_id = st.segmented_control(
    "Inspect candidate trajectory",
    options=ids,
    default=best.action_id,
)
selected = next(r for r in results if r.action_id == selected_id)
selected_df = pd.DataFrame(selected.trajectory)

tc1, tc2, tc3 = st.columns(3)
tc1.metric("Predicted min bus", fmt(selected.min_bus_voltage_v, " V", 3))
tc2.metric("Predicted max current", fmt(selected.max_battery_current_a, " A", 3))
tc3.metric("Final reserve SOC", fmt(selected.final_soc_pct, "%", 2))

if selected.passed:
    st.markdown('<span class="pill pass">Prediction stays inside envelope</span>', unsafe_allow_html=True)
else:
    st.markdown(
        '<span class="pill block">Prediction violates envelope</span> '
        + f'<span class="small muted">{"; ".join(selected.failure_reasons)}</span>',
        unsafe_allow_html=True,
    )

chart_left, chart_right = st.columns(2)
with chart_left:
    st.altair_chart(
        line_chart(
            selected_df,
            "bus_voltage_v",
            "Bus voltage, V",
            ACCENT,
            envelope.min_bus_voltage_v,
            "OBC voltage floor",
        ),
        width="stretch",
    )
with chart_right:
    st.altair_chart(
        line_chart(
            selected_df,
            "battery_current_a",
            "Battery current, A",
            "#2f80ed",
            envelope.max_battery_current_a,
            "OBC current ceiling",
        ),
        width="stretch",
    )

st.altair_chart(thermal_chart(selected_df, envelope), width="stretch")

st.subheader("OBC Recovery Proposal")
obc_left, obc_right = st.columns([1.15, 0.85])
with obc_left:
    st.code(json.dumps(proposal, indent=2), language="json")
with obc_right:
    st.markdown(
        """
        **Execution contract**

        AEGIS can propose:

        `template_id`

        The OBC must verify:

        `whitelist`, `timing`, `limits`, `authority`

        The prototype deliberately keeps the AI outside direct actuator control.
        """
    )

st.subheader("What The Model Simulates")
model_a, model_b, model_c = st.columns(3)
with model_a:
    st.markdown(
        """
        **Electrical state**

        Battery open-circuit voltage is estimated from SOC, then internal resistance
        sag predicts bus voltage under each load profile.
        """
    )
with model_b:
    st.markdown(
        """
        **Thermal state**

        Battery and electronics nodes use first-order lumped thermal dynamics over
        the prediction horizon.
        """
    )
with model_c:
    st.markdown(
        """
        **Safety gate**

        Voltage, temperature, current, and reserve SOC are checked as hard OBC
        limits before a template can pass.
        """
    )

st.subheader("Hackathon Demo Script")
st.markdown(
    """
    1. Start on `Compound anomaly`; point to the failing `NO_ACTION` and transient `RESTART_ADCS`.
    2. Select `SAFE_MODE`; show the voltage curve staying above the OBC floor.
    3. Raise the voltage floor or fault load from the sidebar; show a former pass become blocked.
    4. Open the JSON proposal; emphasize that the AI returns a template ID, not direct commands.
    5. Close with the flight-readiness caveat: this is a reduced-order architecture prototype.
    """
)

st.caption(
    "Prototype only. A flight system would replace these reduced-order equations with "
    "calibrated EPS, thermal, and subsystem models validated using hardware-in-the-loop testing."
)
