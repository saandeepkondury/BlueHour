import { FuelHeader } from "@/components/FuelHeader";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { pendingCount } from "@/lib/habits/store";

export default async function FuelLayout({ children }: { children: React.ReactNode }) {
  const pending = await pendingCount();

  return (
    <>
      <Shell>
        <FuelHeader pending={pending} />
        {children}
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
