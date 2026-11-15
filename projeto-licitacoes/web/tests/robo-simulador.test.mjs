// Robô de lance: simulador de disputa e integração motor + simulador (src/lib/robo/simulador.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { executarRobo } from "../src/lib/robo/conector.ts";
import { compactarTrilha, criarGerador, montarCenario, simularDisputa, SimuladorDeDisputa, validarCenario } from "../src/lib/robo/simulador.ts";
import { PARAMETROS_PADRAO } from "../src/lib/robo/tipos.ts";

const MIN = 60_000;
const LIVRE = () => ({ paradaGlobal: false });
const config = (c = {}) => ({
  criterio: "menor_preco",
  limite: 70_000_00,
  estrategia: "cobrir",
  decremento: { tipo: "fixo", valor: 100_00 },
  posicaoAlvo: null,
  ultimosSegundos: null,
  lanceFinal: null,
  descontoMaximoPorLance: null,
  maxLancesPorMinuto: 6,
  maxErrosSeguidos: 3,
  meEpp: false,
  parada: false,
  ...c,
});
const cenario = (c = {}) => ({
  ...montarCenario({
    semente: 7,
    criterio: "menor_preco",
    modo: "aberto",
    valorDePartida: 100_000_00,
    perfis: ["agressivo", "conservador", "desistente"],
    duracaoAbertaMs: 10 * MIN,
    parametros: PARAMETROS_PADRAO,
  }),
  ...c,
});
const lances = (s, proprio) => s.linhaDoTempo.filter((e) => e.tipo === "lance" && (proprio == null || e.proprio === proprio));

/** Confere, pela linha do tempo, que nenhum lance do robô furou piso, intervalos ou diferenças. */
function conferirRegras(s, cfg, cen) {
  const sinal = cfg.criterio === "maior_desconto" ? -1 : 1;
  const p = cen.parametros;
  assert.equal(s.resultado.recusas, 0, "o simulador recusou lance do robô");
  assert.equal(s.linhaDoTempo.filter((e) => e.tipo === "recusado").length, 0);
  let meuAnterior = { valor: cen.meuLanceInicial, instante: null };
  let melhor = { valor: [cen.meuLanceInicial, ...cen.concorrentes.map((k) => k.lanceInicial)].sort((a, b) => sinal * (a - b))[0], instante: 0 };
  for (const e of s.linhaDoTempo) {
    if (e.tipo !== "lance") continue;
    if (e.proprio) {
      assert.ok(sinal * e.valor >= sinal * cfg.limite, `lance abaixo do piso: ${e.valor}`);
      assert.ok(sinal * (meuAnterior.valor - e.valor) >= Math.max(p.diferencaPropria, 1), "diferença própria");
      if (meuAnterior.instante != null) assert.ok(e.instanteMs - meuAnterior.instante >= p.intervaloProprioMs, "intervalo próprio");
      if (sinal * e.valor < sinal * melhor.valor) {
        assert.ok(sinal * (melhor.valor - e.valor) >= Math.max(p.diferencaMelhor, 1), "diferença do melhor");
        assert.ok(e.instanteMs - melhor.instante >= p.intervaloMelhorMs, "intervalo do melhor");
      }
      meuAnterior = { valor: e.valor, instante: e.instanteMs };
    }
    if (sinal * e.valor < sinal * melhor.valor) melhor = { valor: e.valor, instante: e.instanteMs };
  }
  // Lances por minuto, em qualquer janela de 60 s.
  const meus = lances(s, true).map((e) => e.instanteMs);
  for (const t of meus) assert.ok(meus.filter((x) => x > t - MIN && x <= t).length <= cfg.maxLancesPorMinuto, "lances por minuto");
  // Toda decisão de lançar foi aceita e aparece na linha do tempo.
  const enviados = s.registros.filter((r) => r.acao === "lancar");
  assert.ok(enviados.every((r) => r.envio === "aceito"));
  assert.equal(enviados.length, s.resultado.meusLances);
}

test("gerador com semente é determinístico", () => {
  const a = criarGerador(42);
  const b = criarGerador(42);
  const c = criarGerador(43);
  const va = Array.from({ length: 5 }, a);
  assert.deepEqual(va, Array.from({ length: 5 }, b));
  assert.notDeepEqual(va, Array.from({ length: 5 }, c));
  assert.ok(va.every((v) => v >= 0 && v < 1));
});

