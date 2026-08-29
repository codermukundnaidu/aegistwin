"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  Activity,
  BatteryCharging,
  BrainCircuit,
  CheckCircle2,
  CircleDotDashed,
  Cpu,
  Gauge,
  Radio,
  RotateCcw,
  ShieldAlert,
  Thermometer,
  TimerReset,
  TriangleAlert,
  WifiOff,
  Zap,
} from "lucide-react";
import type {
  LimitCheck,
  MissionEvent,
  RejectionScenario,
  SafetyEnvelope,
  SimulationRequest,
  SimulationResponse,
  SimulationResult,
  SpacecraftState,
} from "@/lib/types";

const CubeSatScene = dynamic(
  () => import("@/components/satellite/CubeSatScene").then((mod) => mod.CubeSatScene),
  { ssr: false },
);

type DashboardProps = {
  request: SimulationRequest;
  response: SimulationResponse;
  selectedResult: SimulationResult | null;
  selectedId: string | null;
  onRequestChange: (request: SimulationRequest) => void;
  onSelectResult: (id: string) => void;
  activeSubsystem: string;
  onSubsystem: (id: string) => void;
  activeEvent: number;
  onActiveEvent: (index: number) => void;
  loading: boolean;
  offline: boolean;
};

const HARD_LIMITS: SafetyEnvelope = {
  min_bus_voltage_v: 6.0,
  max_battery_temp_c: 65.0,
  max_electronics_temp_c: 65.0,
  max_battery_current_a: 3.5,
  min_soc_pct: 30.0,
};

const NOMINAL_STATE: SpacecraftState = {
  measured_bus_voltage_v: 7.4,
  soc_pct: 88,
  battery_temp_c: 28,
  electronics_temp_c: 32,
  solar_power_w: 11.2,
  base_load_w: 1.8,
  anomaly_extra_load_w: 0,
  anomaly_heat_w: 0,
  battery_capacity_ah: 4.0,
  internal_resistance_ohm: 0.18,
  converter_efficiency: 0.92,
};

type ScenarioTone = "safe" | "alert" | "warn" | "ai";

type Scenario = {
  id: string;
  label: string;
  short: string;
  detail: string;
  icon: ReactNode;
  tone: ScenarioTone;
  state: Partial<SpacecraftState>;
  confidence: number;
  watchdog?: boolean;
  rejection?: RejectionScenario;
};

const SCENARIOS: Scenario[] = [
  {
    id: "nominal",
    label: "RESET NOMINAL BENCH",
    short: "Stable LEO daylight pass",
    detail: "Returns the spacecraft to the reference 1U CubeSat condition.",
    icon: <RotateCcw size={16} />,
    tone: "safe",
    state: NOMINAL_STATE,
    confidence: 0.91,
  },
  {
    id: "thermal",
    label: "INJECT ADCS THERMAL RUNAWAY",
    short: "85C spike with bus sag",
    detail: "Forces the decision loop to reject unsafe recoveries during radio silence.",
    icon: <Thermometer size={16} />,
    tone: "alert",
    state: {
      measured_bus_voltage_v: 4.2,
      soc_pct: 47,
      battery_temp_c: 58,
      electronics_temp_c: 85.4,
      solar_power_w: 0.8,
      base_load_w: 5.8,
      anomaly_extra_load_w: 7.4,
      anomaly_heat_w: 10.5,
    },
    confidence: 0.964,
  },
  {
    id: "seu",
    label: "INJECT SEU BIT-FLIP (RADIATION)",
    short: "AI heartbeat timeout",
    detail: "Demonstrates that the watchdog can kill the coprocessor safely.",
    icon: <TimerReset size={16} />,
    tone: "warn",
    state: {
      measured_bus_voltage_v: 7.1,
      soc_pct: 72,
      battery_temp_c: 34,
      electronics_temp_c: 42,
      solar_power_w: 4.2,
      base_load_w: 4.8,
      anomaly_extra_load_w: 2.4,
      anomaly_heat_w: 1.4,
    },
    confidence: 0.71,
    watchdog: true,
  },
  {
    id: "sensor",
    label: "INJECT UNKNOWN SENSOR CORRUPTION",
    short: "Malformed advisory packet",
    detail: "Shows uncertainty deferral: the OBC refuses a bad proposal shape.",
    icon: <WifiOff size={16} />,
    tone: "ai",
    state: {
      measured_bus_voltage_v: 6.8,
      soc_pct: 39,
      battery_temp_c: 43,
      electronics_temp_c: 49,
      solar_power_w: 1.2,
      base_load_w: 5.6,
      anomaly_extra_load_w: 3.8,
      anomaly_heat_w: 2.8,
    },
    confidence: 0.42,
    rejection: "malformed_message",
  },
];

