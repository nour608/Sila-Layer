import type { Metadata, Viewport } from "next";
import "./globals.css";
import DynamicPrivyProvider from "@/components/providers/DynamicPrivyProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const themeScript = `(function(){try{var t=localStorage.getItem('sila-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Sila Layer — Compliant Stablecoin Settlement for UAE Merchants",
  description:
    "A settlement router that automatically routes each stablecoin transaction to the legally-correct rail for your merchant zone — AED-PT for mainland retail, USDC where PTSR permits.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F6B5C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <DynamicPrivyProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </DynamicPrivyProvider>
      </body>
    </html>
  );
}