test("mesma semente e mesmo cenário dão exatamente a mesma disputa", async () => {
  const a = await simularDisputa(config(), cenario(), LIVRE);
  const b = await simularDisputa(config(), cenario(), LIVRE);
  assert.deepEqual(a, b);
  const outra = await simularDisputa(config(), { ...cenario(), semente: 8 }, LIVRE);
  assert.notDeepEqual(a.linhaDoTempo, outra.linhaDoTempo);
});

test("disputa inteira roda em milissegundos e termina encerrada", async () => {
  const inicio = performance.now();
  const s = await simularDisputa(config(), cenario(), LIVRE);
  assert.ok(performance.now() - inicio < 2_000, "simulação lenta demais");
  assert.equal(s.resultado.fase, "encerrada");
  assert.equal(s.parouPeloMotor, true);
  assert.equal(s.registros.at(-1).acao, "parar");
  assert.ok(s.resultado.duracaoMs >= 10 * MIN);
  // Relógio da linha do tempo e da trilha nunca volta.
  for (const lista of [s.linhaDoTempo, s.registros]) {
    for (let i = 1; i < lista.length; i++) assert.ok(lista[i].instanteMs >= lista[i - 1].instanteMs);
  }
  assert.ok(lances(s, false).length > 3, "os concorrentes deveriam disputar");
  assert.ok(lances(s, true).length > 3, "o robô deveria disputar");
});

test("cobrir: o robô vence quando o piso dele é o mais baixo, sem furar nenhuma regra", async () => {
  const cfg = config({ limite: 60_000_00 });
  const cen = cenario();
  const s = await simularDisputa(cfg, cen, LIVRE);
  conferirRegras(s, cfg, cen);
  assert.equal(s.resultado.minhaPosicao, 1);
  assert.equal(s.resultado.meuValor, s.resultado.melhorValor);
  assert.ok(s.resultado.meuValor >= cfg.limite);
  // Todos os concorrentes pararam nos próprios pisos.
  for (const k of cen.concorrentes) {
    const final = s.resultado.classificacao.find((c) => c.nome === k.nome);
    assert.ok(final.valor >= k.pisoProprio, `${k.nome} passou do próprio piso`);
  }
});

test("piso alto: o robô para no piso, não vence e nunca lança abaixo", async () => {
  const cfg = config({ limite: 95_000_00 });
  const cen = cenario();
  const s = await simularDisputa(cfg, cen, LIVRE);
  conferirRegras(s, cfg, cen);
  const parada = s.registros.find((r) => r.acao === "parar");
  assert.equal(parada.regra, "piso_atingido");
  assert.ok(s.resultado.minhaPosicao > 1);
  assert.ok(s.resultado.meuValor >= 95_000_00);
  // Depois de parar, o robô não registra mais nada, mas a disputa segue até o fim.
  assert.equal(s.registros.at(-1), parada);
  assert.equal(s.resultado.fase, "encerrada");
  assert.ok(s.linhaDoTempo.at(-1).instanteMs > parada.instanteMs);
});

test("perfis: desistente abandona antes do piso alheio; agressivo dá passos maiores que o conservador", async () => {
  const cen = cenario();
  const s = await simularDisputa(config({ limite: 60_000_00 }), cen, LIVRE);
  const nome = (perfil) => cen.concorrentes.find((k) => k.perfil === perfil).nome;
  assert.ok(s.linhaDoTempo.some((e) => e.tipo === "desistencia" && e.autor === nome("desistente")));
  const desistente = s.resultado.classificacao.find((c) => c.nome === nome("desistente"));
  assert.equal(desistente.desistiu, true);
  assert.ok(desistente.valor > cen.concorrentes.find((k) => k.perfil === "desistente").pisoProprio, "o desistente não chega ao próprio piso");
  const contar = (perfil) => lances(s, false).filter((e) => e.autor === nome(perfil)).length;
  assert.ok(contar("agressivo") > 0 && contar("conservador") > 0);
});

test("ficar em 1º usa passos mínimos e também vence", async () => {
  const cfg = config({ estrategia: "primeiro", limite: 60_000_00, maxLancesPorMinuto: 3 });
  const cen = cenario();
  const s = await simularDisputa(cfg, cen, LIVRE);
  conferirRegras(s, cfg, cen);
  assert.equal(s.resultado.minhaPosicao, 1);
  assert.ok(s.registros.filter((r) => r.acao === "lancar").every((r) => r.regra === "primeiro"));
});

