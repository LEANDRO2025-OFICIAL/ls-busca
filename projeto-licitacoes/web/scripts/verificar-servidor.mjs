// Usado pelo "Abrir LS Busca.bat" ANTES de subir o servidor. Não abre nem cria nada no banco.
// Uso: node scripts/verificar-servidor.mjs [porta]
//
// Códigos de saída:
//    0  porta livre e banco livre: pode subir
//   10  o LS Busca já está respondendo nessa porta: basta abrir o navegador
//   11  a porta está ocupada por OUTRO programa
//   12  a porta está livre, mas o banco está em uso por outro processo (script, `next dev`...)
import { urlDoPostgres } from "../src/lib/dados/banco-script.mjs";
import { descreverDono, pastaDeDados, portaOcupada, situacaoDaTrava } from "../src/lib/dados/trava-banco.mjs";

const porta = Number.parseInt(process.argv[2] ?? "3000", 10);

async function texto(caminho) {
  try {
    const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, { signal: AbortSignal.timeout(8000) });
    return await resposta.text();
  } catch {
    return "";
  }
}

if (await portaOcupada(porta)) {
  // /api/saude identifica o programa; /entrar cobre versões montadas antes de essa rota existir.
  const ehLsBusca = (await texto("/api/saude")).includes('"ls-busca"') || (await texto("/entrar")).includes("LS Busca");
  if (ehLsBusca) {
    console.log(`O LS Busca já está aberto em http://localhost:${porta}. Não é preciso abrir de novo.`);
    process.exit(10);
  }
  console.log(`A porta ${porta} está ocupada por outro programa, que não é o LS Busca.`);
  console.log("Feche esse programa (ou reinicie o computador) e abra o LS Busca de novo.");
  process.exit(11);
}

if (!urlDoPostgres()) {
  const { estado, dono } = situacaoDaTrava(pastaDeDados());
  if (estado === "viva") {
    console.log(`O banco do LS Busca está em uso por outro processo (${descreverDono(dono)}).`);
    console.log("Feche esse programa antes de abrir o LS Busca: dois programas no mesmo banco o corrompem.");
    process.exit(12);
  }
}
process.exit(0);
