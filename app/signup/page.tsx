import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp } from "@/app/auth-actions";
import { BrandLockup } from "@/components/Brand";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { sessionUserId } from "@/lib/auth/session";

export const metadata = { title: "Create an account · Blue Hour" };
export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  if (await sessionUserId()) redirect("/");

  return (
    <main className="unlock">
      <BrandLockup />
      <p className="small muted unlock__lede">
        Pick your race. Blue Hour builds the weeks back from it.
      </p>

      <form action={signUp}>
        {error ? <p className="notice notice--bad">{error}</p> : null}
        <input type="hidden" name="next" value={next ?? "/"} />
        <label className="field">
          <span className="sr-only">First name</span>
          <input name="name" placeholder="First name" autoComplete="given-name" />
        </label>
        <label className="field">
          <span className="sr-only">Email</span>
          <input
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            autoCapitalize="none"
            required
          />
        </label>
        <label className="field">
          <span className="sr-only">Password</span>
          <input
            name="password"
            type="password"
            placeholder={`Password — ${MIN_PASSWORD_LENGTH}+ characters`}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </label>
        <button className="btn btn--primary btn--block" type="submit">
          Create account
        </button>
        <p className="small muted" style={{ margin: 0 }}>
          Already have one? <Link href="/signin">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
