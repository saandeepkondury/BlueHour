"use client";

import { usePathname } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { FuelTabs } from "@/components/FuelTabs";

/** Log and Recipes get the tab bar; everything nested under Fuel gets a titled back bar. */
export function FuelHeader({ pending }: { pending: number }) {
  const pathname = usePathname();

  if (pathname === "/fuel" || pathname === "/fuel/recipes") {
    return (
      <>
        <AppBar title="Fuel" pending={pending} />
        <div style={{ paddingTop: "0.25rem" }}>
          <FuelTabs />
        </div>
      </>
    );
  }

  if (pathname === "/fuel/recipes/new") {
    return <AppBar title="New recipe" back="/fuel/recipes" pending={pending} />;
  }
  if (pathname.endsWith("/edit")) {
    return <AppBar title="Edit recipe" back={pathname.slice(0, -"/edit".length)} pending={pending} />;
  }
  if (pathname.startsWith("/fuel/recipes/")) {
    return <AppBar title="Recipe" back="/fuel/recipes" pending={pending} />;
  }
  if (pathname.startsWith("/fuel/grocery")) {
    return <AppBar title="Grocery" back="/more" pending={pending} />;
  }
  if (pathname.startsWith("/fuel/supplements")) {
    return <AppBar title="Supplements" back="/more" pending={pending} />;
  }
  return <AppBar title="Fuel" back="/fuel" pending={pending} />;
}
