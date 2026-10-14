import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoBusiness AI · Inteligencia territorial",
  description: "Explora ubicaciones comerciales en Lima con datos de OpenStreetMap y fuentes transparentes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}

