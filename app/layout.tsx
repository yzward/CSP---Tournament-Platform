import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import PageTransition from "@/components/PageTransition";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Clash Stats Pro",
  description: "Professional tournament management, live scoring, and player rankings for Beyblade.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Clash Stats Pro",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;

  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        <Navbar />
        <main className="min-h-screen pt-16">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  );
}
