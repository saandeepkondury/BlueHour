import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Matches public/icon.svg — cream moon over paired horizons on blue-hour. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#3f7196",
          position: "relative",
          display: "flex",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 17,
            left: 21,
            width: 22,
            height: 22,
            borderRadius: 22,
            background: "#f3efe6",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            bottom: 22,
            height: 2,
            borderRadius: 2,
            background: "#d9d0c0",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 17,
            right: 17,
            bottom: 15,
            height: 4,
            borderRadius: 4,
            background: "#f3efe6",
          }}
        />
      </div>
    ),
    size,
  );
}
