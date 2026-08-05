import { FuelTabs } from "@/components/FuelTabs";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";

export default function FuelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Shell wide>
        <section className="sec">
          <p className="sec-label">III · Fuel</p>
          <h2 className="sec-title">
            What the week <em>asks you to eat</em>
          </h2>
        </section>
        <FuelTabs />
        {children}
      </Shell>
      <Nav />
    </>
  );
}