test("posição alvo 2º: termina em 2º e nunca assume a liderança", async () => {
  const cfg = config({ estrategia: "posicao_alvo", posicaoAlvo: 2, limite: 60_000_00 });
  const cen = cenario();
  const s = await simularDisputa(cfg, cen, LIVRE);
  conferirRegras(s, cfg, cen);
  assert.equal(s.resultado.minhaPosicao, 2);
  assert.ok(s.registros.every((r) => r.estado == null || r.estado.minhaPosicao !== 1 || r.estado.agoraMs === 0 || r.acao !== "lancar"));
  assert.ok(s.registros.filter((r) => r.acao === "lancar").length > 0);
});

test("últimos segundos: todo lance sai dentro da janela antes do fim previsto", async () => {
  const cfg = config({ estrategia: "ultimos_segundos", ultimosSegundos: 30, limite: 60_000_00 });
  const cen = cenario();
  const s = await simularDisputa(cfg, cen, LIVRE);
  conferirRegras(s, cfg, cen);
  const enviados = s.registros.filter((r) => r.acao === "lancar");
  assert.ok(enviados.length > 0);
  for (const r of enviados) assert.ok(r.estado.encerraEmMs - r.estado.agoraMs <= 30_000, "lance fora da janela");
  assert.ok(lances(s, true)[0].instanteMs >= 10 * MIN - 30_000);
  // Lance perto do fim no modo aberto leva à prorrogação.
  assert.ok(s.linhaDoTempo.some((e) => e.tipo === "fase" && /prorrogação/.test(e.texto)), "esperava prorrogação");
  assert.ok(s.resultado.duracaoMs > 10 * MIN);
  assert.equal(s.resultado.minhaPosicao, 1);
});

test("aberto-fechado: exatamente um lance final, na fase fechada, no valor configurado", async () => {
  const cfg = config({ estrategia: "lance_final", lanceFinal: 72_500_00 });
  const cen = cenario({ modo: "aberto_fechado" });
  const s = await simularDisputa(cfg, cen, LIVRE);
  const meus = s.linhaDoTempo.filter((e) => e.proprio);
  assert.equal(meus.length, 1);
  assert.deepEqual([meus[0].tipo, meus[0].valor, meus[0].fase], ["lance_final", 72_500_00, "fechada"]);
  assert.equal(s.resultado.meuValor, 72_500_00);
  assert.equal(s.resultado.recusas, 0);
  assert.equal(s.resultado.fase, "encerrada");
  assert.ok(s.linhaDoTempo.some((e) => e.tipo === "lance_final" && !e.proprio), "concorrentes também dão lance final");
  assert.equal(s.registros.at(-1).acao, "parar");
  // Estratégia de fase aberta não envia nada na fase fechada.
  const outro = await simularDisputa(config({ limite: 60_000_00 }), cen, LIVRE);
  assert.equal(outro.linhaDoTempo.filter((e) => e.proprio && e.fase === "fechada").length, 0);
  assert.equal(outro.resultado.recusas, 0);
});

test("maior desconto: o robô sobe o desconto sem passar do desconto máximo", async () => {
  const cfg = config({ criterio: "maior_desconto", limite: 2_000, decremento: { tipo: "fixo", valor: 25 } });
  const cen = cenario({
    ...montarCenario({ semente: 11, criterio: "maior_desconto", modo: "aberto", valorDePartida: 300, perfis: ["agressivo", "conservador"], duracaoAbertaMs: 10 * MIN, parametros: PARAMETROS_PADRAO }),
  });
  const s = await simularDisputa(cfg, cen, LIVRE);
  conferirRegras(s, cfg, cen);
  assert.ok(s.resultado.meuValor <= 2_000 && s.resultado.meuValor > 300);
  const ordem = s.resultado.classificacao.map((c) => c.valor);
  assert.deepEqual(ordem, [...ordem].sort((a, b) => b - a), "classificação do maior para o menor desconto");
});

test("parada de emergência no meio da disputa: o robô para na hora e não lança mais", async () => {
  const cen = cenario();
  const simulador = new SimuladorDeDisputa(cen);
  let parada = false;
  const execucao = await executarRobo({
    conector: simulador,
    config: config({ limite: 60_000_00 }),
    parametros: cen.parametros,
    controle: () => ({ paradaGlobal: parada }),
    esperar: async (ms) => {
      await simulador.avancar(ms);
      if (simulador.resultado().duracaoMs >= 3 * MIN) parada = true;
    },
  });
  const ultimo = execucao.registros.at(-1);
  assert.deepEqual([ultimo.acao, ultimo.regra, ultimo.instanteMs], ["parar", "parada_emergencia_global", 3 * MIN]);
  const antes = simulador.resultado().meusLances;
  assert.ok(antes > 0);
  await simulador.avancarAteOFim();
  assert.equal(simulador.resultado().meusLances, antes);
  // Com a parada já acionada antes de começar, nenhum lance sai.
  const s = await simularDisputa(config(), cen, () => ({ paradaGlobal: true }));
  assert.equal(s.registros.length, 1);
  assert.equal(s.registros[0].regra, "parada_emergencia_global");
  assert.equal(s.resultado.meusLances, 0);
  const item = await simularDisputa(config({ parada: true }), cen, LIVRE);
  assert.deepEqual([item.registros.length, item.registros[0].regra, item.resultado.meusLances], [1, "parada_emergencia_item", 0]);
});

