import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Bonne Humeur TV — La Télé de la nouvelle génération";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A0A0F 0%, #17171F 100%)",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Filet tricolore */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 16,
            display: "flex",
            background:
              "linear-gradient(90deg, #CE1126 0%, #CE1126 33.33%, #FCD116 33.33%, #FCD116 66.66%, #009A44 66.66%, #009A44 100%)",
          }}
        />
        {/* Logo */}
        <div
          style={{
            display: "flex",
            width: 120,
            height: 120,
            borderRadius: 28,
            background: "#CE1126",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: "26px solid transparent",
              borderBottom: "26px solid transparent",
              borderLeft: "40px solid white",
              marginLeft: 8,
            }}
          />
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "white",
            letterSpacing: -2,
            display: "flex",
          }}
        >
          Bonne Humeur <span style={{ color: "#CE1126", marginLeft: 16 }}>TV</span>
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: "#FCD116",
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          La Télé de la nouvelle génération
        </div>
        <div style={{ marginTop: 28, fontSize: 22, color: "#9ca3af" }}>
          Conakry — République de Guinée 🇬🇳
        </div>
      </div>
    ),
    { ...size }
  );
}
