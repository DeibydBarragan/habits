import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { Toast } from "@heroui/react";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "habits · hábitos con calma",
  description: "Construye lo bueno y evita lo malo, un día a la vez.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

const clientInitScript = `(function(){
  try{
    var t=localStorage.getItem("habits-theme");
    if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
    if(t==="dark"){document.documentElement.classList.add("dark");}
  }catch(e){}
  try{
    var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(tz){
      var match=document.cookie.match(/(?:^|; )user-tz=([^;]*)/);
      if(!match||decodeURIComponent(match[1])!==tz){
        document.cookie="user-tz="+encodeURIComponent(tz)+";path=/;max-age=31536000;SameSite=Lax";
      }
    }
  }catch(e){}
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script strategy="beforeInteractive" id="client-init" dangerouslySetInnerHTML={{ __html: clientInitScript }} />
      </head>
      <body className={inter.className}>
        {children}
        <Toast.Provider />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
