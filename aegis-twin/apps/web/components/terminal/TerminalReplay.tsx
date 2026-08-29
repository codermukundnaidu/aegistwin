"use client";

export function TerminalReplay({ lines }: { lines: string[] }) {
  return (
    <section className="panel">
      <h2>OBC Terminal Replay</h2>
      <div className="terminal">
        {lines.map((line, index) => (
          <div className="terminal-line" key={`${line}-${index}`}>{line}</div>
        ))}
      </div>
    </section>
  );
}
