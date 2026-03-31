import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interdimensional Cable Radio",
  description: "Broadcasting from dimensions unknown since 2026.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=VT323&family=Press+Start+2P&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
