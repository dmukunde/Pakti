import type { MetadataRoute } from "next";

// Makes Pakti installable ("Add to Home Screen" / "Install app"): it opens
// full screen on This Week, with its own icon and calm paper background.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pakti",
    short_name: "Pakti",
    description: "Progress, consistency, learning and restarting — not perfection.",
    start_url: "/week",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#11131f",
    theme_color: "#11131f",
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
