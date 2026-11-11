// Roda uma vez quando o servidor (next start ou next dev) sobe, antes de atender pedidos.
// Abre o banco já na partida: a trava de exclusão é tomada antes de qualquer outro programa,
// e um segundo servidor na mesma pasta de dados termina ali, sem tocar no banco.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { abrirNaPartida } = await import("@/lib/dados/db");
    await abrirNaPartida();
  }
}
