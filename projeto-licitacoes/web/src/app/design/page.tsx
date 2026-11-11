import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bell, Building2, FilterX, Mail, Search, SearchX, Trash2 } from "lucide-react";
import { BotoesDemoAviso, ProvedorAvisos } from "@/components/ui/avisos";
import { Botao, CampoTexto, Esqueleto, EstadoVazio, Selo } from "@/components/ui/basicos";
import { BuscaComTermos, FiltroChip } from "@/components/ui/busca";
import { Checklist, QuadroFunil, type CartaoFunilDados } from "@/components/ui/funil";
import {
  CabecalhoLista,
  LinhaLicitacao,
  ListaPrazos,
  MedidorAderencia,
  Prazo,
  type EventoPrazo,
  type LicitacaoResumo,
} from "@/components/ui/licitacao";
import { Navegacao } from "@/components/ui/navegacao";

export const metadata: Metadata = { title: "Sistema de design" };

// Data fixa: a página é estática e o "encerra em N dias" não muda a cada visita.
const AGORA = new Date("2026-10-17T15:00:00-03:00");

// Dados fictícios, escritos para esta página.
const LICITACOES: LicitacaoResumo[] = [
  {
    id: "1",
    href: "/licitacao/00000000000100/2026/12",
    objeto: "Contratação de empresa para limpeza, conservação e higienização de prédios públicos, com fornecimento de materiais",
    orgao: "Prefeitura de Vila Exemplo",
    municipio: "Vila Exemplo",
    uf: "MS",
    modalidade: "Pregão eletrônico",
    valorCentavos: 48_250_000,
    encerramento: new Date("2026-10-19T09:00:00-03:00"),
    aderencia: 86,
    motivos: ['objeto contém "limpeza"', "UF atendida: MS", "modalidade preferida"],
  },
  {
    id: "2",
    href: "/licitacao/00000000000200/2026/7",
    objeto: "Registro de preços para aquisição de material de expediente e suprimentos de informática",
    orgao: "Secretaria Estadual de Exemplo",
    municipio: "Capital Fictícia",
    uf: "MT",
    modalidade: "Pregão eletrônico",
    valorCentavos: 9_870_550,
    encerramento: new Date("2026-10-17T17:30:00-03:00"),
    aderencia: 52,
    motivos: ['item contém "papel"'],
    etapaNoFunil: "Em análise",
  },
  {
    id: "3",
    href: "/licitacao/00000000000300/2026/3",
    objeto: "Prestação de serviços de vigilância patrimonial armada e desarmada",
    orgao: "Câmara Municipal de Exemplópolis",
    municipio: "Exemplópolis",
    uf: "GO",
    modalidade: "Concorrência eletrônica",
    valorCentavos: null,
    encerramento: new Date("2026-11-04T10:00:00-03:00"),
    aderencia: 18,
  },
  {
    id: "4",
    href: "/licitacao/00000000000400/2026/9",
    objeto: "Aquisição de gêneros alimentícios para a merenda escolar",
    orgao: "Fundo Municipal de Educação de Serra Modelo",
    municipio: "Serra Modelo",
    uf: "MS",
    modalidade: "Dispensa",
    valorCentavos: 1_520_000,
    encerramento: new Date("2026-10-16T12:00:00-03:00"),
    aderencia: null,
  },
];

const CARTOES: CartaoFunilDados[] = [
  {
    id: "a",
    objeto: "Limpeza e conservação de prédios públicos",
    orgaoUf: "Prefeitura de Vila Exemplo · MS",
    etapa: "interesse",
    prioridade: 1,
    tags: ["serviços"],
    responsavel: "Ana Souza",
    prazoISO: "2026-10-19T09:00:00-03:00",
  },
  {
    id: "b",
    objeto: "Material de expediente e suprimentos de informática",
    orgaoUf: "Secretaria Estadual de Exemplo · MT",
    etapa: "analise",
    prioridade: 2,
    tags: ["SRP"],
    responsavel: "Bruno Lima",
    prazoISO: "2026-10-17T17:30:00-03:00",
  },
  {
    id: "c",
    objeto: "Manutenção predial preventiva e corretiva",
    orgaoUf: "Instituto Fictício · MS",
    etapa: "proposta_enviada",
    prioridade: 2,
    tags: [],
    prazoISO: "2026-10-24T08:00:00-03:00",
  },
  {
    id: "d",
    objeto: "Jardinagem e roçada de áreas públicas",
    orgaoUf: "Prefeitura de Serra Modelo · MS",
    etapa: "ganhou",
    prioridade: 3,
    tags: ["serviços"],
    responsavel: "Ana Souza",
  },
];

const EVENTOS: EventoPrazo[] = [
  { id: "e1", titulo: "Material de expediente · Sec. Estadual de Exemplo", quando: new Date("2026-10-17T17:30:00-03:00"), tipo: "encerramento" },
  { id: "e2", titulo: "Conferir certidões da empresa", quando: new Date("2026-10-18T10:00:00-03:00"), tipo: "manual" },
  { id: "e3", titulo: "Limpeza predial · Pref. de Vila Exemplo", quando: new Date("2026-10-19T09:00:00-03:00"), tipo: "encerramento" },
  { id: "e4", titulo: "Manutenção predial · Instituto Fictício", quando: new Date("2026-10-24T08:00:00-03:00"), tipo: "abertura" },
];

