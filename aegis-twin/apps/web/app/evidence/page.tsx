import { ModePage } from "@/components/demo/ModePage";

export default function Evidence() {
  return (
    <ModePage
      active="evidence"
      title="Evidence Mode"
      subtitle="Claims are separated into external facts, design decisions, demo assumptions, measured prototype results, and future flight requirements."
      cards={[
        { title: "Prior Art", body: "The project acknowledges onboard autonomy and diagnosis work such as Remote Agent and RAISR instead of claiming autonomy itself is new." },
        { title: "Demo Assumptions", body: "The current model is lumped electrical plus two-node thermal. It is traceable and intentionally reduced order." },
        { title: "Flight Caveat", body: "Actual use requires mission-specific verification, qualification, FMEA/FMECA, HIL testing, and environmental analysis." },
      ]}
    />
  );
}
