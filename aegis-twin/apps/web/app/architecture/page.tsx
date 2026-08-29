import { ModePage } from "@/components/demo/ModePage";

export default function Architecture() {
  return (
    <ModePage
      active="architecture"
      title="Architecture Mode"
      subtitle="The system is organized around authority separation: AI can advise, the twin can predict, and the Master OBC decides."
      cards={[
        { title: "Master OBC", body: "Owns power control, timing, whitelists, hard safety gates, recovery execution, and AI shutdown." },
        { title: "Edge AI", body: "Wakes only for ambiguous anomalies and ranks approved recovery templates with diagnostic confidence." },
        { title: "Digital Twin", body: "Propagates electrical and thermal consequences for each candidate before any template is authorized." },
      ]}
    />
  );
}