const CORES: { nome: string; papel: string; classe: string }[] = [
  { nome: "bg", papel: "fundo da página", classe: "bg-bg border border-line" },
  { nome: "surface", papel: "áreas e hover", classe: "bg-surface" },
  { nome: "surface-2", papel: "colunas, esqueleto", classe: "bg-surface-2" },
  { nome: "line", papel: "divisórias", classe: "bg-line" },
  { nome: "line-strong", papel: "borda de campo", classe: "bg-line-strong" },
  { nome: "ink", papel: "texto", classe: "bg-ink" },
  { nome: "muted", papel: "texto secundário", classe: "bg-muted" },
  { nome: "accent", papel: "ação principal", classe: "bg-accent" },
  { nome: "accent-soft", papel: "seleção", classe: "bg-accent-soft" },
  { nome: "warning", papel: "prazo", classe: "bg-warning" },
  { nome: "warning-soft", papel: "fundo de prazo", classe: "bg-warning-soft" },
  { nome: "danger", papel: "erro, exclusão", classe: "bg-danger" },
  { nome: "success", papel: "ganho, aderência alta", classe: "bg-success" },
];

function Secao({ id, titulo, descricao, children }: { id: string; titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="border-b border-line pb-2">
        <h2 id={id} className="text-xl font-bold">
          {titulo}
        </h2>
        {descricao && <p className="mt-1 text-sm text-muted">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

export default function PaginaDesign() {
  return (
    <ProvedorAvisos>
      <div className="flex min-h-screen">
        <div className="sticky top-0 h-screen max-lg:hidden">
          <Navegacao atual="/buscar" />
        </div>
        <main className="mx-auto flex w-full max-w-conteudo min-w-0 flex-col gap-12 px-4 py-8 md:px-8">
          <header className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">Sistema de design</p>
            <h1 className="text-display font-bold">Componentes da busca e do funil</h1>
            <p className="max-w-2xl text-muted">
              Tokens próprios: verde-petróleo para ação, âmbar só para prazo, IBM Plex e cantos retos. Todos os pares de
              cor passam no contraste AA (relatório em replica/design/contrast-report.txt).
            </p>
          </header>

          <Secao id="cores" titulo="Cores" descricao="Papéis, não valores. A etapa de marca troca os valores sem mexer nos nomes.">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {CORES.map((c) => (
                <li key={c.nome} className="flex flex-col gap-1.5">
                  <span aria-hidden className={`h-12 rounded-md ${c.classe}`} />
                  <span className="font-mono text-xs font-medium">{c.nome}</span>
                  <span className="text-xs text-muted">{c.papel}</span>
                </li>
              ))}
            </ul>
          </Secao>

          <Secao id="tipografia" titulo="Tipografia" descricao="IBM Plex Sans para texto, Plex Mono para códigos; números tabulares em valores e prazos.">
            <div className="flex flex-col gap-2">
              <p className="text-display font-bold">Display 32 · Licitações abertas</p>
              <p className="text-xl font-bold">XL 24 · Pregão eletrônico nº 89/2026</p>
              <p className="text-lg font-semibold">LG 18 · Limpeza e conservação predial</p>
              <p className="text-base">Base 16 · Texto corrido da página de detalhe.</p>
              <p className="text-sm text-muted">SM 14 · Órgão, município e informações de apoio.</p>
              <p className="text-xs font-medium text-muted">XS 12 · Rótulos e selos</p>
              <p className="num font-mono text-sm">03155926000144-1-000089/2026 · R$ 1.482.500,00</p>
            </div>
          </Secao>

          <Secao id="botoes" titulo="Botões">
            <div className="flex flex-wrap items-center gap-3">
              <Botao>Acompanhar</Botao>
              <Botao variante="secundario">Salvar busca</Botao>
              <Botao variante="fantasma">Limpar filtros</Botao>
              <Botao variante="perigo" icone={Trash2}>
                Excluir busca
              </Botao>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Botao tamanho="sm">Pequeno</Botao>
              <Botao tamanho="md">Médio</Botao>
              <Botao tamanho="lg">Grande</Botao>
              <Botao carregando>Salvando</Botao>
              <Botao disabled>Desabilitado</Botao>
            </div>
          </Secao>

          <Secao id="campos" titulo="Campos">
            <div className="grid gap-4 md:grid-cols-2">
              <CampoTexto id="campo-email" rotulo="E-mail" type="email" placeholder="voce@suaempresa.com.br" icone={Mail} />
              <CampoTexto id="campo-cnpj" rotulo="CNPJ da empresa" dica="Só números, 14 dígitos." inputMode="numeric" />
              <CampoTexto id="campo-erro" rotulo="Nome da busca" defaultValue="" erro="Dê um nome para encontrar esta busca depois." />
              <CampoTexto id="campo-desab" rotulo="Órgão" defaultValue="Preenchido pelo PNCP" disabled icone={Building2} />
            </div>
          </Secao>

          <Secao id="busca" titulo="Busca e filtros" descricao="A busca entende a mesma sintaxe do banco: aspas, hífen para excluir e “or”.">
            <BuscaComTermos valorInicial='limpeza predial -vigilância "material de limpeza"' />
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-2 text-sm font-medium">Recortes e filtros</legend>
              <FiltroChip rotulo="Meu ramo" ativoInicial />
              <FiltroChip rotulo="Encerra em 7 dias" />
              <FiltroChip rotulo="UF" contador={3} ativoInicial />
              <FiltroChip rotulo="Modalidade" />
              <FiltroChip rotulo="Valor estimado" />
            </fieldset>
          </Secao>

          <Secao
            id="lista"
            titulo="Lista de licitações"
            descricao="Tabela no computador, cartões abaixo de 768 px. Estados: normal, encerra hoje, no funil, sem valor, encerrada, sem ramo."
          >
            <div>
              <CabecalhoLista />
              <div className="flex flex-col gap-3 md:gap-0">
                {LICITACOES.map((l) => (
                  <LinhaLicitacao key={l.id} l={l} agora={AGORA} />
                ))}
              </div>
            </div>
            <div aria-busy="true" aria-label="Carregando licitações" className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Carregando</p>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <Esqueleto className="h-4 w-4/5" />
                    <Esqueleto className="h-3 w-2/5" />
                  </div>
                  <Esqueleto className="h-4 w-24 max-md:hidden" />
                  <Esqueleto className="h-4 w-28 max-md:hidden" />
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <EstadoVazio
                icone={SearchX}
                titulo="Nada encontrado com esses filtros"
                texto="Tente tirar um filtro ou usar um termo mais geral, como “limpeza” em vez de “limpeza hospitalar”."
                acao={
                  <Botao variante="secundario" icone={FilterX}>
                    Limpar filtros
                  </Botao>
                }
              />
              <EstadoVazio
                icone={Bell}
                titulo="Nenhuma busca salva ainda"
                texto="Salve uma busca para receber por e-mail só as licitações novas que combinam com ela."
                acao={<Botao icone={Search}>Fazer uma busca</Botao>}
              />
            </div>
          </Secao>

          <Secao id="aderencia" titulo="Aderência e prazos" descricao="A aderência nunca depende só da cor: tem rótulo, valor para leitor de tela e motivos.">
            <div className="flex flex-wrap items-center gap-6">
              {[92, 64, 35, 8].map((p) => (
                <span key={p} className="flex items-center gap-2 text-xs text-muted">
                  <span className="num w-6">{p}</span>
                  <MedidorAderencia pontuacao={p} motivos={["exemplo"]} />
                </span>
              ))}
              <MedidorAderencia pontuacao={null} />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Prazo quando={new Date("2026-11-20T10:00:00-03:00")} agora={AGORA} />
              <Prazo quando={new Date("2026-10-19T09:00:00-03:00")} agora={AGORA} />
              <Prazo quando={new Date("2026-10-18T09:00:00-03:00")} agora={AGORA} />
              <Prazo quando={new Date("2026-10-17T17:30:00-03:00")} agora={AGORA} />
              <Prazo quando={new Date("2026-10-16T12:00:00-03:00")} agora={AGORA} />
              <Prazo quando={null} agora={AGORA} />
            </div>
          </Secao>

          <Secao id="selos" titulo="Selos">
            <div className="flex flex-wrap gap-2">
              <Selo>Pregão eletrônico</Selo>
              <Selo tom="accent">No funil · Em análise</Selo>
              <Selo tom="sucesso">Ganhou</Selo>
              <Selo tom="aviso">Prioridade alta</Selo>
              <Selo tom="perigo">Suspensa no PNCP</Selo>
            </div>
          </Secao>

          <Secao
            id="funil"
            titulo="Funil"
            descricao="Mova pelo seletor “Mover para” ou com o foco no cartão e as setas ← →. A mudança é anunciada para leitores de tela."
          >
            <QuadroFunil cartoesIniciais={CARTOES} agoraISO={AGORA.toISOString()} />
          </Secao>

          <Secao id="prazos" titulo="Prazos (visão em lista)">
            <div className="max-w-2xl">
              <ListaPrazos eventos={EVENTOS} agora={AGORA} />
            </div>
          </Secao>

          <Secao id="checklist" titulo="Checklist do processo">
            <Checklist
              itensIniciais={[
                { id: "1", texto: "Ler o edital e os anexos", feito: true },
                { id: "2", texto: "Separar certidões de regularidade", feito: true },
                { id: "3", texto: "Montar planilha de custos", feito: false },
                { id: "4", texto: "Cadastrar proposta no sistema do órgão", feito: false },
              ]}
            />
          </Secao>

          <Secao id="avisos" titulo="Avisos">
            <BotoesDemoAviso />
          </Secao>
        </main>
      </div>
    </ProvedorAvisos>
  );
}
