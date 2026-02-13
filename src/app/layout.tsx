import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vectus Projects",
  description: "MVP de seguimiento end-to-end de proyectos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}