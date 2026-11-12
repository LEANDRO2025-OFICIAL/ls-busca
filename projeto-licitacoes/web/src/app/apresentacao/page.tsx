import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { Bell, Bot, Building2, CalendarDays, FileCheck2, Search, SquareKanban, Target } from "lucide-react";
import { AlternarTema } from "@/components/ui/tema";
import { Revelar } from "./revelar";
import "./apresentacao.css";

// Títulos em Playfair Display (pacote @fontsource já instalado, licença OFL). O texto corrido
// continua no IBM Plex do layout raiz.
const titulo = localFont({
  src: [
    { path: "../../../node_modules/@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../../node_modules/@fontsource/playfair-display/files/playfair-display-latin-500-italic.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-ap-titulo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { absolute: "LS Busca — licitações do PNCP para a sua empresa" },
  description:
    "Busca de licitações abertas no PNCP, recomendações pelo ramo da empresa, alertas, funil de acompanhamento, prazos com exportação .ics e documentos de habilitação.",
};

const ICONE = { width: 28, height: 28, strokeWidth: 1.25, "aria-hidden": true } as const;

export default function PaginaApresentacao() {
  return (
    <div className={`ap ${titulo.variable}`} data-apresentacao>
      <a href="#inicio" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-bg focus:px-3 focus:py-2">
        Ir para o conteúdo
      </a>
      <header className="trilho">
        <div className="wrap">
          <a href="#inicio" className="marca" aria-label="LS Busca — início da apresentação">
            <svg width="32" height="32" viewBox="0 0 34 34" fill="none" aria-hidden="true" style={{ color: "var(--color-accent)" }}>
              <rect x=".5" y=".5" width="33" height="33" rx="5.5" stroke="currentColor" />
              <circle cx="15" cy="15" r="6.5" style={{ stroke: "var(--color-ink)" }} strokeWidth="1.25" />
              <path d="m20 20 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12 15h6M15 12v6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            LS Busca
          </a>
          <nav className="painel" aria-label="Seções da página">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <a href="#equipe">Equipe</a>
            <a href="#seguranca">Segurança</a>
            <a href="#faq">Perguntas</a>
          </nav>
          <div className="lado">
            <AlternarTema />
            <Link href="/entrar" className="btn btn-s btn-sm">
              Entrar
            </Link>
            <Link href="/cadastrar" className="btn btn-p btn-sm so-largo">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main id="inicio">
        <section className="heroi">
          <span className="cifra mono" aria-hidden="true">
            R$
          </span>
          <div className="wrap heroi-grade">
            <div className="entra">
              <p className="sobrelinha">
                <span className="ponto" aria-hidden="true" />
                Licitações do PNCP · para fornecedores
              </p>
              <h1>
                As licitações que combinam com a sua empresa, <em>sem perder prazo</em>
              </h1>
              <p className="lead">
                O LS Busca lê as licitações abertas em todo o Brasil nos dados oficiais do PNCP, dá uma nota de aderência
                pelo ramo da sua empresa e acompanha cada uma no funil até o contrato, com prazos, calendário e
                documentos de habilitação no mesmo lugar.
              </p>
              <div className="acoes">
                <Link href="/cadastrar" className="btn btn-p">
                  Criar conta
                </Link>
                <Link href="/entrar" className="btn btn-s">
                  Entrar
                </Link>
              </div>
              <p className="aviso-curto">O robô de lance funciona só em modo simulação: não envia lances a portais reais.</p>
            </div>

            <figure className="ficha" aria-label="Exemplo ilustrativo da lista Para sua empresa">
              <header>
                <h2>Para sua empresa</h2>
                <span className="mono muted" style={{ fontSize: ".75rem" }}>
                  ramo: material de construção · MS
                </span>
              </header>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Licitação</th>
                    <th scope="col">Aderência</th>
                    <th scope="col">Valor estimado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      Aquisição de cimento e areia<small>Pregão eletrônico · MS</small>
                    </td>
                    <td>
                      <span className="selo alta">alta · 85</span>
                    </td>
                    <td className="mono">R$ 184.300,00</td>
                  </tr>
                  <tr>
                    <td>
                      Manutenção predial com material<small>Pregão eletrônico · MT</small>
                    </td>
                    <td>
                      <span className="selo media">média · 60</span>
                    </td>
                    <td className="mono">R$ 512.000,00</td>
                  </tr>
                  <tr>
                    <td>
                      Serviços de limpeza urbana<small>Concorrência · MS</small>
                    </td>
                    <td>
                      <span className="selo baixa">baixa · 20</span>
                    </td>
                    <td className="mono">R$ 1.240.000,00</td>
                  </tr>
                </tbody>
              </table>
              <footer>
                <span className="sobrelinha" style={{ color: "var(--color-muted)" }}>
                  Próximo prazo · proposta
                </span>
                <span className="mono" style={{ fontSize: "1.5rem" }}>
                  em 6 dias
                </span>
              </footer>
              <figcaption className="nota">
                Exemplo ilustrativo, com dados fictícios. A nota vem do ramo cadastrado: termos encontrados no objeto, UF e
                modalidade.
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="como-funciona">
          <div className="wrap">
            <div className="titulo revela">
              <div>
                <p className="sobrelinha">Como funciona</p>
                <h2>Cinco passos, do ramo ao prazo cumprido</h2>
              </div>
              <p className="muted">
                Os dados vêm da consulta pública do PNCP. A empresa diz o que vende e onde atende; o resto é acompanhar.
              </p>
            </div>
            <ol className="etapas">
              <li className="cartao revela">
                <h3>Cadastrar o ramo</h3>
                <p>Termos do que a empresa vende, termos a excluir, UFs atendidas, modalidades e porte.</p>
              </li>
              <li className="cartao revela">
                <h3>Ver as recomendações</h3>
                <p>“Para sua empresa” lista as licitações abertas com nota de 0 a 100 e o motivo de cada nota.</p>
              </li>
              <li className="cartao revela">
                <h3>Salvar alertas</h3>
                <p>Qualquer busca vira alerta. Licitação nova que casa com ele gera um aviso no sino.</p>
              </li>
              <li className="cartao revela">
                <h3>Acompanhar no funil</h3>
                <p>Seis fases, da descoberta ao contrato, em Kanban ou em Pipeline com o valor de cada fase.</p>
              </li>
              <li className="cartao revela">
                <h3>Cumprir os prazos</h3>
                <p>Calendário mensal ou semanal, exportação .ics e aviso de documento perto de vencer.</p>
              </li>
            </ol>
          </div>
        </section>

        <section id="recursos">
          <div className="wrap">
            <div className="titulo revela">
              <div>
                <p className="sobrelinha">Recursos</p>
                <h2>Feito para quem vende ao setor público</h2>
              </div>
              <p className="muted">Menos tempo garimpando edital, e o andamento de cada licitação visível para toda a equipe.</p>
            </div>
            <div className="recursos">
              <article className="cartao largo revela">
                <Search {...ICONE} />
                <h3>Busca nas licitações abertas do Brasil</h3>
                <p>
                  Termos, UF, município, modalidade e faixa de valor sobre as licitações em aberto do PNCP. Cada licitação
                  mostra órgão, objeto, valor estimado, encerramento e o link para o edital no portal.
                </p>
                <span className="tag">PNCP · dados abertos oficiais</span>
              </article>
              <article className="cartao revela">
                <Target {...ICONE} />
                <h3>Para sua empresa</h3>
                <p>Nota de aderência ao ramo, com os motivos: termos casados, UF e modalidade.</p>
                <span className="tag">alta · média · baixa</span>
              </article>
              <article className="cartao revela">
                <Bell {...ICONE} />
                <h3>Alertas e avisos</h3>
                <p>Buscas salvas que avisam no sino a cada licitação nova. Pausar, editar e ver o histórico.</p>
                <span className="tag">sino · webhook opcional</span>
              </article>
              <article className="cartao revela">
                <Building2 {...ICONE} />
                <h3>Grandes licitações</h3>
                <p>Mural interno das licitações a partir de R$ 10 milhões, com interesses que também geram aviso.</p>
                <span className="tag">valor mínimo configurável</span>
              </article>
              <article className="cartao revela">
                <SquareKanban {...ICONE} />
                <h3>Funil de acompanhamento</h3>
                <p>Arraste o cartão entre as fases no Kanban ou veja quantidade e valor por fase no Pipeline.</p>
                <span className="tag">Kanban · Pipeline</span>
              </article>
              <article className="cartao meio revela">
                <CalendarDays {...ICONE} />
                <h3>Prazos e calendário</h3>
                <p>
                  Fim do envio de propostas, sessão e recurso de cada licitação acompanhada, com legenda por tipo e
                  exportação em iCalendar para qualquer agenda.
                </p>
                <span className="tag">mensal · semanal · .ics</span>
              </article>
              <article className="cartao meio revela">
                <FileCheck2 {...ICONE} />
                <h3>Documentos de habilitação</h3>
                <p>
                  Certidões, balanço, contrato social e atestados com número e validade. O que vence em até 30 dias
                  aparece destacado.
                </p>
                <span className="tag">vencido · vencendo · válido</span>
              </article>
              <article className="cartao cheio robo revela">
                <div>
                  <div className="cabeca">
                    <Bot {...ICONE} />
                    <h3>Robô de lance</h3>
                    <span className="selo sim">modo simulação</span>
                  </div>
                  <p style={{ marginTop: ".75rem" }}>
                    Configure o robô de cada licitação do funil, item a item: proposta inicial, piso (ou desconto
                    máximo), estratégia, passo e limites. Depois rode uma disputa simulada contra concorrentes fictícios e
                    veja posição final, margem sobre o piso e a trilha de decisões com o motivo de cada lance.
                  </p>
                  <p className="alerta-sim">
                    <strong>Não envia lances a portais reais.</strong> Nada no LS Busca fala com sistema de compras: todas
                    as disputas são fictícias.
                  </p>
                </div>
                <ul>
                  <li>Sem piso o robô não inicia, e nenhuma decisão passa do piso.</li>
                  <li>Parada de emergência geral e por item, antes de qualquer outra regra.</li>
                  <li>Intervalos, diferença mínima e limite de lances por minuto configuráveis.</li>
                  <li>A mesma semente repete a mesma disputa, para comparar estratégias.</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="equipe">
          <div className="wrap">
            <div className="titulo revela">
              <div>
                <p className="sobrelinha">Equipe e papéis</p>
                <h2>Uma conta por empresa, dois papéis</h2>
              </div>
              <p className="muted">Todos da equipe veem a mesma busca, o mesmo funil e os mesmos prazos da empresa.</p>
            </div>
            <ol className="niveis revela">
              <li>
                <span className="mono muted">conta</span>
                <h3>Empresa</h3>
                <p>Nome, CNPJ, porte e ramo. Tudo o que a equipe faz fica guardado na conta da empresa.</p>
                <div className="barra">
                  <i style={{ width: "100%" }} />
                </div>
              </li>
              <li>
                <span className="mono muted">papel</span>
                <h3>Dono</h3>
                <p>Quem cria a conta. Muda os dados da empresa e adiciona ou remove pessoas da equipe.</p>
                <div className="barra">
                  <i style={{ width: "100%" }} />
                </div>
              </li>
              <li>
                <span className="mono muted">papel</span>
                <h3>Membro</h3>
                <p>Entra com a senha inicial dada pelo dono e usa busca, alertas, funil, prazos, documentos e robô.</p>
                <div className="barra">
                  <i style={{ width: "66%" }} />
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section id="seguranca">
          <div className="wrap seg">
            <div className="revela">
              <p className="sobrelinha">Segurança</p>
              <h2 className="h2">Dados separados por empresa</h2>
              <p className="muted" style={{ marginTop: "1rem" }}>
                Descrito de forma objetiva, como está implementado.
              </p>
            </div>
            <dl className="revela">
              <dt>Isolamento</dt>
              <dd>Cada leitura e escrita é filtrada pela empresa da sessão: uma empresa nunca vê o funil de outra.</dd>
              <dt>Senhas</dt>
              <dd>Mínimo de 10 caracteres, guardadas só como hash scrypt com sal próprio.</dd>
              <dt>Tentativas de entrada</dt>
              <dd>Depois de 5 senhas erradas para um e-mail, a entrada fica bloqueada por 15 minutos.</dd>
              <dt>Sessão</dt>
              <dd>Cookie inacessível ao JavaScript da página, válido por 30 dias e conferido no servidor a cada acesso.</dd>
              <dt>Robô sem acesso a portais</dt>
              <dd>O robô não tem conexão com sistema de compras. A trilha de decisões é só de acréscimo: o banco recusa alterar ou apagar linha.</dd>
              <dt>Banco e cópias</dt>
              <dd>Banco embutido com trava de um processo por vez e cópias automáticas, ou um Postgres da própria empresa.</dd>
            </dl>
          </div>
        </section>

        <section id="faq">
          <div className="wrap">
            <div className="titulo revela">
              <div>
                <p className="sobrelinha">Perguntas frequentes</p>
                <h2>Dúvidas comuns</h2>
              </div>
              <p className="muted">Não achou a sua? Depois de entrar, a página Ajuda explica cada tela.</p>
            </div>
            <div className="revela">
              <details>
                <summary>De onde vêm as licitações?</summary>
                <p>
                  Da consulta pública do PNCP, o Portal Nacional de Contratações Públicas. Enquanto o sistema está aberto,
                  uma rotina busca as licitações novas. O PNCP limita a taxa de consultas, então uma atualização completa
                  leva cerca de 35 minutos.
                </p>
              </details>
              <details>
                <summary>Como a nota de aderência é calculada?</summary>
                <p>
                  Pelo ramo cadastrado: termos do ramo encontrados na licitação, UF e modalidade. Um termo que você exclui
                  zera a nota. A nota vai de 0 a 100, vem com os motivos e é mostrada como alta, média ou baixa.
                </p>
              </details>
              <details>
                <summary>O robô de lance envia lances de verdade?</summary>
                <p>
                  Não. O robô funciona só em modo simulação: disputas fictícias, com concorrentes simulados e relógio
                  virtual, para testar piso, estratégia e limites. Nenhum lance é enviado a portal de compras.
                </p>
              </details>
              <details>
                <summary>Os alertas chegam por e-mail?</summary>
                <p>
                  Não há envio de e-mail. Os avisos aparecem no sino e na página de alertas. Se a instalação tiver um
                  webhook configurado, ele também recebe os avisos novos em JSON.
                </p>
              </details>
              <details>
                <summary>Consigo levar os prazos para a minha agenda?</summary>
                <p>Sim. O calendário exporta os prazos das licitações acompanhadas em .ics, que qualquer aplicativo de agenda importa.</p>
              </details>
              <details>
                <summary>Como outras pessoas da empresa entram?</summary>
                <p>
                  O dono adiciona cada pessoa em Configurações › Equipe, com nome, e-mail e senha inicial. O cadastro
                  público fica aberto só para a primeira conta, a menos que a instalação o libere.
                </p>
              </details>
            </div>
          </div>
        </section>

        <section id="acesso">
          <div className="wrap contato">
            <div className="revela">
              <p className="sobrelinha">Acesso</p>
              <h2 className="h2">Comece pelo ramo da sua empresa</h2>
              <p className="muted" style={{ marginTop: "1rem", maxWidth: "28rem" }}>
                Crie a conta, diga o que a empresa vende e onde atende, e as recomendações aparecem logo em seguida.
              </p>
            </div>
            <div className="ficha acesso revela">
              <ol>
                <li>
                  <span>
                    <strong>Criar a conta.</strong> Nome, e-mail, senha e o nome da empresa.
                  </span>
                </li>
                <li>
                  <span>
                    <strong>Cadastrar o ramo.</strong> Termos, exclusões, UFs e modalidades.
                  </span>
                </li>
                <li>
                  <span>
                    <strong>Acompanhar.</strong> Leve as licitações boas para o funil e salve os alertas.
                  </span>
                </li>
              </ol>
              <div className="acoes">
                <Link href="/cadastrar" className="btn btn-p">
                  Criar conta
                </Link>
                <Link href="/entrar" className="btn btn-s">
                  Entrar
                </Link>
              </div>
              <p className="nota-acesso">
                Se o cadastro estiver fechado, peça ao dono da conta da sua empresa para adicionar você na equipe.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site">
        <div className="wrap">
          <span>LS Busca — busca e acompanhamento de licitações a partir dos dados oficiais do PNCP</span>
          <nav aria-label="Acesso">
            <Link href="/entrar">Entrar</Link>
            <Link href="/cadastrar">Criar conta</Link>
          </nav>
        </div>
      </footer>
      <Revelar />
    </div>
  );
}
