import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HostelHub — Find Your Perfect Student Room",
    template: "%s | HostelHub",
  },
  description:
    "Browse verified student hostels near your university. Compare prices, view photos and video walkthroughs, and book your room online with mobile money or card.",
  keywords: ["student hostel", "Ghana", "university accommodation", "room booking"],
  openGraph: {
    title: "HostelHub",
    description: "Find and book student accommodation near your university.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(inter.variable, "antialiased")}>
      <body className="bg-background text-foreground font-sans">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
