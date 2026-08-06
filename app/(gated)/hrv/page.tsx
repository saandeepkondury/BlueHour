import { VitalsTrackerPage } from "@/components/VitalsTrackerPage";

export const dynamic = "force-dynamic";

export default function HrvPage() {
  return <VitalsTrackerPage metric="hrv" />;
}
