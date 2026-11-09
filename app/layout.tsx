import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "The Traitors Analytics", description: "Архив и статистически анализ на Traitors: Игра на предатели", icons: { icon: "/icon.svg" } };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="bg"><body>{children}</body></html>;
}
