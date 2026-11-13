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

// Marca d'água por cliente: identificador da licença embutido no HTML entregue (meta + comentário),
// para rastrear vazamento de uma cópia. Vem de LICENCA_ID; onde fica está em docs/PROTECAO-E-LICENCA.md.
const LICENCA_ID = process.env.LICENCA_ID?.trim() || "sem-identificacao";

export const metadata: Metadata = {
  title: { default: "LS Busca", template: "%s · LS Busca" },
  description: "Busca e acompanhamento de licitações públicas a partir dos dados oficiais do PNCP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning data-licenca={LICENCA_ID} className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <head>
        {/* Marca d'água da licença (ver docs/PROTECAO-E-LICENCA.md). */}
        <meta name="ls-licenca-cliente" content={LICENCA_ID} />
        {/* Aplica o tema (salvo ou o do sistema) e os ajustes de leitura salvos antes da primeira pintura. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var h=document.documentElement,t;try{t=localStorage.getItem("ls-tema")}catch(e){}if(t!=="dark"&&t!=="light")t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";h.dataset.theme=t})();try{var h=document.documentElement;if(localStorage.getItem("ls-contraste")==="alto")h.dataset.contraste="alto";if(localStorage.getItem("ls-texto")==="grande")h.dataset.texto="grande"}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
