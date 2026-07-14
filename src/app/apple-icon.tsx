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
          alignItems: "center",
          justifyContent: "center",
          background: "#14161a",
          color: "#2fbfa8",
          fontSize: 120,
          fontWeight: 600,
        }}
      >
        ₹
      </div>
    ),
    { ...size },
  );
}