test("sem piso, a simulação não dá nenhum lance", async () => {
  const s = await simularDisputa(config({ limite: null }), cenario(), LIVRE);
  assert.deepEqual([s.registros.length, s.registros[0].acao, s.registros[0].regra], [1, "parar", "configuracao_invalida"]);
  assert.equal(s.resultado.meusLances, 0);
});

test("suspensão sorteada: o robô para com o motivo certo", async () => {
  const cen = cenario({ chanceSuspensaoPorMinuto: 1 });
  const s = await simularDisputa(config(), cen, LIVRE);
  assert.equal(s.resultado.fase, "suspensa");
  assert.equal(s.resultado.duracaoMs, MIN);
  assert.equal(s.registros.at(-1).regra, "disputa_suspensa");
  // Disputa suspensa recusa lance.
  const simulador = new SimuladorDeDisputa(cen);
  await simulador.avancar(2 * MIN);
  assert.equal((await simulador.enviarLance(90_000_00)).aceito, false);
});

test("erros do conector: N seguidos param o robô; erros esparsos não", async () => {
  const sempre = await simularDisputa(config({ maxErrosSeguidos: 4 }), cenario({ chanceErroConector: 1 }), LIVRE);
  assert.equal(sempre.registros.length, 4);
  assert.deepEqual(sempre.registros.map((r) => r.regra), ["erro_do_conector", "erro_do_conector", "erro_do_conector", "erros_do_conector"]);
  assert.equal(sempre.registros.at(-1).acao, "parar");
  assert.equal(sempre.resultado.meusLances, 0);
  // 5% de falha: com limite de 4 seguidos, a disputa segue; nenhum lance fura as regras mesmo com reenvios.
  const cfg = config({ limite: 60_000_00, maxErrosSeguidos: 4 });
  const cen = cenario({ chanceErroConector: 0.05 });
  const esparso = await simularDisputa(cfg, cen, LIVRE);
  assert.ok(esparso.registros.some((r) => r.regra === "erro_do_conector"));
  assert.equal(esparso.registros.at(-1).regra, "disputa_encerrada");
  assert.equal(esparso.resultado.recusas, 0);
  for (const e of lances(esparso, true)) assert.ok(e.valor >= cfg.limite);
});

test("o simulador recusa lances fora das regras da disputa", async () => {
  const s = new SimuladorDeDisputa(cenario());
  const melhor = (await s.observar()).melhorLance;
  assert.equal((await s.enviarLance(melhor - 100_00.5)).aceito, false, "fracionado");
  assert.equal((await s.enviarLance(0)).aceito, false, "zero");
  assert.equal((await s.enviarLance(100_000_00)).aceito, false, "igual ao próprio");
  assert.equal((await s.enviarLance(melhor - 1)).aceito, false, "antes do intervalo do melhor (t = 0)");
  await s.avancar(3_000);
  const agora = await s.observar();
  assert.equal((await s.enviarLance(agora.melhorLance - 50_00)).aceito, true);
  assert.equal((await s.observar()).minhaPosicao, 1);
  await s.avancar(1_000);
  const r = await s.enviarLance(agora.melhorLance - 100_00);
  assert.deepEqual([r.aceito, /intervalo mínimo entre lances próprios/.test(r.motivo)], [false, true]);
  assert.equal(s.resultado().recusas, 5);
  assert.equal(s.resultado().meusLances, 1);
});

test("validação de cenário e compactação da trilha", async () => {
  assert.deepEqual(validarCenario(cenario()), []);
  assert.ok(validarCenario(cenario({ concorrentes: [] })).length > 0);
  assert.ok(validarCenario(cenario({ chanceErroConector: 2 })).length > 0);
  assert.ok(validarCenario(cenario({ concorrentes: [{ nome: "X", perfil: "agressivo", lanceInicial: 10, pisoProprio: 20 }] })).length > 0);
  assert.throws(() => new SimuladorDeDisputa(cenario({ duracaoAbertaMs: 0 })), /inválido/);
  const s = await simularDisputa(config(), cenario(), LIVRE);
  const compacta = compactarTrilha(s.registros);
  assert.ok(compacta.length < s.registros.length);
  assert.equal(compacta.reduce((n, r) => n + r.repeticoes, 0), s.registros.length);
  assert.equal(compacta.filter((r) => r.acao === "lancar").length, s.registros.filter((r) => r.acao === "lancar").length);
  for (let i = 1; i < compacta.length; i++) {
    assert.ok(!(compacta[i].acao === "aguardar" && compacta[i - 1].acao === "aguardar" && compacta[i].regra === compacta[i - 1].regra));
  }
});

