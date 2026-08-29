import type { Metadata } from "next";
import { BackgroundBeamsWithCollision } from "@/components/effects/BackgroundBeamsWithCollision";
import { NeuralGalaxy } from "@/components/effects/NeuralGalaxy";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEGIS-TWIN",
  description: "Bounded spacecraft autonomy demonstrator.",
  icons: {
    icon: "/brand/aegis-twin-logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <NeuralGalaxy color={[1, 1, 1]} opacity={0.82} speed={0.00072} intensity={1.18} />
        <BackgroundBeamsWithCollision />
        <div className="page-content">{children}</div>
      </body>
    </html>
  );
}
