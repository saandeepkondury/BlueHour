import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, gateEnabled, isValidToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GatedLayout({ children }: { children: React.ReactNode }) {
  if (gateEnabled()) {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    if (!isValidToken(token)) redirect("/unlock");
  }
  return children;
}
