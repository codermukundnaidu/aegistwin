import { ModePage } from "@/components/demo/ModePage";

export default function Hardware() {
  return (
    <ModePage
      active="hardware"
      title="Hardware Mode"
      subtitle="COTS-to-hardened asymmetry means ordinary compute is placed behind a stricter authority boundary. It does not make COTS hardware flight qualified."
      cards={[
        { title: "Trusted Side", body: "Master OBC, watchdog, deterministic safety gates, recovery routines, and power control remain the authority boundary." },
        { title: "Advisory Side", body: "AI acceleration can be cheaper and more capable because it is subordinate, timed, and non-commanding." },
        { title: "Qualification Gap", body: "Radiation, thermal, EMC, derating, reliability, and software assurance remain future flight work." },
      ]}
    />
  );
}
