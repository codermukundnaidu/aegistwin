"use client";

import type { SimulationResult, TelemetryPoint } from "@/lib/types";

const series = [
  { key: "bus_voltage_v", label: "Voltage", unit: "V", color: "#31d3c6" },
  { key: "soc_pct", label: "SOC", unit: "%", color: "#5de38a" },
  { key: "battery_current_a", label: "Current", unit: "A", color: "#66a6ff" },
  { key: "battery_temp_c", label: "Battery temp", unit: "C", color: "#ffb454" },
  { key: "electronics_temp_c", label: "Electronics temp", unit: "C", color: "#ff6370" },
] as const;

export function TelemetryGraphs({ result }: { result: SimulationResult | null }) {
  if (!result) {
    return <div className="panel">Start the simulator backend to populate live telemetry graphs.</div>;
  }

  return (
    <section className="panel">
      <h2>Live Telemetry Futures</h2>
      <div className="charts">
        {series.map((item) => (
          <LineChart key={item.key} points={result.trajectory} field={item.key} label={item.label} unit={item.unit} color={item.color} />
        ))}
      </div>
    </section>
  );
}

function LineChart({
  points,
  field,
  label,
  unit,
  color,
}: {
  points: TelemetryPoint[];
  field: keyof TelemetryPoint;
  label: string;
  unit: string;
  color: string;
}) {
  const values = points.map((point) => Number(point[field]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.001);
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 300;
      const y = 92 - ((Number(point[field]) - min) / span) * 74;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="chart metric">
      <span>{label}</span>
      <strong>{values.at(-1)?.toFixed(2)} {unit}</strong>
      <svg viewBox="0 0 300 112" role="img" aria-label={label}>
        <line x1="0" x2="300" y1="94" y2="94" stroke="rgba(184,205,231,0.22)" />
        <polyline fill="none" stroke={color} strokeWidth="3" points={path} />
        <text x="0" y="110" fill="#94a8c4" fontSize="10">{min.toFixed(2)}</text>
        <text x="250" y="16" fill="#94a8c4" fontSize="10">{max.toFixed(2)}</text>
      </svg>
    </div>
  );
}
