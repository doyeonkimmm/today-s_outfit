import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오늘모입지",
  description: "오늘 입을 코디를 고르고 기록하는 나만의 옷장",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
