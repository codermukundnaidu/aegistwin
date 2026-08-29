"use client";

import type { MissionEvent } from "@/lib/types";

export function MissionTimeline({ events, activeIndex }: { events: MissionEvent[]; activeIndex: number }) {
  return (
    <section className="panel">
      <h2>Mission State Machine</h2>
      <div className="timeline">
        {events.map((event, index) => (
          <div className={`event-row ${index === activeIndex ? "active" : ""}`} key={`${event.state}-${event.t_s}`}>
            <span>{event.t_s.toFixed(1)} s · {event.source}</span>
            <strong>{event.state}</strong>
            <span>{event.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
