import Link from "next/link";
import { connection } from "next/server";
import { Bell } from "lucide-react";
import { listarBuscasSalvas, novidadesDoAlerta } from "@/lib/dados/alertas";
import { obterDb } from "@/lib/dados/db";
import { resumoDocumentos } from "@/lib/dados/documentos";
import { obterPerfil } from "@/lib/dados/perfil";
import { listarPrazos } from "@/lib/dados/prazos";
import { exigirOrganizacao } from "@/lib/sessao";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const QUARENTA_E_OITO_HORAS = 48 * 3_600_000;

/**
 * Sino da barra superior. Notificações = buscas salvas com licitações novas desde que foram vistas
 * + prazos das licitações acompanhadas nas próximas 48 h. Calculado ao carregar a página (sem consulta periódica).
 */
export async function Sino() {
  await connection();
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const agora = new Date();

  const perfil = await obterPerfil(db, organizacaoId);
  const buscas = (await listarBuscasSalvas(db, organizacaoId)).slice(0, 10);
  const alertas: { id: string; nome: string; total: number }[] = [];
  for (const b of buscas) {
    const { novas } = await novidadesDoAlerta(db, organizacaoId, perfil, b);
    if (novas.total > 0) alertas.push({ id: b.id, nome: b.nome, total: novas.total });
  }
  const prazos = (await listarPrazos(db, organizacaoId))
    .filter((p) => p.quando >= agora && p.quando.getTime() - agora.getTime() <= QUARENTA_E_OITO_HORAS)
    .slice(0, 5);
  const documentos = await resumoDocumentos(db, organizacaoId);
  const temDocumentos = documentos.vencidos + documentos.vencendo > 0;
  const quantidade = alertas.length + prazos.length + (temDocumentos ? 1 : 0);

  return (
    <details className="relative">
      <summary
        aria-label={quantidade ? `Notificações: ${quantidade}` : "Notificações"}
        className="relative flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-line-strong bg-bg hover:bg-surface-2 [&::-webkit-details-marker]:hidden"
      >
        <Bell aria-hidden className="size-4" />
        {quantidade > 0 && (
          <span
            aria-hidden
            className="num absolute -top-1.5 -right-1.5 rounded-full bg-danger px-1 text-[10px] leading-4 font-bold text-on-accent"
          >
            {quantidade > 99 ? "99+" : quantidade}
          </span>
        )}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-80 max-w-[90vw] rounded-lg border border-line bg-bg p-2 shadow-pop">
        {quantidade === 0 ? (
          <p className="px-2 py-3 text-sm text-muted">Nada novo por aqui.</p>
        ) : (
          <ul className="flex flex-col">
            {alertas.map((a) => (
              <li key={a.id}>
                <Link href="/alertas" className="flex flex-col gap-0.5 rounded-md px-2 py-2 hover:bg-surface">
                  <span className="line-clamp-1 text-sm font-medium text-ink">{a.nome}</span>
                  <span className="text-xs text-muted">
                    {a.total} {a.total === 1 ? "licitação nova" : "licitações novas"} nesta busca
                  </span>
                </Link>
              </li>
            ))}
            {temDocumentos && (
              <li>
                <Link href="/documentos" className="flex flex-col gap-0.5 rounded-md px-2 py-2 hover:bg-surface">
                  <span className="text-sm font-medium text-ink">Documentos da empresa</span>
                  <span className="text-xs text-warning">
                    {documentos.vencidos > 0 && `${documentos.vencidos} ${documentos.vencidos === 1 ? "vencido" : "vencidos"}`}
                    {documentos.vencidos > 0 && documentos.vencendo > 0 && " · "}
                    {documentos.vencendo > 0 && `${documentos.vencendo} vencendo em breve`}
                  </span>
                </Link>
              </li>
            )}
            {prazos.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="flex flex-col gap-0.5 rounded-md px-2 py-2 hover:bg-surface">
                  <span className="line-clamp-1 text-sm font-medium text-ink">{p.objeto}</span>
                  <span className="num text-xs text-warning">
                    {p.titulo} · {formatoDataHora.format(p.quando)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/alertas" className="mt-1 block rounded-md px-2 py-2 text-xs font-semibold text-accent hover:bg-accent-soft">
          Ver todos os alertas
        </Link>
      </div>
    </details>
  );
}
