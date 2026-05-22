import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clipper",
    short_name: "Clipper",
    description: "A warm minimal image cropper designed for phone installation.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5eedf",
    theme_color: "#ede4d3",
    icons: [
      {
        src: "/clipper-app-icon-20260522.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/clipper-app-icon-20260522.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/clipper-app-icon-20260522.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}