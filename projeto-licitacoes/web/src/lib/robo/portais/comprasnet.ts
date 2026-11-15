/**
 * Conector real para o ComprasNet / Compras.gov.br.
 *
 * Como usar:
 * 1. Instancie com as credenciais e a URL da sala de disputa.
 * 2. Chame `conectar()` uma vez para fazer login e navegar até a sala.
 * 3. Passe a instância para `executarRobo()` como `conector`.
 * 4. Ao terminar, chame `fechar()` para encerrar o browser.
 *
 * URL da sala: peça ao pregoeiro ou copie da ata do sistema — formato típico:
 *   https://www2.comprasnet.gov.br/seguro/acesso.asp?strTIPO_MATERIAL=...
 *   https://cnet.comprasnet.gov.br/ComprasNet/Publico/...
 *
 * Seletores marcados com (* ajustar *) precisam ser confirmados contra o portal real.
 * Abra a sala de disputa no Chrome, inspecione os elementos e atualize se necessário.
 */
import type { Browser, Page } from "playwright";
import type { ConectorDeDisputa, ResultadoEnvio } from "../conector";
import type { EstadoDisputa, Fase } from "../tipos";

type OpcionsComprasNet = {
  login: string;         // CNPJ sem máscara (14 dígitos)
  senha: string;
  urlDisputa: string;    // URL completa da sala de disputa
  criterio: "menor_preco" | "maior_desconto";
  /** Número do item (1-indexed) para disputas multi-item. Default: 1. */
  numeroItem?: number;
  /** Callback chamado a cada log interno do conector. */
  onLog?: (nivel: "info" | "aviso" | "erro", texto: string) => void;
};

// ----- seletores (ajustar se a versão do portal mudar) -----
const SEL = {
  // Página de login
  LOGIN_CNPJ: "input[name='txtCNPJ'], input[name='Login'], input[name='txtLogin'], #txtCNPJ, #Login",
  LOGIN_SENHA: "input[name='txtSenha'], input[name='Senha'], input[name='txtPassword'], #txtSenha",
  LOGIN_SUBMIT: "input[type='submit'], button[type='submit'], input[value='Acessar'], input[value='OK']",

  // Sala de disputa – situação/fase
  FASE: "#spanSituacao, .situacao-disputa, [id*='Situacao'], [id*='situacao'], [id*='Fase'], [id*='fase'], td.situacao",
  // Melhor lance atual
  MELHOR_LANCE: "#spanMelhorLance, [id*='MelhorLance'], [id*='melhorLance'], [id*='BestBid'], .melhor-lance",
  // Meu último lance
  MEU_LANCE: "#spanMeuLance, [id*='MeuLance'], [id*='meuLance'], [id*='MinhaOferta'], [id*='minhaOferta'], .meu-lance",
  // Minha posição/classificação
  MINHA_POSICAO: "#spanPosicao, [id*='Posicao'], [id*='posicao'], [id*='Classificacao'], [id*='classificacao'], .posicao",
  // Input para digitar o lance
  INPUT_LANCE: "input[name='vlrLance'], input[name='txtLance'], input[name='lance'], #txtLance, #vlrLance, input[id*='Lance'][type='text']",
  // Botão enviar lance
  BTN_LANCE: "input[type='submit'][value*='Lance'], input[type='submit'][value*='lance'], button:has-text('Enviar Lance'), input[value*='Enviar']",
  // Contador / tempo restante
  TEMPO: "[id*='Tempo'], [id*='tempo'], [id*='Timer'], .timer, .tempo-restante",
  // Concorrentes / ranking (linha da tabela de lances)
  RANKING: "table.ranking tbody tr, #tabelaLances tbody tr, .lista-lances tr, table[id*='rank'] tbody tr",
};

/** Mapeia o texto exibido no portal para a Fase interna do motor. */
function parseFase(texto: string): Fase {
  const t = texto.toLowerCase().trim();
  if (t.includes("encerr") || t.includes("disput") && t.includes("encerr")) return "encerrada";
  if (t.includes("suspens")) return "suspensa";
  if (t.includes("fechad") || t.includes("proposta")) return "fechada";
  if (t.includes("prorrog")) return "prorrogacao";
  return "aberta";
}

