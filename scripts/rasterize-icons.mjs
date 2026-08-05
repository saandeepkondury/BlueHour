import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconSvg = readFileSync(join(root, "public/icon.svg"));
const markSvg = readFileSync(join(root, "public/brand/mark.svg"));
const lockupSvg = readFileSync(join(root, "public/brand/lockup.svg"));

async function png(svg, width, height = width) {
  return sharp(svg).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function main() {
  const iosDir = join(root, "ios/BlueHour/Assets.xcassets/AppIcon.appiconset");
  mkdirSync(iosDir, { recursive: true });
  mkdirSync(join(root, "public/brand"), { recursive: true });

  const appIconSizes = [29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];
  for (const size of appIconSizes) {
    writeFileSync(join(iosDir, `AppIcon-${size}.png`), await png(iconSvg, size));
  }

  writeFileSync(join(root, "public/icon-512.png"), await png(iconSvg, 512));
  writeFileSync(join(root, "public/favicon.png"), await png(iconSvg, 64));
  writeFileSync(join(root, "public/brand/blue-hour-app-icon.png"), await png(iconSvg, 1024));
  writeFileSync(join(root, "public/brand/blue-hour-mark.png"), await png(markSvg, 512));
  writeFileSync(
    join(root, "public/brand/blue-hour-logo.png"),
    await sharp(lockupSvg)
      .resize(1440, 400, { fit: "contain", background: { r: 242, g: 240, b: 234, alpha: 1 } })
      .png()
      .toBuffer(),
  );

  console.log("icons rasterized");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
