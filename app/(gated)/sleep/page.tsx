import { VitalsTrackerPage } from "@/components/VitalsTrackerPage";

export const dynamic = "force-dynamic";

export default function SleepPage() {
  return <VitalsTrackerPage metric="sleep" />;
}