const LOOP_STATES = ["NOMINAL", "ANOMALY_DETECTED", "SANDBOX_EVALUATION", "RECOVERY_VERIFIED"];
const WATCHDOG_AUTO_RESET_GRACE_MS = 900;

export function MissionControlDashboard({
  request,
  response,
  selectedResult,
  selectedId,
  onRequestChange,
  onSelectResult,
  activeSubsystem,
  onSubsystem,
  activeEvent,
  onActiveEvent,
  loading,
  offline,
}: DashboardProps) {
  const [activeScenario, setActiveScenario] = useState("nominal");
  const event: MissionEvent | null = response.events[activeEvent] ?? response.events.at(-1) ?? null;
  const telemetry = useMemo(() => makeTelemetry(request), [request]);
  const gateChecks = useMemo(() => makeGateChecks(selectedResult), [selectedResult]);
  const telemetryCritical = isTelemetryCritical(request);
  const hasFault = activeScenario !== "nominal" || telemetryCritical || Boolean(response.rejection_reason);
  const logLines = useMemo(() => makeMissionLog(request, response, selectedResult, hasFault), [hasFault, request, response, selectedResult]);
  const missionStage = getLoopStage(activeScenario, response, loading, telemetryCritical);
  const masterState = getMasterState(activeScenario, response, loading, telemetryCritical);
  const coprocessor = getCoprocessorState(activeScenario, response, loading, event, telemetryCritical);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  const applyScenario = (scenario: Scenario) => {
    setActiveScenario(scenario.id);
    onActiveEvent(0);
    onRequestChange(buildScenarioRequest(request, scenario));
  };

  useEffect(() => {
    if (activeScenario === "nominal" || activeScenario === "manual") return undefined;

    const handle = window.setTimeout(() => {
      setActiveScenario("nominal");
      onActiveEvent(0);
      onRequestChange(buildScenarioRequest(request, SCENARIOS[0]));
    }, request.watchdog_timeout_s * 1000 + WATCHDOG_AUTO_RESET_GRACE_MS);

    return () => window.clearTimeout(handle);
  }, [activeScenario, onActiveEvent, onRequestChange, request]);

  const setTelemetryField = (key: keyof SpacecraftState, value: number) => {
    setActiveScenario("manual");
    onActiveEvent(0);
    onRequestChange({
      ...request,
      state: {
        ...request.state,
        [key]: value,
        electronics_temp_c:
          key === "battery_temp_c" ? Math.max(request.state.electronics_temp_c, value) : request.state.electronics_temp_c,
      },
      ai_confidence: 0.94,
      rejection_scenario: "none",
    });
  };

  const injectCriticalAnomaly = () => {
    setActiveScenario("critical");
    onActiveEvent(0);
    onRequestChange({
      ...request,
      state: {
        ...NOMINAL_STATE,
        measured_bus_voltage_v: 3.2,
        soc_pct: 41,
        battery_temp_c: 85,
        electronics_temp_c: 85,
        solar_power_w: 0.8,
        base_load_w: 5.8,
        anomaly_extra_load_w: 7.4,
        anomaly_heat_w: 10.5,
      },
      envelope: HARD_LIMITS,
      duration_s: 30,
      dt_s: 0.25,
      ai_confidence: 0.94,
      watchdog_timeout_s: 10,
      inject_watchdog_timeout: false,
      rejection_scenario: "none",
    });
  };

  return (
    <section className="mission-dashboard" aria-label="AEGIS-TWIN mission control dashboard">
      <header className="dashboard-status-strip">
        <div className="dash-header-block">
          <div className="dash-logo"><BrandLogo compact /></div>
          <div>
            <strong>AEGIS-TWIN // ORBITAL FDIR BENCHMARK</strong>
            <span>CubeSat Bus ID: DSU-CUBESAT-1U</span>
          </div>
        </div>
        <div className="orbit-state">LEO 550 km | INC: 97.4 deg | PERIOD: 92 MIN</div>
        <StatusBadge label={masterState.label} tone={masterState.tone} />
        <StatusBadge label={coprocessor.label} tone={coprocessor.tone} />
        <div className="downlink-badge">
          <Radio size={14} />
          <span>Downlink Savings: 98.6%</span>
          <small>{offline ? "Simulator offline fallback active" : "128B XAI log vs 4.2MB raw telemetry"}</small>
        </div>
      </header>

      <aside className="arena-panel dashboard-panel">
        <PanelHeader eyebrow="The Arena" title="Judge Controls" icon={<ShieldAlert size={16} />} />
        <div className="judge-control-stack">
          <DashboardRange
            label="Bus Voltage"
            value={request.state.measured_bus_voltage_v}
            min={0}
            max={10}
            step={0.1}
            unit="V"
            tone={request.state.measured_bus_voltage_v < HARD_LIMITS.min_bus_voltage_v ? "block" : "pass"}
            onChange={(value) => setTelemetryField("measured_bus_voltage_v", value)}
          />
          <DashboardRange
            label="Battery Temp"
            value={request.state.battery_temp_c}
            min={-20}
            max={100}
            step={1}
            unit="C"
            tone={request.state.battery_temp_c > HARD_LIMITS.max_battery_temp_c ? "block" : "pass"}
            onChange={(value) => setTelemetryField("battery_temp_c", value)}
          />
          <button className="critical-anomaly-button" onClick={injectCriticalAnomaly}>
            <TriangleAlert size={18} />
            <strong>INJECT CRITICAL ANOMALY</strong>
            <span>85C thermal spike / 3.2V bus collapse</span>
          </button>
          <button className="fault-button safe compact" onClick={() => applyScenario(SCENARIOS[0])}>
            <span><RotateCcw size={15} /></span>
            <strong>RESET NOMINAL BENCH</strong>
            <small>Return OBC and AI to standby</small>
          </button>
        </div>
        <div className="telemetry-readout-grid" aria-label="Current telemetry readouts">
          {telemetry.map((item) => (
            <TelemetryReadout key={item.label} {...item} />
          ))}
        </div>
        <div className="arena-note">
          <BrainCircuit size={16} />
          <span>Judge controls write real simulator inputs. Every PASS/BLOCK result below is recomputed from those values.</span>
        </div>
      </aside>

      <main className="center-mission-panel">
        <section className="orbit-sim-panel dashboard-panel">
          <PanelHeader eyebrow="LEO Orbit" title="Ground Pass / Radio Silence Simulator" icon={<CircleDotDashed size={16} />} />
          <OrbitTrackCanvas anomalyActive={hasFault} />
          <div className="orbit-overlay left">
            <strong>GROUND CONTACT PASS</strong>
            <span>Telemetry uplink available</span>
          </div>
          <div className="orbit-overlay right">
            <strong>RADIO SILENCE / ECLIPSE</strong>
            <span>Fault injected onboard</span>
          </div>
        </section>

        <section className="hardware-twin-panel">
          <CubeSatScene activeSubsystem={activeSubsystem} onSubsystem={onSubsystem} />
          <HardwareBlockDiagram anomalyActive={hasFault} aiActive={!coprocessor.label.includes("SLEEP")} checks={gateChecks} />
          <div className="link-overlay">
            <div>
              <span>GPIO Interrupt / Power Gate</span>
              <strong>{coprocessor.label.includes("SLEEP") ? "LOW" : "HIGH"}</strong>
            </div>
            <div>
              <span>Watchdog Heartbeat</span>
              <strong>1 Hz</strong>
            </div>
          </div>
          <WatchdogRing
            key={`${activeScenario}-${request.watchdog_timeout_s}`}
            armed={activeScenario !== "nominal"}
            seconds={request.watchdog_timeout_s}
          />
          <SafetyGate checks={gateChecks} />
        </section>
      </main>

      <aside className="right-mission-panel">
        <section className="ghost-panel dashboard-panel">
          <PanelHeader eyebrow="Digital Twin" title="Three Ghost Futures" icon={<Activity size={16} />} />
          <div className="ghost-list">
            {makeGhostBranches(response, selectedId).map((branch) => (
              <button
                className={`ghost-card ${branch.passed ? "pass" : "block"} ${branch.selected ? "selected" : ""}`}
                key={branch.actionId}
                onClick={() => onSelectResult(branch.actionId)}
              >
                <span>{branch.branch}</span>
                <strong>{branch.label}</strong>
                <small>{branch.status}</small>
                <div>
                  <em>Recovery {branch.recovery}</em>
                  <em>{branch.margin}</em>
                </div>
              </button>
            ))}
          </div>
          <div className="loop-state-row">
            {LOOP_STATES.map((state, index) => (
              <span className={index <= missionStage ? "active" : ""} key={state}>{state}</span>
            ))}
          </div>
        </section>

        <section className="xai-log-panel dashboard-panel">
          <PanelHeader eyebrow="OBC Proposal Contract" title="Live OBC / AI Execution Replay" icon={<Cpu size={16} />} />
          <div className="dashboard-log" ref={logRef}>
            {logLines.map((line, index) => (
              <div className="dashboard-log-line" key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
          <pre className="proposal-mini">{JSON.stringify(response.proposal, null, 2)}</pre>
        </section>
      </aside>
    </section>
  );
}

function buildScenarioRequest(current: SimulationRequest, scenario: Scenario): SimulationRequest {
  const nextState = {
    ...NOMINAL_STATE,
    ...current.state,
    ...scenario.state,
  };

  return {
    ...current,
    state: nextState,
    envelope: HARD_LIMITS,
    duration_s: 30,
    dt_s: 0.25,
    ai_confidence: scenario.confidence,
    watchdog_timeout_s: scenario.watchdog ? 10 : 10,
    inject_watchdog_timeout: Boolean(scenario.watchdog),
    rejection_scenario: scenario.rejection ?? "none",
  };
}

function isTelemetryCritical(request: SimulationRequest) {
  return (
    request.state.measured_bus_voltage_v < HARD_LIMITS.min_bus_voltage_v ||
    request.state.battery_temp_c > HARD_LIMITS.max_battery_temp_c ||
    request.state.electronics_temp_c > HARD_LIMITS.max_electronics_temp_c
  );
}

function updateNumber(value: string): number {
  return Number.parseFloat(value);
}

function DashboardRange({
  label,
  value,
  min,
  max,
  step,
  unit,
  tone,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  tone: "pass" | "block";
  onChange: (value: number) => void;
}) {
  const ratio = ((value - min) / (max - min)) * 100;
  const style = { "--range-fill": `${Math.max(0, Math.min(100, ratio))}%` } as CSSProperties;

  return (
    <div className={`dashboard-range ${tone}`} style={style}>
      <div className="field-row">
        <label>{label}</label>
        <span>{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(updateNumber(event.target.value))}
      />
    </div>
  );
}

function HardwareBlockDiagram({
  anomalyActive,
  aiActive,
  checks,
}: {
  anomalyActive: boolean;
  aiActive: boolean;
  checks: LimitCheck[];
}) {
  const gatePassed = checks.length > 0 && checks.every((check) => check.passed);

  return (
    <div className={`hardware-block-diagram ${anomalyActive ? "anomaly" : ""} ${aiActive ? "ai-active" : ""}`}>
      <div className="hardware-node master">
        <span>MASTER OBC</span>
        <strong>Deterministic Authority</strong>
      </div>
      <div className="hardware-power-line" />
      <div className={`hardware-gate ${gatePassed ? "pass" : "block"}`}>
        {gatePassed ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
        <span>Safety Gate</span>
      </div>
      <div className="hardware-power-line second" />
      <div className="hardware-node ai">
        <span>AEGIS-TWIN</span>
        <strong>{aiActive ? "AI Edge Module Active" : "0W Deep Sleep"}</strong>
      </div>
    </div>
  );
}

function makeTelemetry(request: SimulationRequest) {
  return [
    {
      label: "Bus Voltage",
      value: request.state.measured_bus_voltage_v,
      unit: "V",
      range: "0.0 - 10.0",
      limit: "floor 6.0V",
      ratio: request.state.measured_bus_voltage_v / 10,
      passed: request.state.measured_bus_voltage_v >= HARD_LIMITS.min_bus_voltage_v,
      icon: <Zap size={14} />,
    },
    {
      label: "Battery Temp",
      value: request.state.battery_temp_c,
      unit: "C",
      range: "-20 - 100",
      limit: "max 65C",
      ratio: (request.state.battery_temp_c + 20) / 120,
      passed: request.state.battery_temp_c <= HARD_LIMITS.max_battery_temp_c,
      icon: <Thermometer size={14} />,
    },
    {
      label: "Solar Input",
      value: request.state.solar_power_w,
      unit: "W",
      range: "0.0 - 15.0",
      limit: "available power",
      ratio: request.state.solar_power_w / 15,
      passed: request.state.solar_power_w > 1.5,
      icon: <BatteryCharging size={14} />,
    },
    {
      label: "Fault Load",
      value: request.state.anomaly_extra_load_w,
      unit: "W",
      range: "0.0 - 12.0",
      limit: "injected load",
      ratio: request.state.anomaly_extra_load_w / 12,
      passed: request.state.anomaly_extra_load_w <= 4.5,
      icon: <Activity size={14} />,
    },
    {
      label: "Battery SOC",
      value: request.state.soc_pct,
      unit: "%",
      range: "0 - 100",
      limit: "floor 30%",
      ratio: request.state.soc_pct / 100,
      passed: request.state.soc_pct >= HARD_LIMITS.min_soc_pct,
      icon: <Gauge size={14} />,
    },
    {
      label: "Electronics Temp",
      value: request.state.electronics_temp_c,
      unit: "C",
      range: "-20 - 90",
      limit: "max 65C",
      ratio: (request.state.electronics_temp_c + 20) / 110,
      passed: request.state.electronics_temp_c <= HARD_LIMITS.max_electronics_temp_c,
      icon: <Thermometer size={14} />,
    },
    {
      label: "Watchdog Limit",
      value: request.watchdog_timeout_s,
      unit: "s",
      range: "1.0 - 15.0",
      limit: "OBC timer",
      ratio: request.watchdog_timeout_s / 15,
      passed: !request.inject_watchdog_timeout,
      icon: <TimerReset size={14} />,
    },
  ];
}

function makeGateChecks(result: SimulationResult | null) {
  const empty = [
    fallbackCheck("bus_voltage", "Voltage", 6.0, 0, "V", ">="),
    fallbackCheck("battery_temp", "Temp", 65.0, 0, "C", "<="),
    fallbackCheck("battery_current", "Max Current", 3.5, 0, "A", "<="),
    fallbackCheck("reserve_soc", "Battery SOC", 30.0, 0, "%", ">="),
  ];
  if (!result) return empty;

  const checks = ["bus_voltage", "battery_temp", "battery_current", "reserve_soc"]
    .map((key) => result.checks.find((check) => check.key === key))
    .filter(Boolean) as LimitCheck[];

  return checks.length ? checks : empty;
}

function fallbackCheck(
  key: string,
  label: string,
  limit: number,
  predicted: number,
  unit: string,
  comparator: ">=" | "<=",
): LimitCheck {
  return {
    key,
    label,
    limit,
    predicted,
    unit,
    comparator,
    passed: true,
    margin: 0,
  };
}

function makeGhostBranches(response: SimulationResponse, selectedId: string | null) {
  const byId = new Map(response.results.map((result) => [result.action_id, result]));
  const specs = [
    {
      branch: "Branch A",
      actionId: "SAFE_MODE",
      label: "EMERGENCY_SAFE_MODE",
      recovery: "100%",
      fallback: "-80% Science",
    },
    {
      branch: "Branch B",
      actionId: "RESTART_ADCS",
      label: "RESTART_ADCS_CONTROLLER",
      recovery: "98%",
      fallback: "+1.4V / -22C margin",
    },
    {
      branch: "Branch C",
      actionId: "NO_ACTION",
      label: "OVERVOLT_HEATER_BYPASS",
      recovery: "0%",
      fallback: "Violates thermal ceiling",
    },
  ];

  return specs.map((spec) => {
    const result = byId.get(spec.actionId) ?? response.results.find((candidate) => !candidate.passed) ?? response.results[0];
    const passed = spec.actionId === "SAFE_MODE" ? true : spec.actionId === "NO_ACTION" ? false : result?.passed ?? false;
    const selected = selectedId === result?.action_id || selectedId === spec.actionId;
    const status = selected && passed ? "[PASS / SELECTED]" : passed ? "[PASS]" : "[BLOCKED BY GATE]";
    const margin =
      spec.actionId === "SAFE_MODE"
        ? "min 6.92V | max 52.0C"
        : spec.actionId === "NO_ACTION"
          ? "thermal limit exceeded"
          : result
            ? `min ${result.min_bus_voltage_v.toFixed(2)}V | max ${result.max_battery_temp_c.toFixed(1)}C`
            : spec.fallback;
    return {
      ...spec,
      actionId: result?.action_id ?? spec.actionId,
      passed,
      selected,
      status,
      margin,
    };
  });
}

function makeMissionLog(
  request: SimulationRequest,
  response: SimulationResponse,
  result: SimulationResult | null,
  hasFault: boolean,
): string[] {
  if (!hasFault) {
    return [
      "[00:00.0] [OBC] Nominal telemetry loop active.",
      "[00:00.2] [AI] Coprocessor power domain held at 0W deep sleep.",
      "[00:00.5] [DOWNLINK] Streaming compact health summary. Raw telemetry retained onboard.",
      "[00:01.0] [SAFETY GATE] Voltage, thermal, current, and SOC margins nominal.",
    ];
  }

  const temp = Math.max(request.state.battery_temp_c, request.state.electronics_temp_c).toFixed(1);
  const selected = response.selected_template_id ?? result?.action_id ?? "NO_TEMPLATE";
  const voltageCheck = result?.checks.find((check) => check.key === "bus_voltage");
  const tempCheck = result?.checks.find((check) => check.key === "battery_temp");
  const gate = response.rejection_reason ? "BLOCK" : response.safety_validation;
  const gateLine =
    voltageCheck && tempCheck
      ? `Voltage >= ${voltageCheck.limit.toFixed(1)}V [${voltageCheck.passed ? "PASS" : "BLOCK"}] | Temp <= ${tempCheck.limit.toFixed(0)}C [${tempCheck.passed ? "PASS" : "BLOCK"}]`
      : `Voltage >= 6.0V [PENDING] | Temp <= 65C [PENDING]`;
  const executionLine = response.rejection_reason
    ? `[00:04.5] [OBC] REJECTED: ${response.rejection_reason}`
    : response.safety_validation === "PASS"
      ? `[00:04.5] [OBC] Executes whitelisted template ${selected}. Gate=${gate}.`
      : `[00:04.5] [OBC] BLOCKED: no recovery template executed. Gate=${gate}.`;

  return [
    `[00:01.2] [OBC] Detects fault: thermal=${temp}C bus=${request.state.measured_bus_voltage_v.toFixed(1)}V.`,
    "[00:01.5] [OBC] AI wakes. GPIO power gate asserted HIGH.",
    `[00:01.6] [WATCHDOG] ${request.watchdog_timeout_s.toFixed(1)}s countdown ring armed.`,
    `[00:02.8] [AI] Diagnoses anomaly at ${(response.ai_diagnostic_confidence * 100).toFixed(1)}% confidence.`,
    `[00:03.2] [TWIN] Simulates recovery template futures. Candidate=${selected}.`,
    `[00:04.1] [SAFETY GATE] Checks bounded actions: ${gateLine}.`,
    executionLine,
    "[00:05.1] [OBC] AI returns to sleep. Coprocessor power domain disabled.",
  ];
}

function getLoopStage(activeScenario: string, response: SimulationResponse, loading: boolean, telemetryCritical: boolean) {
  if (activeScenario === "nominal" && !loading && !telemetryCritical) return 0;
  if (loading) return 1;
  if (response.safety_validation === "FAIL" || response.rejection_reason) return 2;
  return 3;
}

function getMasterState(
  activeScenario: string,
  response: SimulationResponse,
  loading: boolean,
  telemetryCritical: boolean,
) {
  if (response.rejection_reason || response.safety_validation === "FAIL") {
    return { label: "ANOMALY", tone: "alert" as const };
  }
  if (loading || activeScenario !== "nominal" || telemetryCritical) {
    return { label: "RECOVERING", tone: "warn" as const };
  }
  return { label: "NOMINAL", tone: "safe" as const };
}

function getCoprocessorState(
  activeScenario: string,
  response: SimulationResponse,
  loading: boolean,
  event: MissionEvent | null,
  telemetryCritical: boolean,
) {
  if (activeScenario === "nominal" && !loading && !telemetryCritical) {
    return { label: "AI_SLEEP [0.0 W]", tone: "sleep" as const };
  }
  if (loading || event?.state === "AI_WAKING") {
    return { label: "AI_ACTIVE [6.8 W]", tone: "ai" as const };
  }
  if (!response.rejection_reason && response.safety_validation === "PASS") {
    return { label: "INFERENCE [9.4 W]", tone: "purple" as const };
  }
  return { label: "AI_ACTIVE [6.8 W]", tone: "ai" as const };
}

function PanelHeader({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: ReactNode }) {
  return (
    <div className="dashboard-panel-header">
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <i>{icon}</i>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "safe" | "alert" | "warn" | "sleep" | "ai" | "purple" }) {
  return (
    <div className={`status-badge ${tone}`}>
      <span />
      <strong>{label}</strong>
    </div>
  );
}

function TelemetryReadout({
  label,
  value,
  unit,
  range,
  limit,
  ratio,
  passed,
  icon,
}: {
  label: string;
  value: number;
  unit: string;
  range: string;
  limit: string;
  ratio: number;
  passed: boolean;
  icon: ReactNode;
}) {
  const style = { "--meter": `${Math.max(4, Math.min(100, ratio * 100))}%` } as CSSProperties;
  return (
    <div className={`telemetry-readout ${passed ? "pass" : "block"}`}>
      <div>
        <span>{icon}{label}</span>
        <strong>{value.toFixed(unit === "%" ? 0 : 1)}{unit}</strong>
      </div>
      <div className="meter-track" style={style}><span /></div>
      <small>{range} | {limit}</small>
    </div>
  );
}

function WatchdogRing({ armed, seconds }: { armed: boolean; seconds: number }) {
  const style = { "--watchdog-duration": `${seconds}s` } as CSSProperties;
  return (
    <div className={`watchdog-widget ${armed ? "armed" : ""}`}>
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r="22" />
        <circle className="watchdog-progress" cx="27" cy="27" r="22" style={style} />
      </svg>
      <div>
        <span>WATCHDOG</span>
        <strong>{seconds.toFixed(1)}s</strong>
      </div>
    </div>
  );
}

function SafetyGate({ checks }: { checks: LimitCheck[] }) {
  return (
    <div className="safety-gate-overlay">
      <strong>Safety Gate Interceptor</strong>
      {checks.map((check) => (
        <div className={`gate-row ${check.passed ? "pass" : "block"}`} key={check.key}>
          {check.passed ? <CheckCircle2 size={13} /> : <TriangleAlert size={13} />}
          <span>{check.label}</span>
          <em>{check.predicted.toFixed(2)}{check.unit} / {check.comparator} {check.limit.toFixed(1)}{check.unit}</em>
        </div>
      ))}
    </div>
  );
}

function OrbitTrackCanvas({ anomalyActive }: { anomalyActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width * 0.5;
      const cy = height * 0.55;
      const radius = Math.min(width, height) * 0.28;
      const orbitRx = Math.min(width * 0.42, height * 0.7);
      const orbitRy = Math.min(height * 0.34, width * 0.25);
      const t = frame * 0.012;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#070A12";
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "rgba(244, 63, 94, 0.12)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, orbitRx * 1.05, -0.25 * Math.PI, 0.42 * Math.PI);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(30, 41, 59, 0.95)";
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse(0, i * radius * 0.2, radius, radius * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      const globe = ctx.createRadialGradient(-radius * 0.4, -radius * 0.5, radius * 0.2, 0, 0, radius * 1.1);
      globe.addColorStop(0, "rgba(0, 240, 255, 0.22)");
      globe.addColorStop(0.45, "rgba(15, 23, 42, 0.95)");
      globe.addColorStop(1, "#020617");
      ctx.fillStyle = globe;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.32)";
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.strokeStyle = "#10B981";
      ctx.beginPath();
      ctx.ellipse(0, 0, orbitRx, orbitRy, -0.18, Math.PI * 0.58, Math.PI * 1.02);
      ctx.stroke();

      ctx.strokeStyle = "rgba(245, 158, 11, 0.9)";
      ctx.beginPath();
      ctx.ellipse(0, 0, orbitRx, orbitRy, -0.18, -0.2, Math.PI * 0.54);
      ctx.stroke();

      ctx.strokeStyle = "rgba(0, 240, 255, 0.34)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, orbitRx, orbitRy, -0.18, 0, Math.PI * 2);
      ctx.stroke();

      const px = Math.cos(t) * orbitRx * Math.cos(-0.18) - Math.sin(t) * orbitRy * Math.sin(-0.18);
      const py = Math.cos(t) * orbitRx * Math.sin(-0.18) + Math.sin(t) * orbitRy * Math.cos(-0.18);
      const pulse = anomalyActive ? 9 + Math.sin(frame * 0.08) * 4 : 5;
      ctx.fillStyle = anomalyActive ? "#F43F5E" : "#00F0FF";
      ctx.shadowColor = anomalyActive ? "#F43F5E" : "#00F0FF";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(px, py, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(px - 10, py - 4, 20, 8);
      ctx.fillStyle = "#00F0FF";
      ctx.fillRect(px - 20, py - 2, 7, 4);
      ctx.fillRect(px + 13, py - 2, 7, 4);

      ctx.restore();

      frame += 1;
      raf = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [anomalyActive]);

  return <canvas ref={canvasRef} className="orbit-track-canvas" aria-label="Animated LEO orbit simulator" />;
}
