import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          background: "#eae4d8",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 26,
            right: 34,
            width: 30,
            height: 30,
            borderRadius: 30,
            background: "#3f7196",
          }}
        />
        <div
          style={{
            width: "100%",
            height: 92,
            background: "#ded5c2",
            borderTop: "5px solid #3c5140",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#2b2f26",
            fontSize: 44,
            fontWeight: 700,
            fontFamily: "Georgia, serif",
          }}
        >
          13.1
        </div>
      </div>
    ),
    size,
  );
}
