import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "110px",
          border: "18px solid rgba(22,18,13,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              width: 260,
              height: 260,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 70,
              border: "16px solid #16120d",
              boxShadow: "0 18px 40px rgba(22,18,13,0.12)",
            }}
          >
            <div
              style={{
                width: 134,
                height: 134,
                borderRadius: 34,
                border: "12px solid #16120d",
              }}
            />
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -4 }}>CLIP</div>
        </div>
      </div>
    ),
    size,
  );
}