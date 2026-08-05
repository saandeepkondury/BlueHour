import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
      <p className="monogram">Blue Hour</p>
      <p className="small" style={{ color: "rgba(249,241,221,0.8)", maxWidth: "22rem" }}>
        Thirteen point one miles down Congress Avenue. Let us in.
      </p>
      <form action={unlock}>
        {bad ? <p className="error">That is not the passcode.</p> : null}
        <label className="field">
          <span className="field-label" style={{ color: "rgba(249,241,221,0.75)" }}>
            Passcode
          </span>
          <input name="code" type="password" autoFocus autoComplete="current-password" />
        </label>
        <button className="btn btn--gold btn--full" type="submit">
          Enter
        </button>
      </form>
    </main>
  );
}
