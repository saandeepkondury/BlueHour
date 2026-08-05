import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Matches public/icon.svg — dusk sky, waxing crescent, limestone ridge. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #16324a 0%, #2a6188 48%, #3f7196 100%)",
          position: "relative",
          display: "flex",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 26,
            left: 34,
            width: 59,
            height: 59,
            borderRadius: 59,
            background: "#f3efe6",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 56,
            width: 53,
            height: 53,
            borderRadius: 53,
            background: "#1d4460",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -12,
            right: -18,
            bottom: 22,
            height: 62,
            background: "#c5d0d6",
            borderTopLeftRadius: 80,
            borderTopRightRadius: 50,
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -12,
            right: -18,
            bottom: 0,
            height: 52,
            background: "#eae4d8",
            borderTopLeftRadius: 64,
            borderTopRightRadius: 88,
          }}
        />
      </div>
    ),
    size,
  );
}
