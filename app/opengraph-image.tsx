import { ImageResponse } from "next/og";

export const alt = "Blue Hour — half marathon trainer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f2f0ea",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            width: 168,
            height: 168,
            borderRadius: 168,
            background: "#2f6d99",
            position: "relative",
            display: "flex",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 34,
              width: 56,
              height: 56,
              borderRadius: 56,
              background: "#f3efe6",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 56,
              width: 50,
              height: 50,
              borderRadius: 50,
              background: "#2f6d99",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -8,
              right: -12,
              bottom: 0,
              height: 58,
              background: "#e6ddd0",
              borderTopLeftRadius: 48,
              borderTopRightRadius: 72,
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 600,
              color: "#161a17",
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            Blue
          </div>
          <div
            style={{
              fontSize: 72,
              fontStyle: "italic",
              fontWeight: 500,
              color: "#2f6d99",
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            Hour
          </div>
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#5c6158",
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          Half marathon trainer
        </div>
      </div>
    ),
    size,
  );
}
