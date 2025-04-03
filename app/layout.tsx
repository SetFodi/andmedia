// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { SocketProvider } from "@/context/SocketContext"; // Import SocketProvider

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fancy Social Media App",
  description: "A modern social experience",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* SessionProvider should ideally be inside SocketProvider if socket needs session */}
        {/* Or vice-versa depending on dependencies. Let's try Socket -> Session */}
        <SocketProvider>
          <SessionProviderWrapper>{children}</SessionProviderWrapper>
        </SocketProvider>
      </body>
    </html>
  );
}
