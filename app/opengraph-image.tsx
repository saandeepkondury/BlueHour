import { ImageResponse } from "next/og";

export const alt = "Blue Hour — Austin Half trainer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#eae4d8",
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
            background: "#3f7196",
            position: "relative",
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 46,
              left: 56,
              width: 56,
              height: 56,
              borderRadius: 56,
              background: "#f3efe6",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 58,
              right: 58,
              bottom: 58,
              height: 6,
              borderRadius: 6,
              background: "#d9d0c0",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 46,
              right: 46,
              bottom: 42,
              height: 10,
              borderRadius: 10,
              background: "#f3efe6",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 600,
              color: "#2b2f26",
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
              color: "#3f7196",
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
          Austin Half trainer
        </div>
      </div>
    ),
    size,
  );
}
