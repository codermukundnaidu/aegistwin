"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Cpu,
  LockKeyhole,
  Moon,
  Play,
  Radio,
  ShieldCheck,
  Zap,
} from "lucide-react";

const PitchOrbitScene = dynamic(
  () => import("@/components/pitch/PitchOrbitScene").then((mod) => mod.PitchOrbitScene),
  { ssr: false },
);

const pitchSteps = [
  {
    eyebrow: "Step 01 / The Blackout Problem",
    title: "A CubeSat has to survive the silence between ground passes.",
    body:
      "A satellite in low Earth orbit can be isolated for roughly 90 minutes per orbit. During that window, radiation hits, thermal spikes, sensor corruption, and power sag can happen without ground support.",
    icon: <Moon size={18} />,
  },
  {
    eyebrow: "Step 02 / Hardware Architecture",
    title: "The deterministic OBC stays in command. AEGIS-TWIN only advises.",
    body:
      "The Master OBC remains low-power and authoritative. The AEGIS-TWIN coprocessor sleeps at 0W until ambiguity appears, wakes inside a timed sandbox, then hands back bounded recovery proposals.",
    icon: <Cpu size={18} />,
  },
  {
    eyebrow: "Step 03 / Process",
    title: "The twin predicts futures; hard safety gates decide what can fly.",
    body:
      "Candidate recovery templates are simulated against voltage, current, thermal, SOC, freshness, and whitelist constraints. Confidence is never authority. The OBC executes only a pre-approved safe action.",
    icon: <ShieldCheck size={18} />,
  },
];

type PitchModeProps = {
  pitchStep: number;
  transitioning: boolean;
  onBack: () => void;
  onNext: () => void;
  onInitialize: () => void;
};

export function getPitchStepCount() {
  return pitchSteps.length;
}

export function PitchMode({
  pitchStep,
  transitioning,
  onBack,
  onNext,
  onInitialize,
}: PitchModeProps) {
  const step = pitchSteps[pitchStep] ?? pitchSteps[0];
  const isLastStep = pitchStep === pitchSteps.length - 1;

  return (
    <section className="pitch-screen" aria-label="AEGIS-TWIN interactive pitch">
      <PitchOrbitScene transitioning={transitioning} />
      <div className="pitch-vignette" />
      <div className="pitch-team-credit" aria-label="Project team credits">
        <span>Made BY Team Made2Gether</span>
        <strong>Mayank | Aryan Jha | Mukund Naidu | Ishant lala | Sushant Kumar Choudary</strong>
      </div>
      <aside className="pitch-overlay">
        <div className="pitch-brand-row">
          <BrandLogo className="pitch-brand-logo" compact />
          <div>
            <strong>AEGIS-TWIN</strong>
            <span>Autonomous FDIR Coprocessor for CubeSats</span>
          </div>
        </div>

        <div className="pitch-step-card" key={step.eyebrow}>
          <div className="pitch-eyebrow">{step.icon}{step.eyebrow}</div>
          <h1>{step.title}</h1>
          <p>{step.body}</p>
          {pitchStep === 1 ? <HardwareArchitectureMini /> : null}
          {pitchStep === 2 ? <ProcessMini /> : null}
        </div>

        <div className="pitch-stepper">
          {pitchSteps.map((pitch, index) => (
            <button
              className={index === pitchStep ? "active" : ""}
              key={pitch.eyebrow}
              onClick={() => {
                if (index < pitchStep) onBack();
                if (index > pitchStep) onNext();
              }}
              aria-label={`Go to pitch step ${index + 1}`}
            />
          ))}
        </div>

        <div className="pitch-actions">
          <button className="icon-button" onClick={onBack} disabled={pitchStep === 0} title="Previous pitch step">
            <ChevronLeft size={16} />
          </button>
          {isLastStep ? (
            <button className="initialize-demo-button" onClick={onInitialize}>
              <Play size={18} />
              INITIALIZE FDIR DEMO
            </button>
          ) : (
            <button className="run-cta" onClick={onNext}>
              Next
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </aside>
    </section>
  );
}

function HardwareArchitectureMini() {
  return (
    <div className="pitch-architecture-mini" aria-label="Hardware architecture">
      <ArchitectureBlock icon={<Cpu size={16} />} title="Master OBC" detail="Deterministic / Low Power" tone="emerald" />
      <div className="pitch-power-rail">
        <Zap size={14} />
        <span>GPIO power gate</span>
      </div>
      <ArchitectureBlock icon={<BrainCircuit size={16} />} title="AEGIS-TWIN Coprocessor" detail="AI Edge Module / 0W Deep Sleep" tone="cyan" />
    </div>
  );
}

function ProcessMini() {
  return (
    <div className="pitch-process-mini" aria-label="Safety process">
      <ProcessStep icon={<BrainCircuit size={15} />} label="Diagnose" />
      <ProcessStep icon={<Radio size={15} />} label="Twin Sandbox" />
      <ProcessStep icon={<LockKeyhole size={15} />} label="Safety Gates" />
      <ProcessStep icon={<ShieldCheck size={15} />} label="OBC Executes" />
    </div>
  );
}

function ArchitectureBlock({ icon, title, detail, tone }: { icon: ReactNode; title: string; detail: string; tone: string }) {
  return (
    <div className={`architecture-block ${tone}`}>
      <i>{icon}</i>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function ProcessStep({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="pitch-process-step">
      <i>{icon}</i>
      <span>{label}</span>
    </div>
  );
}
