"use client";

import type { MissionEvent } from "@/lib/types";

export function ChatBubbles({ event }: { event: MissionEvent | null }) {
  if (!event) return null;

  return (
    <div className="bubble" style={{ position: "relative", inset: "auto", maxWidth: "none" }}>
      <strong>{event.source} explains</strong>
      {event.bubble}
    </div>
  );
}
