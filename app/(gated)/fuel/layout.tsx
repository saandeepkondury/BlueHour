import { AppBar } from "@/components/AppBar";
import { FuelTabs } from "@/components/FuelTabs";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { pendingCount } from "@/lib/coach/store";

export default async function FuelLayout({ children }: { children: React.ReactNode }) {
  const pending = await pendingCount();

  return (
    <>
      <Shell>
        <AppBar title="Fuel" pending={pending} />
        <div style={{ paddingTop: "0.25rem" }}>
          <FuelTabs />
        </div>
        {children}
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
