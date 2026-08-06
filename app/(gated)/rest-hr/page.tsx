import { VitalsTrackerPage } from "@/components/VitalsTrackerPage";

export const dynamic = "force-dynamic";

export default function RestHrPage() {
  return <VitalsTrackerPage metric="rest_hr" />;
}
