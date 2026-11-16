import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileSignature } from "lucide-react";
import { BotaoImprimir } from "@/components/ui/botao-imprimir";

export const metadata: Metadata = { title: "Declarações" };
export const instant = false;

type EmpresaBrasilAPI = {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  porte?: string;
  natureza_juridica?: string;
  data_inicio_atividade?: string;
  qsa?: Array<{ nome_socio: string; qualificacao_socio?: string }>;
};

async function buscarEmpresa(cnpj: string): Promise<EmpresaBrasilAPI | null> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`, {
      next: { revalidate: 86_400 },
      headers: { "User-Agent": "lsbusca/1.0" },
    });
    if (!r.ok) return null;
    return r.json() as Promise<EmpresaBrasilAPI>;
  } catch {
    return null;
  }
}

function formatarCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function endereco(e: EmpresaBrasilAPI) {
  const partes = [e.logradouro, e.numero, e.complemento, e.bairro, e.municipio, e.uf].filter(Boolean);
  return partes.join(", ");
}

function dataHoje() {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date());
}

function representante(empresa: EmpresaBrasilAPI) {
  const socioAdmin = empresa.qsa?.find((s) =>
    s.qualificacao_socio?.toLowerCase().includes("administrador") ||
    s.qualificacao_socio?.toLowerCase().includes("sócio-administrador")
  ) ?? empresa.qsa?.[0];
  return socioAdmin?.nome_socio ?? "_________________________________";
}

export default async function PaginaDeclaracoes({ params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj } = await params;
  const empresa = await buscarEmpresa(cnpj);
  if (!empresa) redirect(`/declaracoes?erro=cnpj&cnpj=${encodeURIComponent(cnpj)}`);

  const cnpjFormatado = formatarCnpj(empresa.cnpj);
  const nomeEmpresa = empresa.razao_social;
  const end = endereco(empresa);
  const local = [empresa.municipio, empresa.uf].filter(Boolean).join(" - ");
  const rep = representante(empresa);
  const hoje = dataHoje();
  const eMe = empresa.porte?.toLowerCase().includes("micro") || empresa.porte?.toLowerCase().includes("epp");

  const declaracoes: Array<{ titulo: string; corpo: string }> = [
    {
      titulo: "1. Declaração de Habilitação e Conformidade (Lei nº 14.133/2021)",
      corpo: `${nomeEmpresa}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${cnpjFormatado}, com sede ${end ? `na ${end}` : "nos endereços constantes no Contrato Social"}, por seu representante legal abaixo assinado, DECLARA, para fins de habilitação no presente processo licitatório, que:

a) atende a todos os requisitos de habilitação estabelecidos no edital;
b) suas informações constantes no sistema de cadastro estão corretas, completas e atualizadas;
c) não está impedida de licitar ou contratar com o Poder Público;
d) não foi declarada inidônea para licitar ou contratar com órgãos públicos;
e) está ciente das penalidades previstas nos arts. 155 a 163 da Lei nº 14.133/2021 para o caso de declaração falsa.`,
    },
    {
      titulo: "2. Declaração de Não Emprego de Menores (Art. 7º, CF/88 — Lei nº 9.854/1999)",
      corpo: `${nomeEmpresa}, CNPJ nº ${cnpjFormatado}, por seu representante legal, nos termos do inciso V do art. 68 da Lei nº 14.133/2021, DECLARA que:

a) não possui em seu quadro funcional menores de 18 (dezoito) anos em trabalho noturno, perigoso ou insalubre;
b) não possui em seu quadro funcional menores de 16 (dezesseis) anos para qualquer trabalho, salvo na condição de aprendiz, nos termos do art. 7º, inciso XXXIII, da Constituição Federal.`,
    },
    {
      titulo: "3. Declaração de Elaboração Independente de Proposta",
      corpo: `${nomeEmpresa}, CNPJ nº ${cnpjFormatado}, DECLARA, para os fins do art. 9º, §1º, da Lei nº 14.133/2021, que a proposta foi elaborada de maneira independente, e que não recebeu nem deu informações sobre sua proposta, não tentou induzir nenhuma outra empresa a apresentar proposta com intenção de limitar ou impedir a competição, que o conteúdo da proposta não foi comunicado a qualquer interessado antes da abertura oficial das propostas e que não fixou honorários com outro licitante visando manipular o resultado da licitação.`,
    },
    {
      titulo: "4. Declaração de Fatos Supervenientes Impeditivos de Habilitação",
      corpo: `${nomeEmpresa}, CNPJ nº ${cnpjFormatado}, DECLARA, sob as penas da lei e para fins do presente processo licitatório, que inexistem fatos supervenientes à emissão dos documentos exigidos no edital que sejam impeditivos à sua habilitação.

A empresa se obriga a comunicar imediatamente à Administração Pública quaisquer alterações que possam comprometer sua habilitação.`,
    },
    {
      titulo: "5. Declaração de Idoneidade (Lei nº 14.133/2021, Art. 155 e 158)",
      corpo: `${nomeEmpresa}, CNPJ nº ${cnpjFormatado}, DECLARA que não foi declarada inidônea para licitar ou contratar com quaisquer órgãos da Administração Pública Federal, Estadual, Distrital ou Municipal, nos termos dos arts. 155 a 163 da Lei nº 14.133/2021, e que não possui nenhuma das seguintes sanções administrativas vigentes:

