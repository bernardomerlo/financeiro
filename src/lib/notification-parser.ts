import { createHash } from "node:crypto";

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
  text?: string;
  body?: string;
  not_text?: string;
  not_big_text?: string;
  big_text?: string;
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

function firstNonEmptyString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      return c.trim();
    }
    if (typeof c === "number" && !Number.isNaN(c)) {
      return String(c);
    }
  }
  return null;
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
  if (rawInput === null || rawInput === undefined || String(rawInput).trim() === "") {
    return {
      originalTimestamp: fallbackNow.toISOString(),
      eventDate: formatDateInBrazilTz(fallbackNow),
      hasExplicitTimestamp: false,
    };
  }

  const rawStr = String(rawInput).trim();

  // 1. Pure numeric epoch (seconds or milliseconds)
  if (/^\d{10,16}$/.test(rawStr)) {
    const num = Number(rawStr);
    const ms = rawStr.length <= 10 ? num * 1000 : num;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      // Round to whole seconds so minor ms jitter on retry doesn't alter fingerprint
      const canonical = new Date(Math.floor(d.getTime() / 1000) * 1000);
      return {
        originalTimestamp: canonical.toISOString(),
        eventDate: formatDateInBrazilTz(canonical),
        hasExplicitTimestamp: true,
      };
    }
  }

  // 2. Explicit YYYY-MM-DD only
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawStr)) {
    return {
      originalTimestamp: `${rawStr}T12:00:00.000-03:00`,
      eventDate: rawStr,
      hasExplicitTimestamp: true,
    };
  }

  // 3. Brazilian date format: DD/MM/YYYY or DD/MM/YYYY HH:mm(:ss)
  const brMatch = rawStr.match(
    /^(\d{2})[/.-](\d{2})[/.-](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (brMatch) {
    const [, day, month, year, hh = "12", mm = "00", ss = "00"] = brMatch;
    const isoDate = `${year}-${month}-${day}`;
    const isoFull = `${isoDate}T${hh}:${mm}:${ss}.000-03:00`;
    return {
      originalTimestamp: isoFull,
      eventDate: isoDate,
      hasExplicitTimestamp: true,
    };
  }

  // 4. ISO-like YYYY-MM-DD HH:mm(:ss) without timezone -> treat as Brazil local date
  const localIsoMatch = rawStr.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/
  );
  if (localIsoMatch) {
    const [, datePart, timePart] = localIsoMatch;
    const normalizedTime = timePart.length === 5 ? `${timePart}:00` : timePart;
    return {
      originalTimestamp: `${datePart}T${normalizedTime}.000-03:00`,
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

  // 6. Unparseable string: keep raw string for fingerprint consistency and use fallback date
  return {
    originalTimestamp: rawStr,
    eventDate: formatDateInBrazilTz(fallbackNow),
    hasExplicitTimestamp: true,
  };
}

/**
 * Extracts BRL currency amount from notification text.
 * Supports "R$ 45,90", "R$1.234,56", "BRL 89,00", "R$ 120.50", etc.
 */
export function extractBrlAmount(text: string): number | null {
  const currencyRegex =
    /(?:R\$|BRL)\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+)/i;
  const match = text.match(currencyRegex);
  const rawNumber = match?.[1];

  if (!rawNumber) {
    // Fallback for patterns like "valor de 45,90"
    const fallbackMatch = text.match(
      /(?:valor\s+de|de|por)\s+(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/i
    );
    if (!fallbackMatch?.[1]) return null;
    return parseBrazilianNumber(fallbackMatch[1]);
  }

  return parseBrazilianNumber(rawNumber);
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
  const combined = [title || "", message].filter(Boolean).join(" - ").trim();
  const lower = combined.toLowerCase();
  const parsedAmount = extractBrlAmount(combined);

  // 1. Check ignored / non-disbursement alerts first (declined purchases, OTP tokens, invoice alerts)
  const ignoredPatterns = [
    /compra\s+(?:negada|recusada|cancelada|n[aã]o\s+autorizada)/i,
    /transa[cç][aã]o\s+(?:negada|recusada|cancelada|n[aã]o\s+autorizada)/i,
    /pagamento\s+(?:negado|recusado|cancelado)/i,
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

  // 4. Check outgoing (saídas)
  const outgoingPatterns = [
    /compra\s+(?:aprovada|no\s+d[eé]bito|no\s+cr[eé]dito|com\s+cart[aã]o|realizada|confirmada|de\s+r\$)/i,
    /d[eé]bito\s+aprovad[oa]/i,
    /cr[eé]dito\s+aprovad[oa]/i,
    /aprovada\s+no\s+(?:d[eé]bito|cr[eé]dito|cart[aã]o)/i,
    /transa[cç][aã]o\s+aprovada/i,
    /pix\s+enviado/i,
    /voc[eê]\s+(?:enviou|transferiu|pagou)/i,
    /transfer[eê]ncia\s+(?:enviada|realizada|conclu[ií]da)/i,
    /pagamento\s+(?:efetuado|realizado|confirmado|aprovado|conclu[ií]do|de\s+r\$)/i,
    /d[eé]bito\s+autom[aá]tico/i,
    /saque\s+(?:realizado|aprovado|de\s+r\$)/i,
    /usando\s+o\s+cart[aã]o/i,
  ];

  const isOutgoingMatch = outgoingPatterns.some((pat) => pat.test(lower));

  if (isOutgoingMatch && parsedAmount !== null) {
    return {
      detectedType: "outgoing",
      parsedAmount,
      parsedMerchant: extractMerchantOrPeer(combined, "outgoing"),
      parsedPaymentMethod,
    };
  }

  // Also treat notifications from bank/wallet with a valid amount + "aprovada" or " em " as outgoing
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
          // "Compra de R$ 45,90 aprovada em PADARIA CENTRAL no débito" / "Compra em IFOOD *IFOOD de R$ 32,00"
          /\b(?:aprovada\s+em|compra\s+em|realizada\s+em|estabelecimento:?)\s+([A-Za-z0-9À-ú][A-Za-z0-9À-ú\s.*&/_-]{1,48}?)(?=\s+(?:no\s+valor|de\s+R\$|no\s+d[eé]bito|no\s+cr[eé]dito|com\s+o?\s*cart[aã]o|usando|em\s+\d{1,2}[/.-]\d{1,2}|\s+às\s+\d)|[.!,\n]|$)/i,
          // "Pix enviado de R$ 50,00 para JOAO SILVA"
          /\b(?:para|favorecido:?)\s+([A-Za-z0-9À-ú][A-Za-z0-9À-ú\s.*&/_-]{1,48}?)(?=\s+(?:no\s+valor|de\s+R\$|em\s+\d{1,2}[/.-]\d{1,2})|[.!,\n]|$)/i,
          // Generic " em MERCHANT" after R$ value: "R$ 45,90 em PADARIA CENTRAL"
          /R\$\s*[\d.,]+\s+(?:aprovad[oa]\s+)?em\s+([A-Za-z0-9À-ú][A-Za-z0-9À-ú\s.*&/_-]{1,48}?)(?=\s+(?:no\s+d[eé]bito|no\s+cr[eé]dito|com\s+o?\s*cart[aã]o|usando|em\s+\d{1,2}[/.-]\d{1,2}|\s+às\s+\d)|[.!,\n]|$)/i,
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
        !/^(?:d[eé]bito|cr[eé]dito|pix|dinheiro|cart[aã]o|\d+)$/i.test(cleaned)
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

  const digest = createHash("sha256").update(rawKey).digest("hex").slice(0, 32);
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
  const message = firstNonEmptyString(
    raw.message,
    raw.text,
    raw.body,
    raw.not_text,
    raw.not_big_text,
    raw.big_text,
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

  // If only title was sent and message is empty, use title as message
  const effectiveMessage = message || title;
  if (!effectiveMessage) {
    throw new Error(
      "Campo de mensagem da notificação ausente (envie 'message', 'text' ou 'not_text')."
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
