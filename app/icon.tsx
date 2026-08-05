import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Matches public/icon.svg — dusk sky, waxing crescent, limestone ridge. */
export default function Icon() {
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
            top: 9,
            left: 12,
            width: 21,
            height: 21,
            borderRadius: 21,
            background: "#f3efe6",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 20,
            width: 19,
            height: 19,
            borderRadius: 19,
            background: "#1d4460",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -4,
            right: -8,
            bottom: 8,
            height: 22,
            background: "#c5d0d6",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 18,
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -4,
            right: -8,
            bottom: 0,
            height: 18,
            background: "#eae4d8",
            borderTopLeftRadius: 22,
            borderTopRightRadius: 30,
          }}
        />
      </div>
    ),
    size,
  );
}
