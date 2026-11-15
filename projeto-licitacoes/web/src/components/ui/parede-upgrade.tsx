import { Lock } from "lucide-react";
import { INFO_PLANO, type Plano } from "@/lib/planos";

/**
 * Exibida quando a organização não tem o plano mínimo para acessar uma funcionalidade.
 * Não bloqueia navegação — é uma parede suave que mostra o que está disponível no upgrade.
 */
export function ParedeUpgrade({ planoAtual, planoNecessario, funcionalidade }: {
  planoAtual: Plano;
  planoNecessario: Plano;
  funcionalidade: string;
}) {
  const infoAtual = INFO_PLANO[planoAtual];
  const infoNecessario = INFO_PLANO[planoNecessario];
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Lock className="size-7" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-ink">{funcionalidade}</h2>
        <p className="text-sm text-muted">
          Esta funcionalidade está disponível a partir do plano{" "}
          <strong className="text-ink">{infoNecessario.nome}</strong>.
          Seu plano atual é <strong className="text-ink">{infoAtual.nome}</strong>.
        </p>
        <p className="mt-1 text-sm text-muted">{infoNecessario.descricao}</p>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted">
        <p>Entre em contato com o fornecedor para fazer o upgrade.</p>
      </div>
    </div>
  );
}
