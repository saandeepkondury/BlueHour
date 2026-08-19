import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/app/auth-actions";
import { BrandLockup } from "@/components/Brand";
import { sessionUserId } from "@/lib/auth/session";

export const metadata = { title: "Sign in · Blue Hour" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; deleted?: string }>;
}) {
  const { error, next, deleted } = await searchParams;
  if (await sessionUserId()) redirect("/");

  return (
    <main className="unlock">
      <BrandLockup />
      <p className="small muted unlock__lede">
        Your plan, your Watch data, your account.
      </p>

      <form action={signIn}>
        {error ? <p className="notice notice--bad">{error}</p> : null}
        {deleted ? (
          <p className="notice notice--good">Your account and its data are gone.</p>
        ) : null}
        <input type="hidden" name="next" value={next ?? "/"} />
        <label className="field">
          <span className="sr-only">Email</span>
          <input
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            autoCapitalize="none"
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span className="sr-only">Password</span>
          <input
            name="password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="btn btn--primary btn--block" type="submit">
          Sign in
        </button>
        <p className="small muted" style={{ margin: 0 }}>
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
