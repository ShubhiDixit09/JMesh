import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JeevanMesh Command Center",
  description:
    "An interactive simulation of a leaderless, self-healing disaster-response drone swarm.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
