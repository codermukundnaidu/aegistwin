"use client";

import type { SimulationResult } from "@/lib/types";

export function CandidateBranches({
  results,
  selectedId,
  onSelect,
}: {
  results: SimulationResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel">
      <h2>Three Ghost Futures</h2>
      <div className="candidate-list">
        {results.slice(0, 3).map((result) => (
          <button className="candidate" key={result.action_id} onClick={() => onSelect(result.action_id)} style={{ textAlign: "left", borderColor: selectedId === result.action_id ? "rgba(49,211,198,0.7)" : undefined }}>
            <span>{result.label}</span>
            <strong>{result.action_id}</strong>
            <div className={`status ${result.passed ? "pass" : "block"}`}>{result.passed ? "\u2713 PASS" : "\u2715 BLOCK"}</div>
            <span>score {result.score.toFixed(1)} · min bus {result.min_bus_voltage_v.toFixed(3)} V</span>
          </button>
        ))}
      </div>
      {results.find((result) => result.action_id === selectedId)?.checks ? (
        <div className="checks" style={{ marginTop: "0.8rem" }}>
          {results.find((result) => result.action_id === selectedId)?.checks.map((check) => (
            <div className="check" key={check.key}>
              <div className={`status ${check.passed ? "pass" : "block"}`}>{check.passed ? "\u2713 PASS" : "\u2715 BLOCK"}</div>
              <strong>{check.label}</strong>
              <span>
                predicted {check.predicted.toFixed(3)} {check.unit} · limit {check.comparator} {check.limit.toFixed(3)} {check.unit} · margin {check.margin.toFixed(3)} {check.unit}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
