import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오늘모입지 — 날씨와 함께 고르는 오늘의 코디",
  description: "내 옷을 넘겨 보고 오늘 입을 코디를 간편하게 기록하는 개인 옷장",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
