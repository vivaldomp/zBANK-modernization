import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "zBank — Caixa Eletrônico",
  description: "Modernização do sistema COBOL ZBANK",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
