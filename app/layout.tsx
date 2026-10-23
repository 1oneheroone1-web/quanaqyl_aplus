import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";
import "./shop.css";
import "./focus.css";

export const metadata: Metadata = {
  title: "QuanAQYL A+ — Физика",
  description: "Изучай физику на русском, қазақша и English: задачи, диагностика, личный профиль и прогресс.",
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
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
