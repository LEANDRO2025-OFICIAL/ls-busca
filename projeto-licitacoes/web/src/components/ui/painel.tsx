import Link from "next/link";
import type { ReactNode } from "react";

const numero = new Intl.NumberFormat("pt-BR");

/** Quadro de número: vira link quando recebe href. */
export function Indicador({
  rotulo,
  valor,
  href,
  dica,
}: {
  rotulo: string;
  valor: number | string;
  href?: string;
  dica?: string;
}) {
  const conteudo = (
    <>
      <span className="text-xs font-medium text-muted">{rotulo}</span>
      <span className="num text-2xl font-bold text-ink">{typeof valor === "number" ? numero.format(valor) : valor}</span>
      {dica && <span className="text-xs text-muted">{dica}</span>}
    </>
  );
  const classes = "flex flex-col gap-1 rounded-lg border border-line bg-bg p-4 shadow-card";
  return href ? (
    <Link href={href} className={`${classes} hover:border-accent`}>
      {conteudo}
    </Link>
  ) : (
    <div className={classes}>{conteudo}</div>
  );
}

export function Secao({
  titulo,
  link,
  id,
  children,
}: {
  titulo: string;
  link?: { href: string; rotulo: string };
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{titulo}</h2>
        {link && (
          <Link href={link.href} className="text-xs font-semibold text-accent hover:underline">
            {link.rotulo}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
