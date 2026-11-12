"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { acaoSalvarRobo, type EstadoFormularioRobo } from "@/app/acoes-robo";
import { campoItem, MAX_ITENS, MODOS, ROTULO_MODO, type Modo } from "@/lib/robo/formulario";
import { ESTRATEGIAS, ROTULO_ESTRATEGIA, type Criterio, type Estrategia } from "@/lib/robo/tipos";
import { Alerta, Botao } from "./basicos";

type Valores = Record<string, string>;
type ItemForm = { chave: number; valores: Valores };

const entrada = "h-10 w-full rounded-md border bg-bg px-3 text-sm text-ink placeholder:text-muted";
const seletor = "h-10 w-full rounded-md border border-line-strong bg-bg px-2 text-sm text-ink";

function Campo({
  nome,
  rotulo,
  valor,
  erro,
  dica,
  ...props
}: { nome: string; rotulo: string; valor?: string; erro?: string; dica?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const ajuda = erro ? `${nome}-erro` : dica ? `${nome}-dica` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={nome} className="text-sm font-medium text-ink">
        {rotulo}
      </label>
      <input
        id={nome}
        name={nome}
        defaultValue={valor}
        aria-invalid={erro ? true : undefined}
        aria-describedby={ajuda}
        className={`${entrada} ${erro ? "border-danger" : "border-line-strong"}`}
        {...props}
      />
      {erro ? (
        <p id={`${nome}-erro`} className="text-xs text-danger">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${nome}-dica`} className="text-xs text-muted">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

export type DadosFormularioRobo = {
  acompanhamentoId: string;
  versao: number | null;
  criterio: Criterio;
  modo: Modo;
  parametros: Valores;
  itens: Valores[];
};

/** Itens do formulário a partir dos campos item-<i>-<campo> devolvidos pela ação. */
function itensDosCampos(campos: Valores): Valores[] {
  const total = Math.min(Number(campos.itens) || 0, MAX_ITENS);
  return Array.from({ length: total }, (_, i) => {
    const prefixo = `item-${i}-`;
    return Object.fromEntries(Object.entries(campos).filter(([k]) => k.startsWith(prefixo)).map(([k, v]) => [k.slice(prefixo.length), v]));
  });
}

export function FormularioRobo({ dados, itemPadrao }: { dados: DadosFormularioRobo; itemPadrao: Valores }) {
  const [estado, acao, pendente] = useActionState<EstadoFormularioRobo, FormData>(acaoSalvarRobo, { erros: {}, valores: null, tentativa: 0 });
  const inicial: DadosFormularioRobo = estado.valores
    ? {
        ...dados,
        criterio: estado.valores.criterio === "maior_desconto" ? "maior_desconto" : "menor_preco",
        modo: estado.valores.modo === "aberto_fechado" ? "aberto_fechado" : "aberto",
        parametros: estado.valores,
        itens: itensDosCampos(estado.valores),
      }
    : dados;
  // A cada tentativa o formulário remonta com o que foi enviado (o React limpa o formulário após a ação).
  return <Corpo key={estado.tentativa} inicial={inicial} itemPadrao={itemPadrao} erros={estado.erros} acao={acao} pendente={pendente} />;
}

function Corpo({
  inicial,
  itemPadrao,
  erros,
  acao,
  pendente,
}: {
  inicial: DadosFormularioRobo;
  itemPadrao: Valores;
  erros: Record<string, string>;
  acao: (f: FormData) => void;
  pendente: boolean;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [criterio, setCriterio] = useState<Criterio>(inicial.criterio);
  const [modo, setModo] = useState<Modo>(inicial.modo);
  const [itens, setItens] = useState<ItemForm[]>(() =>
    (inicial.itens.length > 0 ? inicial.itens : [itemPadrao]).map((valores, chave) => ({ chave, valores })),
  );
  const [estrategias, setEstrategias] = useState<Record<number, Estrategia>>(() =>
    Object.fromEntries(itens.map((i) => [i.chave, (i.valores.estrategia as Estrategia) || "cobrir"])),
  );
  const [revisao, setRevisao] = useState<{ numero: string; descricao: string; limite: string; estrategia: string }[] | null>(null);
  const desconto = criterio === "maior_desconto";
  const unidade = desconto ? "%" : "R$";
  const temErros = Object.keys(erros).length > 0;

  function adicionar() {
    const chave = Math.max(-1, ...itens.map((i) => i.chave)) + 1;
    const usados = [...(formulario.current?.querySelectorAll<HTMLInputElement>('input[name$="-numero"]') ?? [])].map((x) => Number(x.value) || 0);
    const numero = String(Math.max(0, ...usados) + 1);
    setItens([...itens, { chave, valores: { ...itemPadrao, numero, descricao: "", referencia: "", limite: "" } }]);
    setEstrategias({ ...estrategias, [chave]: "cobrir" });
    setRevisao(null);
  }

  function revisar() {
    const f = formulario.current;
    if (!f) return;
    const d = new FormData(f);
    setRevisao(
      itens.map((_, i) => ({
        numero: String(d.get(campoItem(i, "numero")) ?? ""),
        descricao: String(d.get(campoItem(i, "descricao")) ?? ""),
        limite: String(d.get(campoItem(i, "limite")) ?? "").trim(),
        estrategia: ROTULO_ESTRATEGIA[(d.get(campoItem(i, "estrategia")) as Estrategia) ?? "cobrir"] ?? "",
      })),
    );
  }

  return (
    <form ref={formulario} action={acao} className="flex flex-col gap-5" onChange={(ev) => {
        // Mudou qualquer campo depois de revisar: precisa revisar de novo (a caixa de confirmação não conta).
        if ((ev.target as unknown as HTMLInputElement).name !== "confirmacao") setRevisao(null);
      }}>
      <input type="hidden" name="acompanhamentoId" value={inicial.acompanhamentoId} />
      {inicial.versao != null && <input type="hidden" name="versao" value={inicial.versao} />}
      <input type="hidden" name="itens" value={itens.length} />
      {erros.geral && <Alerta>{erros.geral}</Alerta>}
      {temErros && !erros.geral && <Alerta>Revise os campos marcados. Nada foi salvo.</Alerta>}

      <fieldset className="grid gap-3 rounded-lg border border-line bg-bg p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-ink">Disputa</legend>
        <div className="flex flex-col gap-1">
          <label htmlFor="criterio" className="text-sm font-medium text-ink">
            Critério de julgamento
          </label>
          <select id="criterio" name="criterio" defaultValue={criterio} onChange={(e) => setCriterio(e.target.value as Criterio)} className={seletor}>
            <option value="menor_preco">Menor preço</option>
            <option value="maior_desconto">Maior desconto</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="modo" className="text-sm font-medium text-ink">
            Modo de disputa
          </label>
          <select id="modo" name="modo" defaultValue={modo} onChange={(e) => setModo(e.target.value as Modo)} className={seletor}>
            {MODOS.map((m) => (
              <option key={m} value={m}>
                {ROTULO_MODO[m]}
              </option>
            ))}
          </select>
          {erros.modo && <p className="text-xs text-danger">{erros.modo}</p>}
        </div>
        <Campo nome="intervaloProprio" rotulo="Intervalo mínimo entre seus lances (s)" valor={inicial.parametros.intervaloProprio} erro={erros.intervaloProprio} inputMode="decimal" />
        <Campo nome="intervaloMelhor" rotulo="Intervalo mínimo após o melhor lance (s)" valor={inicial.parametros.intervaloMelhor} erro={erros.intervaloMelhor} inputMode="decimal" />
        <Campo nome="diferencaPropria" rotulo={`Diferença mínima sobre o seu lance (${unidade})`} valor={inicial.parametros.diferencaPropria} erro={erros.diferencaPropria} inputMode="decimal" />
        <Campo nome="diferencaMelhor" rotulo={`Diferença mínima sobre o melhor lance (${unidade})`} valor={inicial.parametros.diferencaMelhor} erro={erros.diferencaMelhor} inputMode="decimal" />
        <p className="text-xs text-muted sm:col-span-2">
          Cada edital define estas regras. Os valores iniciais são só sugestões: confira no edital e ajuste para esta disputa.
          {erros.parametros && <span className="block text-danger">{erros.parametros}</span>}
        </p>
      </fieldset>

      {itens.map((item, i) => {
        const v = item.valores;
        const e = (campo: string) => erros[campoItem(i, campo)];
        const n = (campo: string) => campoItem(i, campo);
        const estrategia = estrategias[item.chave] ?? "cobrir";
        return (
          <fieldset key={item.chave} className="grid gap-3 rounded-lg border border-line bg-bg p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-ink">Item {i + 1}</legend>
            <div className="grid grid-cols-[6rem_1fr] gap-3 sm:col-span-2">
              <Campo nome={n("numero")} rotulo="Nº do item" valor={v.numero} erro={e("numero")} inputMode="numeric" />
              <Campo nome={n("descricao")} rotulo="Descrição" valor={v.descricao} erro={e("descricao")} maxLength={200} />
            </div>
            <Campo
              nome={n("referencia")}
              rotulo={desconto ? "Desconto inicial da sua proposta (%)" : "Sua proposta inicial (R$)"}
              valor={v.referencia}
              erro={e("referencia")}
              dica="Ponto de partida da simulação."
              inputMode="decimal"
            />
            <Campo
              nome={n("limite")}
              rotulo={desconto ? "Desconto máximo (%) — obrigatório" : "Valor mínimo, o piso (R$) — obrigatório"}
              valor={v.limite}
              erro={e("limite")}
              dica={desconto ? "O robô nunca oferece desconto acima deste." : "O robô nunca oferece valor abaixo deste."}
              inputMode="decimal"
              required
            />
            <div className="flex flex-col gap-1">
              <label htmlFor={n("estrategia")} className="text-sm font-medium text-ink">
                Estratégia
              </label>
              <select
                id={n("estrategia")}
                name={n("estrategia")}
                defaultValue={estrategia}
                onChange={(ev) => setEstrategias({ ...estrategias, [item.chave]: ev.target.value as Estrategia })}
                className={seletor}
              >
                {ESTRATEGIAS.filter((s) => s !== "lance_final" || modo === "aberto_fechado").map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_ESTRATEGIA[s]}
                  </option>
                ))}
              </select>
              {e("estrategia") && <p className="text-xs text-danger">{e("estrategia")}</p>}
            </div>
            {estrategia === "posicao_alvo" && (
              <Campo nome={n("posicaoAlvo")} rotulo="Posição alvo (1 = primeiro)" valor={v.posicaoAlvo || "2"} erro={e("posicaoAlvo")} inputMode="numeric" />
            )}
            {estrategia === "ultimos_segundos" && (
              <Campo nome={n("ultimosSegundos")} rotulo="Lançar só nos últimos (s)" valor={v.ultimosSegundos || "30"} erro={e("ultimosSegundos")} inputMode="numeric" />
            )}
            {estrategia === "lance_final" && (
              <Campo nome={n("lanceFinal")} rotulo={`Lance final único (${unidade})`} valor={v.lanceFinal} erro={e("lanceFinal")} inputMode="decimal" />
            )}
            {estrategia !== "lance_final" && estrategia !== "posicao_alvo" && estrategia !== "ultimos_segundos" && <div className="max-sm:hidden" />}
            <div className="flex flex-col gap-1">
              <label htmlFor={n("decrementoTipo")} className="text-sm font-medium text-ink">
                Passo de cada lance
              </label>
              <select id={n("decrementoTipo")} name={n("decrementoTipo")} defaultValue={v.decrementoTipo || "fixo"} className={seletor}>
                <option value="fixo">{desconto ? "Pontos percentuais fixos" : "Valor fixo (R$)"}</option>
                <option value="percentual">{desconto ? "Pontos percentuais" : "Percentual do melhor lance"}</option>
              </select>
            </div>
            <Campo nome={n("decremento")} rotulo="Tamanho do passo" valor={v.decremento} erro={e("decremento")} inputMode="decimal" dica="Ficar em 1º ignora o passo e usa a menor diferença aceita." />
            <Campo
              nome={n("descontoPorLance")}
              rotulo="Variação máxima por lance (%)"
              valor={v.descontoPorLance}
              erro={e("descontoPorLance")}
              dica="Opcional. Evita um lance muito abaixo do anterior."
              inputMode="decimal"
            />
            <Campo nome={n("lancesPorMinuto")} rotulo="Máximo de lances por minuto" valor={v.lancesPorMinuto || "6"} erro={e("lancesPorMinuto")} inputMode="numeric" />
            <Campo nome={n("errosSeguidos")} rotulo="Parar após quantos erros seguidos" valor={v.errosSeguidos || "3"} erro={e("errosSeguidos")} inputMode="numeric" />
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
              <input type="checkbox" name={n("meEpp")} defaultChecked={v.meEpp === "on"} className="size-4 accent-accent" />
              Empresa ME/EPP (só avisar empate ficto)
            </label>
            {itens.length > 1 && (
              <div className="sm:col-span-2">
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={Trash2}
                  onClick={() => {
                    setItens(itens.filter((x) => x.chave !== item.chave));
                    setRevisao(null);
                  }}
                >
                  Remover item
                </Botao>
              </div>
            )}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap gap-2">
        {itens.length < MAX_ITENS && (
          <Botao variante="secundario" icone={Plus} onClick={adicionar}>
            Adicionar item
          </Botao>
        )}
        {erros.itens && <p className="text-xs text-danger">{erros.itens}</p>}
      </div>

      {revisao ? (
        <section aria-labelledby="titulo-revisao" className="flex flex-col gap-3 rounded-lg border border-accent bg-accent-soft p-4">
          <h2 id="titulo-revisao" className="text-base font-semibold text-ink">
            Revise antes de salvar
          </h2>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {revisao.map((r, i) => (
              <li key={i}>
                <strong>Item {r.numero || "?"}</strong> {r.descricao && `· ${r.descricao} `}·{" "}
                {r.limite ? (
                  <>
                    {desconto ? "desconto máximo" : "piso"} <strong className="num">{desconto ? `${r.limite}%` : `R$ ${r.limite}`}</strong>
                  </>
                ) : (
                  <span className="font-semibold text-danger">sem {desconto ? "desconto máximo" : "piso"}: o robô não inicia</span>
                )}{" "}
                · {r.estrategia}
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name="confirmacao" value="sim" required className="mt-0.5 size-4 accent-accent" />
            Confirmo que revisei {desconto ? "os descontos máximos" : "os pisos"}, estratégias e limites de cada item.
          </label>
          {erros.confirmacao && <p className="text-xs text-danger">{erros.confirmacao}</p>}
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" icone={ShieldCheck} carregando={pendente}>
              Confirmar e salvar
            </Botao>
            <Botao variante="secundario" onClick={() => setRevisao(null)}>
              Voltar a editar
            </Botao>
          </div>
        </section>
      ) : (
        <div>
          <Botao onClick={revisar} icone={ShieldCheck}>
            Revisar e salvar
          </Botao>
          {erros.confirmacao && <p className="mt-1 text-xs text-danger">{erros.confirmacao}</p>}
        </div>
      )}
    </form>
  );
}
