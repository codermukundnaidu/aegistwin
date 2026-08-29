import { ModePage } from "@/components/demo/ModePage";

export default function Protocol() {
  return (
    <ModePage
      active="protocol"
      title="Protocol Mode"
      subtitle="The OBC accepts only structured recovery proposals and rejects stale, malformed, or unknown-template messages."
      cards={[
        { title: "Proposal", body: "The payload contains template_id, diagnostic confidence, twin validation, predicted limits, timestamps, and OBC_ONLY authority." },
        { title: "Rejections", body: "Unknown template, malformed message, stale proposal, and watchdog timeout scenarios are implemented in the simulator." },
        { title: "Separation", body: "AI confidence is never allowed to override a violated voltage, current, temperature, timing, or whitelist constraint." },
      ]}
    />
  );
}
