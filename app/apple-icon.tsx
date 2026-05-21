import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #f8f2e6 0%, #ecdfc8 100%)",
          color: "#16120d",
          borderRadius: 42,
          border: "6px solid rgba(22,18,13,0.08)",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 24,
            border: "8px solid #16120d",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              border: "6px solid #16120d",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}