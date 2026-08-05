import { FuelTabs } from "@/components/FuelTabs";
import { Nav } from "@/components/Nav";

export default function FuelLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell shell--wide">
      <section className="sec">
        <p className="sec-label">III · Fuel</p>
        <h2 className="sec-title">
          What the week <em>asks you to eat</em>
        </h2>
      </section>
      <FuelTabs />
      {children}
      <Nav />
    </main>
  );
}
