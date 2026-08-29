"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Clock, Gauge, ShieldCheck } from "lucide-react";
import type { RejectionScenario, SimulationRequest } from "@/lib/types";

type Props = {
  request: SimulationRequest;
  onChange: (request: SimulationRequest) => void;
};

function updateNumber(value: string): number {
  return Number.parseFloat(value);
}

export function ControlPanel({ request, onChange }: Props) {
  const setState = (key: keyof SimulationRequest["state"], value: number) => {
    onChange({ ...request, state: { ...request.state, [key]: value } });
  };
  const setEnvelope = (key: keyof SimulationRequest["envelope"], value: number) => {
    onChange({ ...request, envelope: { ...request.envelope, [key]: value } });
  };

  return (
    <aside className="panel control-stack">
      <h2>Judge Controls</h2>
      <Range label="Measured bus voltage" value={request.state.measured_bus_voltage_v} min={6.2} max={8.4} step={0.01} unit="V" onChange={(v) => setState("measured_bus_voltage_v", v)} />
      <Range label="Solar input" value={request.state.solar_power_w} min={0} max={12} step={0.1} unit="W" onChange={(v) => setState("solar_power_w", v)} />
      <Range label="Fault load" value={request.state.anomaly_extra_load_w} min={0} max={8} step={0.1} unit="W" onChange={(v) => setState("anomaly_extra_load_w", v)} />
      <Range label="SOC" value={request.state.soc_pct} min={5} max={100} step={1} unit="%" onChange={(v) => setState("soc_pct", v)} />
      <Range label="Battery temp" value={request.state.battery_temp_c} min={-10} max={75} step={0.5} unit="C" onChange={(v) => setState("battery_temp_c", v)} />
      <Range label="Electronics temp" value={request.state.electronics_temp_c} min={-10} max={85} step={0.5} unit="C" onChange={(v) => setState("electronics_temp_c", v)} />

      <div className="field">
        <div className="field-row"><label><ShieldCheck size={14} /> OBC voltage floor</label><span>{request.envelope.min_bus_voltage_v.toFixed(2)} V</span></div>
        <input type="range" min={6.4} max={7.4} step={0.01} value={request.envelope.min_bus_voltage_v} onChange={(e) => setEnvelope("min_bus_voltage_v", updateNumber(e.target.value))} />
      </div>
      <Range label="Max current" value={request.envelope.max_battery_current_a} min={0.4} max={4} step={0.05} unit="A" onChange={(v) => setEnvelope("max_battery_current_a", v)} />
      <Range label="Watchdog timeout" value={request.watchdog_timeout_s} min={2} max={16} step={0.5} unit="s" onChange={(v) => onChange({ ...request, watchdog_timeout_s: v })} icon={<Clock size={14} />} />

      <label className="field-row">
        <span><AlertTriangle size={14} /> Inject watchdog timeout</span>
        <input type="checkbox" checked={request.inject_watchdog_timeout} onChange={(event) => onChange({ ...request, inject_watchdog_timeout: event.target.checked })} />
      </label>

      <div className="field">
        <label>Protocol rejection</label>
        <select value={request.rejection_scenario} onChange={(e) => onChange({ ...request, rejection_scenario: e.target.value as RejectionScenario })}>
          <option value="none">None</option>
          <option value="unknown_template">Unknown template</option>
          <option value="malformed_message">Malformed message</option>
          <option value="stale_proposal">Stale proposal</option>
        </select>
      </div>
    </aside>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  icon,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="field">
      <div className="field-row">
        <label>{icon ?? <Gauge size={14} />} {label}</label>
        <span>{value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(updateNumber(event.target.value))} />
    </div>
  );
}
