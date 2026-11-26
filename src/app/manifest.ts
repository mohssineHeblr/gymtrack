import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GYMTRACK",
    short_name: "GYMTRACK",
    description: "Premium workout, progress and nutrition tracker.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Start workout", url: "/workout", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Log food", url: "/nutrition", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
