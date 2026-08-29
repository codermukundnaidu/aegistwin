"use client";

import type { CSSProperties } from "react";

const beams = [
  { left: "8%", duration: "7s", delay: "1.2s", height: "7rem", drift: "1.8rem" },
  { left: "18%", duration: "10s", delay: "4.4s", height: "4rem", drift: "-1.2rem" },
  { left: "32%", duration: "8s", delay: "2.6s", height: "10rem", drift: "2.4rem" },
  { left: "47%", duration: "11s", delay: "0s", height: "6rem", drift: "-2rem" },
  { left: "61%", duration: "7.6s", delay: "5s", height: "8rem", drift: "1rem" },
  { left: "76%", duration: "9.2s", delay: "3.2s", height: "5rem", drift: "-1.8rem" },
  { left: "91%", duration: "12s", delay: "6.4s", height: "9rem", drift: "1.4rem" },
];

const sparks = Array.from({ length: 14 }, (_, index) => index);

export function BackgroundBeamsWithCollision() {
  return (
    <div className="background-beams-collision" aria-hidden="true">
      {beams.map((beam, index) => (
        <div
          className="galaxy-beam-track"
          key={`${beam.left}-${beam.duration}`}
          style={
            {
              "--beam-left": beam.left,
              "--beam-duration": beam.duration,
              "--beam-delay": beam.delay,
              "--beam-height": beam.height,
              "--beam-drift": beam.drift,
            } as CSSProperties
          }
        >
          <span className="galaxy-beam" />
          <span className="galaxy-impact">
            {sparks.map((spark) => (
              <i key={spark} style={{ "--spark-index": spark } as CSSProperties} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
