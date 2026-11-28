import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Personal Hub — BuJo, Finanças & Saúde",
    short_name: "Personal Hub",
    description: "Hub pessoal com Bullet Journal, Fluxo de Caixa e Samsung Health",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f4",
    theme_color: "#2d6a3e",
    lang: "pt-BR",
  };
}
