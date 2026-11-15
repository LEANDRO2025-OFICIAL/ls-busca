import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Variante = "primario" | "secundario" | "fantasma" | "perigo";
type Tamanho = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-strong",
  secundario: "border border-line-strong bg-bg text-ink hover:bg-surface active:bg-surface-2",
  fantasma: "text-accent hover:bg-accent-soft active:text-accent-strong",
  perigo: "bg-danger text-on-accent hover:opacity-90 active:opacity-80",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
  icone?: LucideIcon;
};

export function Botao({
  variante = "primario",
  tamanho = "md",
  carregando = false,
  icone: Icone,
  className,
  children,
  disabled,
  ...props
}: BotaoProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold transition-[color,background-color,border-color,opacity]",
        "disabled:pointer-events-none disabled:opacity-55",
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
    >
      {carregando ? (
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
      ) : Icone ? (
        <Icone aria-hidden className="size-4" />
      ) : null}
      {children}
    </button>
  );
}

type CampoTextoProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  icone?: LucideIcon;
};

export function CampoTexto({ id, rotulo, erro, dica, icone: Icone, className, ...props }: CampoTextoProps) {
  const idAjuda = erro ? `${id}-erro` : dica ? `${id}-dica` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {rotulo}
      </label>
      <div className="relative">
        {Icone && (
          <Icone aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        )}
        <input
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={idAjuda}
          {...props}
          className={cn(
            "h-10 w-full rounded-md border bg-bg px-3 text-sm text-ink placeholder:text-muted",
            "disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted",
            Icone && "pl-9",
            erro ? "border-danger" : "border-line-strong",
          )}
        />
      </div>
      {erro ? (
        <p id={`${id}-erro`} className="text-xs text-danger">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${id}-dica`} className="text-xs text-muted">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

export type TomSelo = "neutro" | "accent" | "sucesso" | "aviso" | "perigo";

const TONS: Record<TomSelo, string> = {
  neutro: "bg-surface-2 text-ink",
  accent: "bg-accent-soft text-accent-strong",
  sucesso: "bg-success-soft text-success",
  aviso: "bg-warning-soft text-warning",
  perigo: "bg-danger-soft text-danger",
};

export function Selo({ tom = "neutro", children, className }: { tom?: TomSelo; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium", TONS[tom], className)}>
      {children}
    </span>
  );
}

export function Alerta({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}

export function EstadoVazio({
  icone: Icone,
  titulo,
  texto,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  texto: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <Icone aria-hidden className="size-8 text-muted" />
      <p className="text-base font-semibold text-ink">{titulo}</p>
      <p className="max-w-sm text-sm text-muted">{texto}</p>
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}
