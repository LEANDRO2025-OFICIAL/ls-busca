// Cópia de segurança manual do banco embutido (.data/pglite), com o LS Busca FECHADO.
// Uso: node scripts/fazer-backup.mjs [motivo]      (ou: npm run backup)
// Recusa (código 2) se o banco estiver em uso. As cópias ficam em .data/backups.
import { prepararScript } from "../src/lib/dados/banco-script.mjs";
import { bancoExiste, configuracaoDeBackup, copiarPastaFechada, tamanhoEmBytes } from "../src/lib/dados/backup-banco.mjs";
import { encerrarProcesso } from "../src/lib/dados/trava-banco.mjs";

const { pasta } = await prepararScript({ rotulo: "fazer-backup" });
if (!bancoExiste(pasta)) {
  console.error(`Não há banco em ${pasta}. Nada a copiar.`);
  await encerrarProcesso(1);
}
console.log("Copiando o banco (pode levar alguns minutos)...");
const copia = await copiarPastaFechada(pasta, process.argv[2] ?? "manual", { retencao: configuracaoDeBackup().retencao });
console.log(`Cópia pronta: ${copia.caminho} (${Math.round(tamanhoEmBytes(copia.caminho) / 1_048_576)} MB)`);
if (copia.apagados.length) console.log(`Cópias antigas apagadas pela retenção: ${copia.apagados.join(", ")}`);
await encerrarProcesso(0);
