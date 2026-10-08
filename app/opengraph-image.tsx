import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link-preview card (WhatsApp, LinkedIn, Slack...), drawn in the site's dark palette and faces.
export const alt = "Wei Han, software engineer working on AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const serif = await readFile(join(process.cwd(), "assets/InstrumentSerif-Regular.ttf"));
const mono = await readFile(join(process.cwd(), "assets/IBMPlexMono-Regular.ttf"));

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "80px 96px", background: "#101615", color: "#C8D1CE", fontFamily: "Plex Mono",
        }}
      >
        <div style={{ fontSize: 24, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4C979E" }}>
          Software engineer · AI
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontFamily: "Instrument Serif", fontSize: 128, lineHeight: 1 }}>Chin Wei Han</div>
          <div style={{ fontSize: 30, color: "#98A6A3", maxWidth: 900 }}>
            From model architectures to production systems.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#98A6A3", borderTop: "1px solid #2A3735", paddingTop: 28 }}>
          <span>weihan.tech</span>
          <span>Kuala Lumpur · Malaysia</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Serif", data: serif, style: "normal", weight: 400 },
        { name: "Plex Mono", data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}
