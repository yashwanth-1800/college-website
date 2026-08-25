import { ImageResponse } from "next/og";
import { projects } from "@/lib/demo-data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const project = projects.find((item) => item.id === projectId) ?? projects[0];
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 72, background: "linear-gradient(135deg,#06152d,#075985)", color: "white", fontFamily: "sans-serif" }}><div style={{ color: "#67e8f9", fontSize: 26 }}>PROJECTMATCH · SRM KATTANKULATHUR</div><div style={{ fontSize: 70, fontWeight: 700, marginTop: 24 }}>{project.title}</div><div style={{ fontSize: 34, marginTop: 24, color: "#cbd5e1" }}>{project.roles} open roles · {project.categories.join(" · ")}</div></div>, size);
}

