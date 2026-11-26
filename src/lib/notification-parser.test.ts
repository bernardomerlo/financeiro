import { describe, expect, it } from "vitest";
import {
  extractBrlAmount,
  extractRawNotificationsFromBody,
  normalizeSingleNotification,
  parseBrazilianBankNotification,
  resolveTimestampAndDate,
} from "./notification-parser";

describe("notification-parser & idempotency", () => {
  it("extracts BRL amounts in various Brazilian formats", () => {
    expect(extractBrlAmount("Compra de R$ 45,90 aprovada")).toBe(45.9);
    expect(extractBrlAmount("Pix enviado: R$1.234,56 para Maria")).toBe(1234.56);
    expect(extractBrlAmount("BRL 89,00 no débito")).toBe(89);
  });

  it("classifies debit purchases, Pix sent, and credit card purchases as outgoing", () => {
    const debit = parseBrazilianBankNotification(
      "Compra no débito",
      "Compra de R$ 45,90 aprovada em PADARIA CENTRAL no débito"
    );
    expect(debit.detectedType).toBe("outgoing");
    expect(debit.parsedAmount).toBe(45.9);
    expect(debit.parsedPaymentMethod).toBe("debit");
    expect(debit.parsedMerchant).toBe("PADARIA CENTRAL");

    const pix = parseBrazilianBankNotification(
      "Transferência enviada",
      "Você enviou um Pix de R$ 120,00 para MERCADO SAO JORGE."
    );
    expect(pix.detectedType).toBe("outgoing");
    expect(pix.parsedAmount).toBe(120);
    expect(pix.parsedPaymentMethod).toBe("pix");
    expect(pix.parsedMerchant).toBe("MERCADO SAO JORGE");

    const credit = parseBrazilianBankNotification(
      "Compra aprovada",
      "Compra aprovada no crédito de R$ 250,00 em AMAZON BR"
    );
    expect(credit.detectedType).toBe("outgoing");
    expect(credit.parsedAmount).toBe(250);
    expect(credit.parsedPaymentMethod).toBe("credit_card");
  });

  it("ignores declined purchases, OTP codes, and invoice reminders", () => {
    const declined = parseBrazilianBankNotification(
      "Compra recusada",
      "Compra de R$ 45,90 negada no cartão de débito"
    );
    expect(declined.detectedType).toBe("ignored");

    const otp = parseBrazilianBankNotification(
      "Código de segurança",
      "Seu código de verificação é 482910"
    );
    expect(otp.detectedType).toBe("ignored");
  });

  it("classifies Pix received as incoming", () => {
    const incoming = parseBrazilianBankNotification(
      "Pix recebido",
      "Você recebeu um Pix de R$ 300,00 de CARLOS SILVA"
    );
    expect(incoming.detectedType).toBe("incoming");
    expect(incoming.parsedAmount).toBe(300);
    expect(incoming.parsedPaymentMethod).toBe("pix");
  });

  it("produces identical fingerprint on offline retry of the same notification", () => {
    const firstAttempt = normalizeSingleNotification({
      not_app_package: "com.nu.production",
      not_title: "Compra no débito",
      not_text: "Compra de R$ 38,50 aprovada em FARMACIA DROGASIL",
      not_timestamp: "2026-11-25 14:32:10",
    });

    const retryLater = normalizeSingleNotification({
      appPackage: "com.nu.production",
      title: "Compra no débito",
      message: "Compra de R$ 38,50 aprovada em FARMACIA DROGASIL",
      timestamp: "25/11/2026 14:32:10",
    });

    expect(firstAttempt.fingerprint).toBe(retryLater.fingerprint);
    expect(firstAttempt.eventDate).toBe("2026-11-25");
    expect(firstAttempt.appName).toBe("Nubank");
  });

  it("produces distinct fingerprints for two real purchases of the same amount at different timestamps", () => {
    const purchase1 = normalizeSingleNotification({
      appPackage: "com.nu.production",
      title: "Compra no débito",
      message: "Compra de R$ 15,00 aprovada em PADARIA CENTRAL",
      timestamp: "2026-11-25 08:10:00",
    });

    const purchase2 = normalizeSingleNotification({
      appPackage: "com.nu.production",
      title: "Compra no débito",
      message: "Compra de R$ 15,00 aprovada em PADARIA CENTRAL",
      timestamp: "2026-11-25 08:12:00",
    });

    expect(purchase1.fingerprint).not.toBe(purchase2.fingerprint);
  });

  it("supports NDJSON and pipe-delimited offline queue files from MacroDroid", () => {
    const ndjson = [
      JSON.stringify({
        app: "Nubank",
        title: "Compra no débito",
        message: "Compra de R$ 22,00 aprovada em LANCHONETE",
        timestamp: "2026-11-25 12:00:00",
      }),
      JSON.stringify({
        app: "Itaú",
        title: "Pix enviado",
        message: "Pix enviado de R$ 50,00 para JOAO",
        timestamp: "2026-11-25 12:30:00",
      }),
    ].join("\n");

    const items = extractRawNotificationsFromBody(ndjson, "text/plain");
    expect(items).toHaveLength(2);

    const pipeQueue = [
      "2026-11-25 12:00:00|Nubank|Compra no débito|Compra de R$ 22,00 aprovada em LANCHONETE",
      "2026-11-25 12:30:00|Itaú|Pix enviado|Pix enviado de R$ 50,00 para JOAO",
    ].join("\n");

    const pipeItems = extractRawNotificationsFromBody(pipeQueue, "text/plain");
    expect(pipeItems).toHaveLength(2);
    expect(pipeItems[0].app).toBe("Nubank");
  });

  it("resolves epoch seconds, epoch milliseconds, and BR dates accurately", () => {
    const br = resolveTimestampAndDate("25/11/2026 18:45:00");
    expect(br.eventDate).toBe("2026-11-25");
    expect(br.hasExplicitTimestamp).toBe(true);
  });
});
