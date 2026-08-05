import { BrandBar } from "@/components/Brand";

export function Shell({
  children,
  wide = false,
  showBrand = true,
}: {
  children: React.ReactNode;
  wide?: boolean;
  showBrand?: boolean;
}) {
  return (
    <main className={wide ? "shell shell--wide" : "shell"}>
      {showBrand ? <BrandBar /> : null}
      {children}
    </main>
  );
}
