import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconSvg = readFileSync(join(root, "public/icon.svg"));
const markSvg = readFileSync(join(root, "public/brand/mark.svg"));
const lockupSvg = readFileSync(join(root, "public/brand/lockup.svg"));

function png(svg, width) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true },
  })
    .render()
    .asPng();
}

const iosDir = join(root, "ios/BlueHour/Assets.xcassets/AppIcon.appiconset");
mkdirSync(iosDir, { recursive: true });
mkdirSync(join(root, "public/brand"), { recursive: true });

const appIconSizes = [29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];
for (const size of appIconSizes) {
  writeFileSync(join(iosDir, `AppIcon-${size}.png`), png(iconSvg, size));
}
writeFileSync(join(root, "public/icon-512.png"), png(iconSvg, 512));
writeFileSync(join(root, "public/brand/blue-hour-app-icon.png"), png(iconSvg, 1024));
writeFileSync(join(root, "public/brand/blue-hour-mark.png"), png(markSvg, 512));
writeFileSync(join(root, "public/brand/blue-hour-logo.png"), png(lockupSvg, 1440));
