import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BrandLockup } from "@/components/Brand";
import { AUTH_COOKIE, gateEnabled, isValidCode, tokenFor } from "@/lib/auth";

export const metadata = { title: "Blue Hour" };

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>;
}) {
  const { bad } = await searchParams;
  if (!gateEnabled()) redirect("/");

  async function unlock(formData: FormData) {
    "use server";
    const code = String(formData.get("code") ?? "");
    if (!isValidCode(code)) redirect("/unlock?bad=1");

    const jar = await cookies();
    jar.set(AUTH_COOKIE, tokenFor(code), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/");
  }

  return (
    <main className="unlock">
      <BrandLockup />
      <p className="small muted">Thirteen point one miles down Congress Avenue.</p>
      <form action={unlock}>
        {bad ? <p className="notice notice--bad">That is not the passcode.</p> : null}
        <label className="field">
          <span className="sr-only">Passcode</span>
          <input
            name="code"
            type="password"
            placeholder="Passcode"
            autoFocus
            autoComplete="current-password"
          />
        </label>
        <button className="btn btn--primary btn--block" type="submit">
          Enter
        </button>
      </form>
    </main>
  );
}
