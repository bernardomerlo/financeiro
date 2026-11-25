export function formatBRL(value: number, showSign = false): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value < 0) {
    return `- R$ ${formatted}`;
  }
  if (showSign && value > 0) {
    return `+ R$ ${formatted}`;
  }
  return `R$ ${formatted}`;
}

export function formatCompactBRL(value: number): string {
  if (value === 0) return "-";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-R$ ${formatted}` : `R$ ${formatted}`;
}

export function formatShortDate(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

export function formatFullDate(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const CATEGORIES = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Serviços",
  "Saúde",
  "Lazer",
  "Equipamentos & Eletro",
  "Salário",
  "Outros",
] as const;
