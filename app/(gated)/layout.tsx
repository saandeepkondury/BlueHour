import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth/session";
import { getProfile, isOnboarded } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function GatedLayout({ children }: { children: React.ReactNode }) {
  // Validates the cookie against the sessions table; middleware only checked
  // that one was present.
  if (!(await sessionUserId())) redirect("/signin");

  const current = await getProfile();
  if (!isOnboarded(current)) redirect("/onboard");

  return children;
}