a) impedimento de licitar e contratar;
b) declaração de inidoneidade para licitar ou contratar;
c) suspensão temporária de participação em licitação e impedimento de contratar.`,
    },
    {
      titulo: "6. Declaração de Inexistência de Conflito de Interesses",
      corpo: `${nomeEmpresa}, CNPJ nº ${cnpjFormatado}, DECLARA que não possui em seu quadro societário cônjuge, companheiro(a) ou parente em linha reta, colateral ou por afinidade até o terceiro grau de servidores da entidade licitante, e que não há qualquer vínculo que configure conflito de interesses com agentes públicos da entidade contratante, nos termos do art. 14, IV, da Lei nº 14.133/2021.`,
    },
    {
      titulo: "7. Declaração de Pleno Conhecimento do Edital",
      corpo: `${nomeEmpresa}, CNPJ nº ${cnpjFormatado}, DECLARA ter examinado o edital e seus anexos integralmente, estar de pleno acordo com as condições estabelecidas, e ter avaliado todos os custos necessários para o cumprimento do objeto licitado, não cabendo qualquer alegação posterior de desconhecimento.`,
    },
    {
      titulo: "8. Declaração de Responsabilidade Socioambiental",
      corpo: `${nomeEmpresa}, CNPJ nº ${cnpjFormatado}, DECLARA que cumpre integralmente a legislação ambiental vigente, não possui passivo ambiental relevante não equacionado, cumpre as normas de segurança do trabalho e medicina ocupacional, e está em dia com todas as obrigações fiscais e trabalhistas perante seus empregados.`,
    },
    ...(eMe ? [{
      titulo: "9. Declaração de Microempresa / Empresa de Pequeno Porte (Lei Complementar nº 123/2006)",
      corpo: `${nomeEmpresa}, CNPJ nº ${cnpjFormatado}, DECLARA, para fins do art. 44 da Lei Complementar nº 123/2006 e do Decreto nº 8.538/2015, que se enquadra na categoria de ${empresa.porte}, conforme definição legal, e que não está incursa em nenhuma das hipóteses de exclusão previstas no §4º do art. 3º da referida Lei Complementar, fazendo jus aos benefícios do tratamento diferenciado e favorecido.`,
    }] : []),
    {
      titulo: `${eMe ? "10" : "9"}. Declaração de Visita Técnica (ou Dispensa)`,
      corpo: `${nomeEmpresa}, CNPJ nº ${cnpjFormatado}, DECLARA que, para fins de participação no presente certame:

(  ) Realizou visita técnica ao local de execução do objeto licitado, tendo pleno conhecimento das condições e peculiaridades inerentes ao objeto.

(  ) Optou por não realizar a visita técnica, assumindo total responsabilidade por essa decisão e reconhecendo que não poderá alegar desconhecimento das condições para justificar eventual inexecução do contrato.`,
    },
  ];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; color: black; }
          main { max-width: 100%; padding: 0; margin: 0; }
          .decl-item { page-break-inside: avoid; border: 1px solid #ccc; padding: 1.5rem; margin-bottom: 1.5rem; }
        }
      `}</style>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Declarações — {nomeEmpresa}</h1>
            <p className="text-sm text-muted">CNPJ {cnpjFormatado} · {empresa.municipio && `${empresa.municipio}/${empresa.uf}`}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/declaracoes" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-ink hover:bg-surface-2">
              <FileSignature className="size-4" />
              Novo CNPJ
            </a>
            <BotaoImprimir />
          </div>
        </div>

        {/* Cabeçalho para impressão */}
        <div className="hidden rounded-lg border border-line bg-surface p-4 print:block">
          <h1 className="text-lg font-bold">{nomeEmpresa}</h1>
          <p className="text-sm text-gray-600">CNPJ: {cnpjFormatado}</p>
          {end && <p className="text-sm text-gray-600">{end}</p>}
          {empresa.porte && <p className="text-sm text-gray-600">Porte: {empresa.porte}</p>}
        </div>

        <div className="no-print rounded-lg border border-line bg-warning-soft px-4 py-3 text-sm text-warning">
          <strong>Atenção:</strong> Leia cada declaração antes de assinar. Adapte os campos em branco ({" "}
          <code>_________________</code>) conforme o edital. Declarações falsas configuram crime (art. 299 do Código Penal).
        </div>

        {declaracoes.map((d, i) => (
          <div key={i} className="decl-item flex flex-col gap-3 rounded-lg border border-line bg-bg p-5">
            <h2 className="font-semibold text-ink">{d.titulo}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{d.corpo}</p>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm text-muted">{local || "_________________"}, {hoje}.</p>
              <div className="mt-8 flex flex-col items-center gap-1">
                <div className="w-72 border-t border-ink"></div>
                <p className="text-sm text-ink">{rep}</p>
                <p className="text-xs text-muted">Representante Legal — {nomeEmpresa}</p>
                <p className="text-xs text-muted">CNPJ {cnpjFormatado}</p>
              </div>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
