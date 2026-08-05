"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

const RETURN_KEY = "bh-more-return";

function rememberReturn(pathname: string) {
  if (pathname === "/more" || pathname.startsWith("/more?")) return;
  sessionStorage.setItem(RETURN_KEY, pathname);
}

function canGoBack() {
  const state = window.history.state;
  if (typeof state?.idx === "number") return state.idx > 0;
  return Boolean(state?.__NA) && window.history.length > 1;
}

export function MoreLink({ pending = 0 }: { pending?: number }) {
  const pathname = usePathname();

  return (
    <Link
      className="iconbtn"
      href="/more"
      aria-label="All pages"
      onClick={() => rememberReturn(pathname)}
    >
      <Icon name="grid" size={20} />
      {pending > 0 ? <span className="iconbtn__dot" /> : null}
    </Link>
  );
}

export function BackButton({ href }: { href: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="iconbtn"
      aria-label="Back"
      onClick={() => {
        if (href === "/") {
          const ret = sessionStorage.getItem(RETURN_KEY);
          if (ret && ret !== "/more") {
            sessionStorage.removeItem(RETURN_KEY);
            router.push(ret);
            return;
          }
        }

        if (canGoBack()) {
          router.back();
          return;
        }

        router.push(href);
      }}
    >
      <Icon name="back" size={22} />
    </button>
  );
}
