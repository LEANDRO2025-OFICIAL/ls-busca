#!/usr/bin/env node
// Confere o contraste WCAG 2.x de todos os pares de tokens.json nos dois temas.
// Uso: node contrast.mjs [tokens.json] > contrast-report.txt   (sai com código 1 se algum par reprovar)
// Texto normal: 4,5:1 (AA) / 7:1 (AAA). Pares marcados "ui" (bordas de campo, foco, barras): 3:1.
import { readFileSync } from "node:fs";

const arquivo = process.argv[2] ?? new URL("./tokens.json", import.meta.url);
const tokens = JSON.parse(readFileSync(arquivo, "utf8"));

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

let reprovados = 0;
function tabela(titulo, cores) {
  console.log(`${titulo}\n`);
  let falhas = 0;
  for (const [frente, fundo, tipo] of tokens.pairs) {
    const razao = contraste(cores[frente], cores[fundo]);
    const ui = tipo === "ui";
    const nota = ui ? (razao >= 3 ? "PASS" : "FAIL") : razao >= 7 ? "AAA" : razao >= 4.5 ? "AA" : "FAIL";
    if (nota === "FAIL") falhas++;
    console.log(`  ${nota.padEnd(4)} ${razao.toFixed(2).padStart(6)}:1  ${frente.padEnd(24)} on ${fundo.padEnd(20)}${ui ? "ui" : ""}`);
  }
  console.log(`\n  ${tokens.pairs.length} pairs, ${falhas} failing AA\n`);
  reprovados += falhas;
}

tabela("TEMA CLARO (color)", tokens.color);
tabela('TEMA ESCURO (color-dark, [data-theme="dark"])', { ...tokens.color, ...tokens["color-dark"] });
process.exitCode = reprovados ? 1 : 0;