/** Converte texto de preço ("R$ 1.234,56" ou "12,34%") para centavos/centésimos. */
function parsePreco(texto: string, criterio: "menor_preco" | "maior_desconto"): number | null {
  const limpo = texto.replace(/[^\d,]/g, "").replace(",", ".");
  if (!limpo) return null;
  const val = parseFloat(limpo);
  if (isNaN(val)) return null;
  return criterio === "maior_desconto" ? Math.round(val * 100) : Math.round(val * 100);
}

export class ConectorComprasNet implements ConectorDeDisputa {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly opts: OpcionsComprasNet;
  private lancesEnviados = 0;
  private ultimoLanceMs: number | null = null;
  private inicioMs = Date.now();

  constructor(opts: OpcionsComprasNet) {
    this.opts = opts;
  }

  private log(nivel: "info" | "aviso" | "erro", texto: string) {
    this.opts.onLog?.(nivel, texto);
  }

  /** Abre o browser, faz login e navega para a sala de disputa. Chame antes de executarRobo(). */
  async conectar(): Promise<void> {
    const { chromium } = await import("playwright");
    this.log("info", "Abrindo navegador...");
    this.browser = await chromium.launch({
      executablePath: "/opt/pw-browsers/chromium",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const ctx = await this.browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    this.page = await ctx.newPage();

    this.log("info", "Fazendo login...");
    await this.fazerLogin();
    this.log("info", "Navegando para a sala de disputa...");
    await this.navegarParaDisputa();
    this.inicioMs = Date.now();
    this.log("info", "Conectado à sala de disputa.");
  }

  private async fazerLogin(): Promise<void> {
    const p = this.page!;
    // Extrai o domínio da URL de disputa para ir direto ao login do mesmo portal
    const url = new URL(this.opts.urlDisputa);
    const baseLogin = `${url.protocol}//${url.hostname}`;

    // Tenta login direto na mesma origem
    await p.goto(`${baseLogin}/seguro/loginPortal.asp`, { timeout: 30_000 });

    // Fallback: se a página de login não carregou, vai direto para a URL de disputa (sessão pode já existir)
    const temLogin = await p.locator(SEL.LOGIN_CNPJ).count();
    if (temLogin === 0) {
      this.log("aviso", "Página de login não encontrada. Tentando acessar a sala diretamente.");
      return;
    }

    await p.locator(SEL.LOGIN_CNPJ).first().fill(this.opts.login);
    await p.locator(SEL.LOGIN_SENHA).first().fill(this.opts.senha);
    await Promise.all([
      p.waitForNavigation({ timeout: 30_000 }),
      p.locator(SEL.LOGIN_SUBMIT).first().click(),
    ]);

    const temErroLogin = await p.locator("text=Usuário ou senha inválidos, text=Login inválido, text=Acesso negado").count();
    if (temErroLogin > 0) throw new Error("Login recusado pelo portal. Verifique CNPJ e senha.");
    this.log("info", "Login efetuado com sucesso.");
  }

  private async navegarParaDisputa(): Promise<void> {
    const p = this.page!;
    await p.goto(this.opts.urlDisputa, { timeout: 30_000, waitUntil: "domcontentloaded" });
    // Aguarda o carregamento da sala (fase deve aparecer)
    await p.waitForSelector(SEL.FASE, { timeout: 20_000 }).catch(() => {
      this.log("aviso", "Elemento de fase não encontrado — a sala pode estar em um iframe ou ter seletores diferentes.");
    });
  }

  /** Busca o contexto de execução correto (pode estar em iframe). */
  private async contexto(): Promise<Page> {
    const p = this.page!;
    // Tenta localizar um iframe que contenha o input de lance
    for (const frame of p.frames()) {
      const count = await frame.locator(SEL.INPUT_LANCE).count().catch(() => 0);
      if (count > 0) return frame as unknown as Page;
    }
    return p;
  }

  async observar(): Promise<EstadoDisputa> {
    const ctx = await this.contexto();
    const agora = Date.now();

    // --- fase ---
    const faseTexto = await ctx.locator(SEL.FASE).first().textContent().catch(() => "aberta");
    const fase = parseFase(faseTexto ?? "aberta");

    // --- tempo restante ---
    const tempoTexto = await ctx.locator(SEL.TEMPO).first().textContent().catch(() => "");
    const encerraEmMs = (() => {
      const partes = (tempoTexto ?? "").match(/(\d+):(\d+)(?::(\d+))?/);
      if (!partes) return null;
      const h = partes[3] ? Number(partes[1]) : 0;
      const m = partes[3] ? Number(partes[2]) : Number(partes[1]);
      const s = partes[3] ? Number(partes[3]) : Number(partes[2]);
      const restanteMs = (h * 3600 + m * 60 + s) * 1000;
      return agora + restanteMs;
    })();

    // --- melhor lance ---
    const melhorTexto = await ctx.locator(SEL.MELHOR_LANCE).first().textContent().catch(() => "");
    const melhorLance = parsePreco(melhorTexto ?? "", this.opts.criterio) ?? 0;

    // --- meu último lance ---
    const meuTexto = await ctx.locator(SEL.MEU_LANCE).first().textContent().catch(() => "");
    const meuUltimoLance = parsePreco(meuTexto ?? "", this.opts.criterio) ?? melhorLance;

    // --- minha posição ---
    const posTexto = await ctx.locator(SEL.MINHA_POSICAO).first().textContent().catch(() => "1");
    const minhaPosicao = parseInt(posTexto ?? "1") || 1;

    // --- lances dos concorrentes ---
    const linhas = await ctx.locator(SEL.RANKING).all().catch(() => []);
    const lancesConcorrentes: number[] = [];
    for (const linha of linhas.slice(0, 10)) {
      const cells = await linha.locator("td").all().catch(() => []);
      for (const cell of cells) {
        const t = await cell.textContent().catch(() => "");
        const v = parsePreco(t ?? "", this.opts.criterio);
        if (v && v > 0) {
          lancesConcorrentes.push(v);
          break;
        }
      }
    }

    return {
      agoraMs: agora,
      fase,
      encerraEmMs,
      melhorLance: melhorLance || meuUltimoLance,
      instanteMelhorLanceMs: agora - 5_000, // estimativa conservadora
      meuUltimoLance,
      instanteMeuUltimoLanceMs: this.ultimoLanceMs,
      minhaPosicao,
      lancesConcorrentes,
    };
  }

  async enviarLance(valor: number): Promise<ResultadoEnvio> {
    const ctx = await this.contexto();
    const agora = Date.now();

    // Converte para o formato do portal
    const textoLance = this.opts.criterio === "maior_desconto"
      ? (valor / 100).toFixed(2).replace(".", ",")          // "12,34" (percentual)
      : (valor / 100).toFixed(2).replace(".", ",");          // "1234,56" (R$)

    this.log("info", `Enviando lance: ${textoLance}`);

    const inputLance = ctx.locator(SEL.INPUT_LANCE).first();
    const count = await inputLance.count().catch(() => 0);
    if (count === 0) {
      return { aceito: false, motivo: "Campo de lance não encontrado na página. Verifique os seletores." };
    }

    try {
      await inputLance.fill("");
      await inputLance.type(textoLance, { delay: 50 });
      await ctx.locator(SEL.BTN_LANCE).first().click({ timeout: 10_000 });

      // Aguarda resposta do portal (1,5s)
      await this.page!.waitForTimeout(1500);

      // Verifica se o lance foi aceito (portal normalmente mostra alerta ou atualiza o valor)
      const alertaTexto = await ctx.locator("[class*='alerta'], [class*='erro'], [class*='error'], .alert").first().textContent().catch(() => "");
      if (alertaTexto && /recusad|inválid|erro|invalid/i.test(alertaTexto)) {
        return { aceito: false, motivo: alertaTexto.trim() };
      }

      this.lancesEnviados++;
      this.ultimoLanceMs = agora;
      return { aceito: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { aceito: false, motivo: `Erro ao enviar: ${msg}` };
    }
  }

  async fechar(): Promise<void> {
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.page = null;
  }
}
