// Porte da empresa e tipos de documento de habilitação. Módulo neutro: serve ao banco, às ações e às páginas.

export const PORTES = [
  { id: "mei", nome: "Microempreendedor individual (MEI)" },
  { id: "me", nome: "Microempresa (ME)" },
  { id: "epp", nome: "Empresa de pequeno porte (EPP)" },
  { id: "medio", nome: "Média empresa" },
  { id: "grande", nome: "Grande empresa" },
] as const;

export type PorteId = (typeof PORTES)[number]["id"];

export function ehPorte(valor: string): valor is PorteId {
  return PORTES.some((p) => p.id === valor);
}

/** MEI, ME e EPP têm o tratamento diferenciado da Lei Complementar 123/2006 nas licitações. */
export function temTratamentoDiferenciado(porte: string | null) {
  return porte === "mei" || porte === "me" || porte === "epp";
}

export const TIPOS_DOCUMENTO = [
  { id: "cnd_federal", nome: "Certidão negativa de débitos federais (Receita e PGFN)" },
  { id: "fgts", nome: "Certificado de Regularidade do FGTS (CRF)" },
  { id: "cndt", nome: "Certidão negativa de débitos trabalhistas (CNDT)" },
  { id: "cnd_estadual", nome: "Certidão negativa estadual" },
  { id: "cnd_municipal", nome: "Certidão negativa municipal" },
  { id: "falencia", nome: "Certidão negativa de falência e recuperação judicial" },
  { id: "balanco", nome: "Balanço patrimonial" },
  { id: "contrato_social", nome: "Contrato social ou estatuto" },
  { id: "atestado", nome: "Atestado de capacidade técnica" },
  { id: "registro_conselho", nome: "Registro em conselho profissional" },
  { id: "outro", nome: "Outro documento" },
] as const;

export type TipoDocumentoId = (typeof TIPOS_DOCUMENTO)[number]["id"];

export function ehTipoDocumento(valor: string): valor is TipoDocumentoId {
  return TIPOS_DOCUMENTO.some((t) => t.id === valor);
}

export function nomeDoTipo(id: string) {
  return TIPOS_DOCUMENTO.find((t) => t.id === id)?.nome ?? id;
}

/** Quantos dias antes do vencimento o documento passa a pedir atenção. */
export const DIAS_AVISO = 30;

export type StatusDocumento = "vencido" | "vencendo" | "valido" | "sem-validade";

const DIA_MS = 86_400_000;

/** validade e hoje no formato AAAA-MM-DD (dia civil em Brasília). dias < 0 = vencido há N dias. */
export function statusDoDocumento(validade: string | null, hoje: string): { status: StatusDocumento; dias: number | null } {
  if (!validade) return { status: "sem-validade", dias: null };
  const dias = Math.round((Date.parse(validade) - Date.parse(hoje)) / DIA_MS);
  return { status: dias < 0 ? "vencido" : dias <= DIAS_AVISO ? "vencendo" : "valido", dias };
}
