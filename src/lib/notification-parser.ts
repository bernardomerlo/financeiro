const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Hex(ascii: string): string {
  const bytes = new TextEncoder().encode(ascii);
  const bitLen = bytes.length * 8;
  const totalBytes = (((bytes.length + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(totalBytes);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(totalBytes - 4, bitLen >>> 0, false);
  view.setUint32(totalBytes - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a,
    h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let i = 0; i < totalBytes; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 =
        ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^
        ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^
        (w[j - 15] >>> 3);
      const s1 =
        ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^
        ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^
        (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, "0"))
    .join("");
}

export type NotificationDetectedType = "outgoing" | "incoming" | "ignored";
export type NotificationPaymentMethod =
  | "debit"
  | "pix"
  | "credit_card"
  | "transfer"
  | "bill"
  | "unknown";

export interface RawNotificationInput {
  id?: string | number;
  notificationId?: string | number;
  notification_id?: string | number;
  key?: string;
  fingerprint?: string;

  appPackage?: string;
  app_package?: string;
  not_app_package?: string;
  package?: string;
  packageName?: string;

  appName?: string;
  app_name?: string;
  not_app_name?: string;
  app?: string;
  banco?: string;

  title?: string;
  not_title?: string;
  titulo?: string;
  header?: string;

  message?: string;
  notification?: string;
  text?: string;
  body?: string;
  not_text?: string;
  not_big_text?: string;
  big_text?: string;
  bigText?: string;
  not_sub_text?: string;
  sub_text?: string;
  subText?: string;
  not_ticker?: string;
  ticker?: string;
  summary?: string;
  content?: string;
  texto?: string;
  mensagem?: string;

  timestamp?: string | number;
  originalTimestamp?: string | number;
  original_timestamp?: string | number;
  not_timestamp?: string | number;
  time?: string | number;
  date?: string;
  postedAt?: string | number;
  data_hora?: string;
}

export interface NormalizedNotification {
  externalId: string | null;
  appPackage: string | null;
  appName: string | null;
  title: string | null;
  message: string;
  originalTimestamp: string;
  eventDate: string; // 'YYYY-MM-DD'
  hasExplicitTimestamp: boolean;
  fingerprint: string;
  detectedType: NotificationDetectedType;
  parsedAmount: number | null;
  parsedMerchant: string | null;
  parsedPaymentMethod: NotificationPaymentMethod;
  rawPayload: string;
}

const KNOWN_BANK_PACKAGES: Record<string, string> = {
  "com.nu.production": "Nubank",
  "com.itau": "Itaú",
  "com.itau.pers": "Itaú Personnalité",
  "com.itaucard.activity": "Itaú Cartões",
  "br.com.intermedium": "Banco Inter",
  "com.bradesco": "Bradesco",
  "com.c6bank.app": "C6 Bank",
  "br.com.bb.android": "Banco do Brasil",
  "com.santander.app": "Santander",
  "com.picpay": "PicPay",
  "com.mercadopago.wallet": "Mercado Pago",
  "br.com.xp.cartoes": "XP",
  "br.com.xp.investimentos": "XP",
  "com.btgpactual.banking": "BTG Pactual",
  "com.neon": "Neon",
  "com.next": "Next",
  "br.com.sicoob.moob": "Sicoob",
  "br.com.sicredi.app": "Sicredi",
  "com.caixa.tem": "Caixa",
  "br.com.gabba.Caixa": "Caixa",
  "com.google.android.apps.walletnfcrel": "Google Carteira",
};

const MACRODROID_UNEXPANDED_TOKEN_REGEX =
  /(\{(?:not_[a-z0-9_]+|notification|hour(?:_00|12)?|minute(?:_00)?|second(?:_00)?|year|month(?:_digit)?|dayofmonth|system_time|am_pm)\}|\[(?:not_[a-z0-9_]+|notification|hour(?:_00|12)?|minute(?:_00)?|second(?:_00)?|year|month(?:_digit)?|dayofmonth|system_time|am_pm)\])/gi;

/**
 * Removes unexpanded MacroDroid Magic Text tokens such as "{not_text}", "[not_text]",
 * "{hour_00}:{minute_00}:{second_00}", "{notification}", etc.
 */
export function cleanMacroDroidPlaceholders(value: unknown): string | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return String(value);
  }
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value
    .replace(MACRODROID_UNEXPANDED_TOKEN_REGEX, "")
    .replace(/\s+:\s*:/g, "")
    .replace(/^[\s:-]+|[\s:-]+$/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function firstNonEmptyString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    const cleaned = cleanMacroDroidPlaceholders(c);
    if (cleaned && cleaned.length > 0) {
      return cleaned;
    }
  }
  return null;
}

function pickBestNotificationMessage(...candidates: unknown[]): string | null {
  const validStrings: string[] = [];
  for (const c of candidates) {
    const cleaned = cleanMacroDroidPlaceholders(c);
    if (cleaned && cleaned.length > 0) {
      validStrings.push(cleaned);
    }
  }
  if (validStrings.length === 0) return null;

  // Prefer the candidate that contains a currency value (e.g. R$ 50,42 or 50,42)
  const withAmount = validStrings.find((s) => extractBrlAmount(s) !== null);
  if (withAmount) return withAmount;

  return validStrings[0];
}

/**
 * Formats a Date object to YYYY-MM-DD in America/Sao_Paulo timezone.
 */
function formatDateInBrazilTz(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to UTC-3 manual offset
  }
  const brTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return brTime.toISOString().slice(0, 10);
}

