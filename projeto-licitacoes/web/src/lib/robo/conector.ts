// Fronteira entre o robô e a disputa. A ÚNICA implementação existente é o simulador
// (simulador.ts). Não há, neste projeto, conector que envie lances a portais reais.
import type { ConfigItem, Controle, EstadoDisputa, MemoriaRobo, ParametrosDisputa, RegistroDecisao } from "./tipos.ts";
import { decidir, memoriaInicial, montarRegistro, registrarErroDoConector, registrarPasso } from "./motor.ts";

export type ResultadoEnvio = { aceito: true } | { aceito: false; motivo: string };

export interface ConectorDeDisputa {
  /** Lê o estado atual da disputa. Lança erro se não conseguir. */
  observar(): Promise<EstadoDisputa>;
  /** Envia um lance (inteiro, na unidade do critério). Lança erro se a comunicação falhar. */
  enviarLance(valor: number): Promise<ResultadoEnvio>;
}

export type OpcoesDeExecucao = {
  conector: ConectorDeDisputa;
  config: ConfigItem;
  parametros: ParametrosDisputa;
  /** Lido a cada passo: é por aqui que a parada de emergência geral chega. */
  controle: () => Controle | Promise<Controle>;
  /** Espera entre um passo e outro. No simulador, avança o relógio virtual. */
  esperar: (ms: number) => Promise<void>;
  passoMs?: number;
  /** Trava de segurança contra laço sem fim. */
  maxPassos?: number;
};

export type ResultadoDaExecucao = {
  registros: RegistroDecisao[];
  memoria: MemoriaRobo;
  /** false = bateu em maxPassos sem o motor decidir parar. */
  parouPeloMotor: boolean;
};

/** Laço do robô: observar → decidir → (lançar) → registrar → esperar, até o motor decidir parar. */
export async function executarRobo(opcoes: OpcoesDeExecucao): Promise<ResultadoDaExecucao> {
  const { conector, config, parametros } = opcoes;
  const passoMs = opcoes.passoMs ?? 1000;
  const maxPassos = opcoes.maxPassos ?? 20_000;
  const registros: RegistroDecisao[] = [];
  let memoria = memoriaInicial();
  const mensagem = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro));

  for (let passo = 0; passo < maxPassos; passo++) {
    let estado: EstadoDisputa;
    try {
      estado = await conector.observar();
    } catch (erro) {
      const r = registrarErroDoConector(config, memoria, mensagem(erro));
      memoria = r.memoria;
      registros.push(r.registro);
      if (r.registro.acao === "parar") return { registros, memoria, parouPeloMotor: true };
      await opcoes.esperar(passoMs);
      continue;
    }
    const decisao = decidir(config, parametros, estado, memoria, await opcoes.controle());
    let envio: RegistroDecisao["envio"] = null;
    let complemento = "";
    if (decisao.acao === "lancar" && decisao.valor != null) {
      try {
        const resposta = await conector.enviarLance(decisao.valor);
        envio = resposta.aceito ? "aceito" : "recusado";
        if (!resposta.aceito) complemento = ` Recusado pela disputa: ${resposta.motivo}`;
      } catch (erro) {
        envio = "erro";
        complemento = ` Erro ao enviar: ${mensagem(erro)}`;
      }
    }
    memoria = registrarPasso(memoria, estado, decisao, envio);
    registros.push(montarRegistro(estado, { ...decisao, motivo: decisao.motivo + complemento }, envio));
    if (decisao.acao === "parar") return { registros, memoria, parouPeloMotor: true };
    await opcoes.esperar(passoMs);
  }
  return { registros, memoria, parouPeloMotor: false };
}
