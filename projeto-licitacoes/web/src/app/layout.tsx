import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "LS Busca", template: "%s · LS Busca" },
  description: "Busca e acompanhamento de licitações públicas a partir dos dados oficiais do PNCP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <head>
        {/* Aplica os ajustes de leitura salvos (alto contraste, texto grande) antes da primeira pintura. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var h=document.documentElement;if(localStorage.getItem("ls-contraste")==="alto")h.dataset.contraste="alto";if(localStorage.getItem("ls-texto")==="grande")h.dataset.texto="grande"}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