test("propriedade: 300 disputas com cenários e estratégias sorteados nunca furam piso nem regras", async () => {
  const r = criarGerador(987654321);
  const int = (min, max) => min + Math.floor(r() * (max - min + 1));
  const um = (lista) => lista[int(0, lista.length - 1)];
  let comLance = 0;
  for (let i = 0; i < 300; i++) {
    const desconto = r() < 0.25;
    const partida = desconto ? int(0, 500) : int(500_00, 2_000_000_00);
    const parametros = {
      intervaloProprioMs: um([0, 5_000, 20_000]),
      intervaloMelhorMs: um([0, 3_000, 6_000]),
      diferencaPropria: desconto ? int(0, 5) : int(0, 20_00),
      diferencaMelhor: desconto ? int(0, 5) : int(0, 20_00),
    };
    const modo = r() < 0.2 ? "aberto_fechado" : "aberto";
    const cen = {
      ...montarCenario({
        semente: int(1, 1_000_000),
        criterio: desconto ? "maior_desconto" : "menor_preco",
        modo,
        valorDePartida: partida,
        perfis: Array.from({ length: int(1, 5) }, () => um(["agressivo", "conservador", "desistente"])),
        duracaoAbertaMs: int(2, 8) * MIN,
        parametros,
      }),
      chanceErroConector: r() < 0.2 ? 0.03 : 0,
      chanceSuspensaoPorMinuto: r() < 0.1 ? 0.1 : 0,
    };
    const limite = desconto ? Math.min(10_000, partida + int(1, 2_500)) : Math.max(1, Math.floor((partida * int(60, 99)) / 100));
    const estrategia = modo === "aberto_fechado" && r() < 0.6 ? "lance_final" : um(["cobrir", "primeiro", "posicao_alvo", "ultimos_segundos"]);
    const cfg = config({
      criterio: cen.criterio,
      limite,
      estrategia,
      decremento: r() < 0.5 ? { tipo: "fixo", valor: desconto ? int(1, 60) : int(1, 2_000_00) } : { tipo: "percentual", centesimos: int(1, 300) },
      posicaoAlvo: int(1, 3),
      ultimosSegundos: int(5, 90),
      lanceFinal: desconto ? int(partida, limite) : int(limite, partida),
      descontoMaximoPorLance: r() < 0.3 ? int(50, 1_000) : null,
      maxLancesPorMinuto: int(1, 6),
      maxErrosSeguidos: 5,
    });
    const s = await simularDisputa(cfg, cen, LIVRE);
    const contexto = JSON.stringify({ i, cfg, cen });
    const sinal = desconto ? -1 : 1;
    assert.ok(s.parouPeloMotor, contexto);
    assert.ok(["encerrada", "suspensa"].includes(s.resultado.fase), contexto);
    assert.equal(s.resultado.recusas, 0, `recusa: ${contexto}`);
    assert.ok(sinal * s.resultado.meuValor >= sinal * limite, `piso: ${contexto}`);
    for (const e of s.linhaDoTempo) {
      if (e.proprio && e.valor != null) assert.ok(sinal * e.valor >= sinal * limite, `piso: ${contexto}`);
    }
    const meus = lances(s, true);
    for (let j = 1; j < meus.length; j++) {
      assert.ok(meus[j].instanteMs - meus[j - 1].instanteMs >= parametros.intervaloProprioMs, `intervalo: ${contexto}`);
      assert.ok(sinal * (meus[j - 1].valor - meus[j].valor) >= Math.max(parametros.diferencaPropria, 1), `diferença: ${contexto}`);
    }
    for (const t of meus) assert.ok(meus.filter((x) => x.instanteMs > t.instanteMs - MIN && x.instanteMs <= t.instanteMs).length <= cfg.maxLancesPorMinuto, `por minuto: ${contexto}`);
    if (s.resultado.meusLances > 0) comLance++;
  }
  assert.ok(comLance > 150, `poucas disputas com lance do robô: ${comLance}`);
});