/**
 * Resolves flexible timestamp inputs (epoch ms, epoch s, ISO string, DD/MM/YYYY HH:mm:ss)
 * into a canonical ISO timestamp and a YYYY-MM-DD eventDate.
 */
export function resolveTimestampAndDate(
  rawInput: string | number | null | undefined,
  fallbackNow = new Date()
): {
  originalTimestamp: string;
  eventDate: string;
  hasExplicitTimestamp: boolean;
} {
  const cleanedInput = cleanMacroDroidPlaceholders(rawInput);
  if (!cleanedInput) {
    return {
      originalTimestamp: fallbackNow.toISOString(),
      eventDate: formatDateInBrazilTz(fallbackNow),
      hasExplicitTimestamp: false,
    };
  }

  const rawStr = cleanedInput.trim();
  const hadUnexpandedTokens =
    typeof rawInput === "string" &&
    MACRODROID_UNEXPANDED_TOKEN_REGEX.test(rawInput);
  MACRODROID_UNEXPANDED_TOKEN_REGEX.lastIndex = 0;

  // 1. Pure numeric epoch (seconds or milliseconds)
  if (/^\d{10,16}$/.test(rawStr)) {
    const num = Number(rawStr);
    const ms = rawStr.length <= 10 ? num * 1000 : num;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      const canonical = new Date(Math.floor(d.getTime() / 1000) * 1000);
      return {
        originalTimestamp: canonical.toISOString(),
        eventDate: formatDateInBrazilTz(canonical),
        hasExplicitTimestamp: true,
      };
    }
  }

  // 2. Explicit YYYY-M(M)-D(D) only (including when time tokens were unexpanded placeholders)
  const ymdOnlyMatch = rawStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdOnlyMatch) {
    const [, y, m, d] = ymdOnlyMatch;
    const isoDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (hadUnexpandedTokens) {
      return {
        originalTimestamp: fallbackNow.toISOString(),
        eventDate: isoDate,
        hasExplicitTimestamp: false,
      };
    }
    return {
      originalTimestamp: `${isoDate}T12:00:00.000-03:00`,
      eventDate: isoDate,
      hasExplicitTimestamp: true,
    };
  }

  // 3. Brazilian date format: D(D)/M(M)/YYYY or D(D)/M(M)/YYYY H(H):m(m)(:s(s))
  const brMatch = rawStr.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (brMatch) {
    const [, day, month, year, hh, mm, ss] = brMatch;
    const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (!hh || hadUnexpandedTokens) {
      return {
        originalTimestamp: hadUnexpandedTokens
          ? fallbackNow.toISOString()
          : `${isoDate}T12:00:00.000-03:00`,
        eventDate: isoDate,
        hasExplicitTimestamp: !hadUnexpandedTokens,
      };
    }
    const isoFull = `${isoDate}T${hh.padStart(2, "0")}:${(mm || "00").padStart(
      2,
      "0"
    )}:${(ss || "00").padStart(2, "0")}.000-03:00`;
    return {
      originalTimestamp: isoFull,
      eventDate: isoDate,
      hasExplicitTimestamp: true,
    };
  }

  // 4. ISO-like YYYY-M(M)-D(D) H(H):m(m)(:s(s)) without timezone -> treat as Brazil local date
  const localIsoMatch = rawStr.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
  );
  if (localIsoMatch) {
    const [, y, m, d, hh, mm, ss = "00"] = localIsoMatch;
    const datePart = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const timePart = `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(
      2,
      "0"
    )}`;
    return {
      originalTimestamp: `${datePart}T${timePart}.000-03:00`,
      eventDate: datePart,
      hasExplicitTimestamp: true,
    };
  }

  // 5. Standard ISO-8601 parse
  const parsed = new Date(rawStr);
  if (!Number.isNaN(parsed.getTime())) {
    const canonical = new Date(Math.floor(parsed.getTime() / 1000) * 1000);
    return {
      originalTimestamp: canonical.toISOString(),
      eventDate: formatDateInBrazilTz(canonical),
      hasExplicitTimestamp: true,
    };
  }

  // 6. Unparseable string: use fallback date
  return {
    originalTimestamp: fallbackNow.toISOString(),
    eventDate: formatDateInBrazilTz(fallbackNow),
    hasExplicitTimestamp: false,
  };
}

