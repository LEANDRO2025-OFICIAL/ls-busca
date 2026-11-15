// Calendário de prazos: tipos, grade de mês/semana e exportação .ics (lógica pura de src/lib/agenda.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agruparPorDia,
  diaDeBrasilia,
  diasDaSemana,
  gerarIcs,
  lerDia,
  semanasDoMes,
  somarDias,
  somarMeses,
  tipoDoPrazo,
} from "../src/lib/agenda.ts";

test("classifica o tipo do prazo", () => {
  assert.equal(tipoDoPrazo({ tipo: "encerramento", titulo: "Fim do envio de propostas" }), "proposta");
  assert.equal(tipoDoPrazo({ tipo: "manual", titulo: "Sessão pública" }), "sessao");
  assert.equal(tipoDoPrazo({ tipo: "manual", titulo: "Fase de lances" }), "sessao");
  assert.equal(tipoDoPrazo({ tipo: "manual", titulo: "Prazo de RECURSO" }), "recurso");
  assert.equal(tipoDoPrazo({ tipo: "manual", titulo: "Impugnação do edital" }), "recurso");
  assert.equal(tipoDoPrazo({ tipo: "manual", titulo: "Revisar proposta" }), "proposta");
  assert.equal(tipoDoPrazo({ tipo: "manual", titulo: "Enviar amostra" }), "outros");
});

test("dia de Brasília: 02h UTC ainda é o dia anterior", () => {
  assert.equal(diaDeBrasilia(new Date("2026-11-11T02:30:00Z")), "2026-11-10");
  assert.equal(diaDeBrasilia(new Date("2026-11-11T03:00:00Z")), "2026-11-11");
  const grupos = agruparPorDia([{ quando: new Date("2026-11-11T02:30:00Z") }, { quando: new Date("2026-11-10T15:00:00Z") }]);
  assert.deepEqual([...grupos.keys()], ["2026-11-10"]);
  assert.equal(grupos.get("2026-11-10").length, 2);
});

test("lê e soma datas", () => {
  assert.equal(lerDia("2026-02-28"), "2026-02-28");
  assert.equal(lerDia("2026-02-30"), null);
  assert.equal(lerDia("ontem"), null);
  assert.equal(lerDia(undefined), null);
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(somarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(somarMeses("2026-01-15", -1), "2025-12-15");
});

test("semana de domingo a sábado e grade do mês", () => {
  // 11/11/2026 é uma quarta-feira.
  assert.deepEqual(diasDaSemana("2026-11-11"), [
    "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14",
  ]);
  const semanas = semanasDoMes("2026-11-11");
  assert.equal(semanas.length, 5);
  assert.equal(semanas[0][0], "2026-11-01");
  assert.equal(semanas[4][6], "2026-12-05");
  // Fevereiro de 2026 começa no domingo e tem 28 dias: exatamente 4 semanas.
  assert.equal(semanasDoMes("2026-02-10").length, 4);
  // Agosto de 2026 começa no sábado: 6 semanas.
  assert.equal(semanasDoMes("2026-08-01").length, 6);
  for (const s of semanas) assert.equal(s.length, 7);
});

test(".ics: estrutura, horários em UTC, escape e quebra de linha", () => {
  const ics = gerarIcs(
    [
      {
        id: "enc-1",
        titulo: "Fim do envio de propostas",
        quando: new Date("2026-11-20T17:00:00Z"),
        tipo: "proposta",
        descricao: "Aquisição de cimento, areia; brita\nPrefeitura de Dourados " + "x".repeat(80),
        url: "https://exemplo.test/licitacao/1/2026/1",
      },
      { id: "pra-2", titulo: "Recurso", quando: new Date("2026-11-22T12:30:00Z"), tipo: "recurso" },
    ],
    new Date("2026-11-11T10:00:00Z"),
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
  assert.equal(ics.match(/END:VEVENT/g).length, 2);
  assert.ok(!/[^\r]\n/.test(ics), "toda quebra de linha é CRLF");
  assert.ok(ics.includes("UID:enc-1@ls-busca\r\n"));
  assert.ok(ics.includes("DTSTAMP:20261111T100000Z\r\n"));
  assert.ok(ics.includes("DTSTART:20261120T170000Z\r\n"));
  assert.ok(ics.includes("SUMMARY:Proposta: Fim do envio de propostas\r\n"));
  assert.ok(ics.includes("CATEGORIES:Recurso\r\n"));
  assert.ok(ics.includes("URL:https://exemplo.test/licitacao/1/2026/1\r\n"));
  const linhas = ics.split("\r\n");
  for (const l of linhas) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  // Desdobrando, a descrição volta inteira e com escape.
  const desdobrado = ics.replace(/\r\n /g, "");
  assert.ok(desdobrado.includes("DESCRIPTION:Aquisição de cimento\\, areia\; brita\\nPrefeitura de Dourados " + "x".repeat(80)));
});

test(".ics vazio continua válido", () => {
  const ics = gerarIcs([], new Date("2026-11-11T10:00:00Z"));
  assert.ok(!ics.includes("VEVENT"));
  assert.ok(ics.includes("X-WR-CALNAME:Prazos de licitações"));
});