/**
 * Extracts BRL currency amount from notification text.
 * Supports "R$ 50,42", "R$1.234,56", "BRL 89,00", "R$ 120.50", "50,42 no débito", etc.
 */
export function extractBrlAmount(text: string): number | null {
  const currencyRegex =
    /(?:R\$|BRL)[\s\u00A0]*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+)/i;
  const match = text.match(currencyRegex);
  const rawNumber = match?.[1];

  if (rawNumber) {
    return parseBrazilianNumber(rawNumber);
  }

  // Fallback 1: patterns like "valor de 45,90", "de 50,42", "por 50,42"
  const fallbackMatch = text.match(
    /(?:valor\s+de|de|por|foi\s+de)[\s\u00A0]+(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/i
  );
  if (fallbackMatch?.[1]) {
    return parseBrazilianNumber(fallbackMatch[1]);
  }

  // Fallback 2: explicit Brazilian decimal amount (e.g. "50,42 no débito")
  const brDecimalMatch = text.match(/\b(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\b/);
  if (brDecimalMatch?.[1]) {
    return parseBrazilianNumber(brDecimalMatch[1]);
  }

  return null;
}

function parseBrazilianNumber(numStr: string): number | null {
  let normalized = numStr.trim();
  if (normalized.includes(",")) {
    // Brazilian format: 1.234,56 -> 1234.56
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  const val = Number.parseFloat(normalized);
  return Number.isFinite(val) && val > 0 ? Number(val.toFixed(2)) : null;
}

/**
 * Infers a suggested category/tag based on merchant name and notification text.
 */
export function inferCategoryFromNotification(
  merchant: string | null,
  title: string | null,
  message: string
): string | null {
  const combined = [merchant || "", title || "", message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(?:ifood|ifd\*|rappi|z[eé]\s+delivery|padaria|p[aã]o|lanche|lanchonete|restaurante|burger|mcdonald|bk|outback|pizza|pizzaria|mercado|supermercado|assa[ií]|carrefour|pao\s+de\s+acucar|hortifruti|a[cç]ougue|caf[eé]|cafeteria|doceria|sorvete|bar|biscoito|almo[cç]o|jantar)\b/i.test(
      combined
    )
  ) {
    return "Alimentação";
  }

  if (
    /\b(?:uber|99app|99\*|99pop|posto|ipiranga|shell|petrobras|combust[ií]vel|estacionamento|ped[aá]gio|sem\s+parar|veloe|metr[oô]|onibus|[oô]nibus|passagem|latam|gol|azul)\b/i.test(
      combined
    )
  ) {
    return "Transporte";
  }

  if (
    /\b(?:drogasil|droga\s+raia|pague\s+menos|farm[aá]cia|drogaria|hospital|cl[ií]nica|m[eé]dico|laborat[oó]rio|unimed|exame|consulta)\b/i.test(
      combined
    )
  ) {
    return "Saúde";
  }

  if (
    /\b(?:netflix|spotify|amazon\s+prime|disney|hbo|max|youtube|google|apple|icloud|openai|claude|vivo|claro|tim|oi|internet|energia|cemig|enel|sabesp|copasa|fatura\s+celular)\b/i.test(
      combined
    )
  ) {
    return "Serviços";
  }

  if (/\b(?:aluguel|condom[ií]nio|iptu)\b/i.test(combined)) {
    return "Moradia";
  }

  if (
    /\b(?:cinema|ingresso|steam|playstation|xbox|nintendo|show|teatro|clube)\b/i.test(
      combined
    )
  ) {
    return "Lazer";
  }

  return null;
}

/**
 * Parses Brazilian bank notification text to detect transaction direction,
 * amount, payment method, and merchant/recipient description.
 */
export function parseBrazilianBankNotification(
  title: string | null,
  message: string
): {
  detectedType: NotificationDetectedType;
  parsedAmount: number | null;
  parsedMerchant: string | null;
  parsedPaymentMethod: NotificationPaymentMethod;
} {
  const cleanTitle = cleanMacroDroidPlaceholders(title);
  const cleanMsg = cleanMacroDroidPlaceholders(message) || "";
  const combined =
    cleanTitle && cleanMsg && cleanTitle.toLowerCase() !== cleanMsg.toLowerCase()
      ? `${cleanTitle} - ${cleanMsg}`.trim()
      : (cleanMsg || cleanTitle || "").trim();
  const lower = combined.toLowerCase();
  const parsedAmount = extractBrlAmount(combined);

  // 1. Check ignored / non-disbursement alerts first (declined purchases, OTP tokens, invoice alerts)
  const ignoredPatterns = [
    /compra\s+(?:negada|recusada|cancelada|n[aã]o\s+autorizada)/i,
    /transa[cç][aã]o\s+(?:negada|recusada|cancelada|n[aã]o\s+autorizada)/i,
    /pagamento\s+(?:com\s+nupay\s+)?(?:negado|recusado|cancelado|n[aã]o\s+autorizado)/i,
    /pix\s+(?:agendado|cancelado|recusado|n[aã]o\s+realizado)/i,
    /c[oó]digo\s+de\s+(?:verifica[cç][aã]o|seguran[cç]a|acesso)/i,
    /fatura\s+(?:fechou|fechada|vence|dispon[ií]vel)/i,
    /limite\s+dispon[ií]vel/i,
    /estorno\s+de\s+compra/i,
  ];

  for (const pat of ignoredPatterns) {
    if (pat.test(lower)) {
      return {
        detectedType: "ignored",
        parsedAmount,
        parsedMerchant: null,
        parsedPaymentMethod: "unknown",
      };
    }
  }

  // 2. Detect payment method
  let parsedPaymentMethod: NotificationPaymentMethod = "unknown";
  if (/d[eé]bito/i.test(lower)) {
    parsedPaymentMethod = "debit";
  } else if (/pix/i.test(lower)) {
    parsedPaymentMethod = "pix";
  } else if (/cr[eé]dito|parcelad[oa]|\b\d+x\s+de\b/i.test(lower)) {
    parsedPaymentMethod = "credit_card";
  } else if (/nupay/i.test(lower)) {
    parsedPaymentMethod = "debit";
  } else if (/boleto|fatura|conta\s+de/i.test(lower)) {
    parsedPaymentMethod = "bill";
  } else if (/transfer[eê]ncia|transferiu|\bted\b|\bdoc\b/i.test(lower)) {
    parsedPaymentMethod = "transfer";
  }

  // 3. Check incoming (entradas)
  const incomingPatterns = [
    /pix\s+recebido/i,
    /transfer[eê]ncia\s+recebida/i,
    /voc[eê]\s+recebeu/i,
    /recebeu\s+(?:um\s+)?(?:pix|transfer[eê]ncia|pagamento|valor)/i,
    /dep[oó]sito\s+recebido/i,
    /reembolso\s+recebido/i,
    /sal[aá]rio\s+recebido/i,
  ];

  for (const pat of incomingPatterns) {
    if (pat.test(lower)) {
      return {
        detectedType: "incoming",
        parsedAmount,
        parsedMerchant: extractMerchantOrPeer(combined, "incoming"),
        parsedPaymentMethod,
      };
    }
  }

  // 4. Check outgoing (saídas) - including NuPay ("Pagamento com NuPay aprovado", "no débito com NuPay APROVADO em iFood")
  const outgoingPatterns = [
    /compra\s+(?:aprovad[oa]|no\s+d[eé]bito|no\s+cr[eé]dito|com\s+cart[aã]o|realizad[oa]|confirmad[oa]|de\s+r\$)/i,
    /compra\s+no\s+(?:d[eé]bito|cr[eé]dito)\s+aprovad[oa]/i,
    /d[eé]bito\s+(?:com\s+nupay\s+)?aprovad[oa]/i,
    /cr[eé]dito\s+(?:com\s+nupay\s+)?aprovad[oa]/i,
    /nupay\s+aprovad[oa]/i,
    /aprovad[oa]\s+no\s+(?:d[eé]bito|cr[eé]dito|cart[aã]o)/i,
    /transa[cç][aã]o\s+aprovad[oa]/i,
    /pix\s+enviado/i,
    /voc[eê]\s+(?:enviou|transferiu|pagou)/i,
    /transfer[eê]ncia\s+(?:enviada|realizada|conclu[ií]da)/i,
    /pagamento\s+(?:com\s+nupay\s+)?(?:no\s+d[eé]bito\s+|no\s+cr[eé]dito\s+)?(?:efetuado|realizado|confirmado|aprovad[oa]|conclu[ií]do|de\s+r\$)/i,
    /d[eé]bito\s+autom[aá]tico/i,
    /saque\s+(?:realizado|aprovado|de\s+r\$)/i,
    /usando\s+o\s+cart[aã]o/i,
  ];

  const isOutgoingMatch = outgoingPatterns.some((pat) => pat.test(lower));

  if (isOutgoingMatch) {
    return {
      detectedType: "outgoing",
      parsedAmount,
      parsedMerchant: extractMerchantOrPeer(combined, "outgoing"),
      parsedPaymentMethod,
    };
  }

  // Also treat notifications from bank/wallet with a valid amount + "aprovado(a)" or "no débito/crédito" as outgoing
  if (
    parsedAmount !== null &&
    (/\baprovad[oa]\b/i.test(lower) ||
      /\bno\s+d[eé]bito\b/i.test(lower) ||
      /\bno\s+cr[eé]dito\b/i.test(lower))
  ) {
    return {
      detectedType: "outgoing",
      parsedAmount,
      parsedMerchant: extractMerchantOrPeer(combined, "outgoing"),
      parsedPaymentMethod,
    };
  }

  return {
    detectedType: "ignored",
    parsedAmount,
    parsedMerchant: null,
    parsedPaymentMethod,
  };
}

function extractMerchantOrPeer(
  combinedText: string,
  direction: "outgoing" | "incoming"
): string | null {
  const patterns =
    direction === "outgoing"
      ? [
          // "R$ 50,42 no débito com NuPay APROVADO em iFood." / "Compra de R$ 45,90 aprovada em PADARIA CENTRAL no débito"
          /\b(?:aprovad[oa]\s+em|compra\s+em|realizad[oa]\s+em|confirmad[oa]\s+em|pagamento\s+em|estabelecimento:?)\s+([A-Za-z0-9À-ú][A-Za-z0-9À-ú\s.*&/_-]{1,48}?)(?=\s+(?:no\s+valor|de\s+R\$|por\s+R\$|no\s+d[eé]bito|no\s+cr[eé]dito|com\s+o?\s*cart[aã]o|com\s+nupay|usando|em\s+\d{1,2}[/.-]\d{1,2}|\s+às\s+\d)|[.!,\n]|$)/i,
          // "Pix enviado de R$ 50,00 para JOAO SILVA"
          /\b(?:para|favorecido:?)\s+([A-Za-z0-9À-ú][A-Za-z0-9À-ú\s.*&/_-]{1,48}?)(?=\s+(?:no\s+valor|de\s+R\$|em\s+\d{1,2}[/.-]\d{1,2})|[.!,\n]|$)/i,
          // Generic " em MERCHANT" after R$ value: "R$ 45,90 em PADARIA CENTRAL"
          /R\$\s*[\d.,]+\s+(?:no\s+(?:d[eé]bito|cr[eé]dito)\s+)?(?:com\s+nupay\s+)?(?:aprovad[oa]\s+)?em\s+([A-Za-z0-9À-ú][A-Za-z0-9À-ú\s.*&/_-]{1,48}?)(?=\s+(?:no\s+d[eé]bito|no\s+cr[eé]dito|com\s+o?\s*cart[aã]o|usando|em\s+\d{1,2}[/.-]\d{1,2}|\s+às\s+\d)|[.!,\n]|$)/i,
        ]
      : [
          /\b(?:de|remetente:?)\s+([A-Za-z0-9À-ú][A-Za-z0-9À-ú\s.*&/_-]{1,48}?)(?=\s+(?:no\s+valor|de\s+R\$)|[.!,\n]|$)/i,
        ];

  for (const regex of patterns) {
    const m = combinedText.match(regex);
    if (m?.[1]) {
      const cleaned = m[1].trim().replace(/\s+/g, " ");
      // Filter out false positive time/date words
      if (
        cleaned.length >= 2 &&
        !/^(?:d[eé]bito|cr[eé]dito|pix|dinheiro|cart[aã]o|nupay|\d+)$/i.test(
          cleaned
        )
      ) {
        return cleaned;
      }
    }
  }
  return null;
}

/**
 * Generates a deterministic SHA-256 fingerprint for idempotency.
 * Retries of the same notification produce the exact same fingerprint,
 * while two distinct purchases of the same value at different timestamps
 * produce distinct fingerprints.
 */
export function computeNotificationFingerprint(params: {
  explicitFingerprint?: string | null;
  externalId?: string | null;
  appPackage?: string | null;
  appName?: string | null;
  title?: string | null;
  message: string;
  originalTimestamp: string;
  eventDate: string;
  hasExplicitTimestamp: boolean;
}): string {
  if (params.explicitFingerprint && params.explicitFingerprint.trim().length > 0) {
    return params.explicitFingerprint.trim();
  }

  const appKey = (params.appPackage || params.appName || "unknown")
    .trim()
    .toLowerCase();
  const titleNorm = (params.title || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  const msgNorm = params.message.trim().replace(/\s+/g, " ").toLowerCase();

  // If the device provided an original timestamp, include it so 2 real purchases
  // of the same value at different moments do not collide.
  // If no timestamp was sent by the caller, fallback to eventDate so retries on the same day still deduplicate.
  const timeKey = params.hasExplicitTimestamp
    ? params.originalTimestamp
    : params.eventDate;

  const rawKey = [
    params.externalId ? String(params.externalId).trim() : "",
    appKey,
    titleNorm,
    msgNorm,
    timeKey,
  ].join("|");

  const digest = sha256Hex(rawKey).slice(0, 32);
  return `nf_${digest}`;
}

/**
 * Normalizes a single raw notification object into a validated NormalizedNotification.
 * Throws an error if the notification has no message/text content.
 */
export function normalizeSingleNotification(
  raw: RawNotificationInput,
  fallbackNow = new Date()
): NormalizedNotification {
  const message = pickBestNotificationMessage(
    raw.message,
    raw.notification,
    raw.text,
    raw.body,
    raw.not_text,
    raw.not_big_text,
    raw.big_text,
    raw.bigText,
    raw.not_sub_text,
    raw.sub_text,
    raw.subText,
    raw.not_ticker,
    raw.ticker,
    raw.summary,
    raw.content,
    raw.texto,
    raw.mensagem
  );

  const title = firstNonEmptyString(
    raw.title,
    raw.not_title,
    raw.titulo,
    raw.header
  );

  // If only title was sent and message is empty (or was an unexpanded MacroDroid token), use title as message
  const effectiveMessage = message || title;
  if (!effectiveMessage) {
    throw new Error(
      "Campo de mensagem da notificação ausente (envie 'message' com '{notification}' no MacroDroid)."
    );
  }

  const appPackage = firstNonEmptyString(
    raw.appPackage,
    raw.app_package,
    raw.not_app_package,
    raw.package,
    raw.packageName
  );

  const rawAppName = firstNonEmptyString(
    raw.appName,
    raw.app_name,
    raw.not_app_name,
    raw.app,
    raw.banco
  );

  const appName =
    rawAppName ||
    (appPackage && KNOWN_BANK_PACKAGES[appPackage]) ||
    appPackage ||
    null;

  const externalId = firstNonEmptyString(
    raw.notificationId,
    raw.notification_id,
    raw.id,
    raw.key
  );

  const rawTimestamp =
    raw.originalTimestamp ??
    raw.original_timestamp ??
    raw.not_timestamp ??
    raw.timestamp ??
    raw.postedAt ??
    raw.time ??
    raw.data_hora ??
    raw.date;

  const { originalTimestamp, eventDate, hasExplicitTimestamp } =
    resolveTimestampAndDate(rawTimestamp, fallbackNow);

  const fingerprint = computeNotificationFingerprint({
    explicitFingerprint: firstNonEmptyString(raw.fingerprint),
    externalId,
    appPackage,
    appName,
    title,
    message: effectiveMessage,
    originalTimestamp,
    eventDate,
    hasExplicitTimestamp,
  });

  const parsed = parseBrazilianBankNotification(title, effectiveMessage);

  return {
    externalId,
    appPackage,
    appName,
    title,
    message: effectiveMessage,
    originalTimestamp,
    eventDate,
    hasExplicitTimestamp,
    fingerprint,
    detectedType: parsed.detectedType,
    parsedAmount: parsed.parsedAmount,
    parsedMerchant: parsed.parsedMerchant,
    parsedPaymentMethod: parsed.parsedPaymentMethod,
    rawPayload: JSON.stringify(raw),
  };
}

/**
 * Parses any incoming request body (single JSON, JSON array, `{ notifications: [...] }`,
 * or newline-delimited NDJSON from an offline retry queue file) into an array of RawNotificationInput.
 */
export function extractRawNotificationsFromBody(
  bodyText: string,
  contentType: string | null
): RawNotificationInput[] {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    throw new Error("Corpo da requisição vazio.");
  }

  // 1. Try URL-encoded form data if applicable
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(trimmed);
    const obj: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      obj[k] = v;
    }
    return [obj as unknown as RawNotificationInput];
  }

  // 2. Try standard JSON parse (object or array), plus forgiving fallback for MacroDroid multiline {not_text}
  for (const candidate of [trimmed, trimmed.replace(/\r?\n/g, " ")]) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return parsed as RawNotificationInput[];
      }
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.notifications)) {
          return parsed.notifications as RawNotificationInput[];
        }
        if (Array.isArray(parsed.items)) {
          return parsed.items as RawNotificationInput[];
        }
        return [parsed as RawNotificationInput];
      }
    } catch {
      // Continue to next candidate / fallback
    }
  }

  {
    // 3. Fallback: try NDJSON (JSON Lines - one JSON object per line, ideal for MacroDroid offline file queue)
    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length > 1) {
      const items: RawNotificationInput[] = [];
      let allJsonLines = true;
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          if (item && typeof item === "object") {
            items.push(item as RawNotificationInput);
          } else {
            allJsonLines = false;
            break;
          }
        } catch {
          allJsonLines = false;
          break;
        }
      }
      if (allJsonLines && items.length > 0) {
        return items;
      }
    }

    // 4. Fallback: pipe-delimited lines `timestamp|app|title|message` from a simple text file queue
    const pipeItems: RawNotificationInput[] = [];
    for (const line of lines) {
      if (line.includes("|")) {
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length >= 4) {
          pipeItems.push({
            timestamp: parts[0],
            app: parts[1],
            title: parts[2],
            message: parts.slice(3).join(" | "),
          });
        } else if (parts.length === 3) {
          pipeItems.push({
            timestamp: parts[0],
            app: parts[1],
            message: parts[2],
          });
        }
      }
    }
    if (pipeItems.length > 0) {
      return pipeItems;
    }

    throw new Error(
      "Formato de payload inválido. Envie um objeto JSON, array JSON ou linhas JSON (NDJSON)."
    );
  }

  throw new Error("Payload de notificação inválido.");
}
