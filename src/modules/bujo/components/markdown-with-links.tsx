"use client";

import React from "react";
import Link from "next/link";

interface MarkdownWithLinksProps {
  content: string;
  emptyText?: string;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Split by [[wikilink]], [label](url), bare https://... URLs, **bold**, and `code`
  const tokenRegex =
    /(!?\[\[[^\]]+\]\]|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s)]+|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Image embed ![[...]]
    if (part.startsWith("![[") && part.endsWith("]]")) {
      const inner = part.slice(3, -2).trim();
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#eff3f0] border border-[#d5ded8] text-[11px] font-mono text-[#526657]"
        >
          📎 {inner}
        </span>
      );
    }

    // [[Wikilink]]
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const raw = part.slice(2, -2).trim();
      const [targetAndSection, alias] = raw.split("|");
      const target = (targetAndSection || raw).split("#")[0].trim();
      const label = (alias || targetAndSection || raw).trim();
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(target);

      if (isDate) {
        return (
          <Link
            key={idx}
            href={`/bujo/${target}`}
            className="inline-flex items-center px-1.5 py-0.2 rounded bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] font-semibold hover:underline"
          >
            📅 {label}
          </Link>
        );
      }

      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.2 rounded bg-[#eff3f0] border border-[#cfd8d2] text-[#2d6a3e] font-semibold"
          title={`Link: ${target}`}
        >
          [[{label}]]
        </span>
      );
    }

    // Markdown link [label](url)
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (match) {
        return (
          <a
            key={idx}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0369a1] underline hover:text-[#0284c7] break-all"
          >
            {match[1]}
          </a>
        );
      }
    }

    // Bare URL
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0369a1] underline hover:text-[#0284c7] break-all"
        >
          {part}
        </a>
      );
    }

    // **Bold**
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-[#141f17]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // `Code`
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-[#eff3f0] border border-[#d5ded8] font-mono text-[11px] text-[#141f17]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function MarkdownWithLinks({
  content,
  emptyText = "Nenhum registro escrito.",
}: MarkdownWithLinksProps) {
  const trimmed = content.trim();
  if (!trimmed) {
    return (
      <p className="text-xs italic text-[#526657]">{emptyText}</p>
    );
  }

  const lines = content.split(/\r?\n/);

  return (
    <div className="space-y-1 text-xs text-[#141f17] leading-relaxed">
      {lines.map((line, i) => {
        const lineTrim = line.trim();
        if (!lineTrim) {
          return <div key={i} className="h-1.5" />;
        }

        const headingMatch = lineTrim.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          return (
            <div
              key={i}
              className={`font-extrabold text-[#141f17] pt-1 ${
                level <= 2 ? "text-sm" : "text-xs"
              }`}
            >
              {renderInlineMarkdown(headingMatch[2])}
            </div>
          );
        }

        const taskMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s*(.*)$/);
        if (taskMatch) {
          const indentPx = Math.min(36, Math.floor(taskMatch[1].length / 2) * 14);
          const done = taskMatch[2].toLowerCase() === "x";
          return (
            <div
              key={i}
              style={{ paddingLeft: `${indentPx}px` }}
              className="flex items-start gap-1.5"
            >
              <span
                className={`mt-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded border text-[10px] shrink-0 ${
                  done
                    ? "bg-[#2d6a3e] border-[#2d6a3e] text-white"
                    : "border-[#8fa395] bg-white"
                }`}
              >
                {done ? "✓" : ""}
              </span>
              <span className={done ? "line-through text-[#526657]" : ""}>
                {renderInlineMarkdown(taskMatch[3])}
              </span>
            </div>
          );
        }

        const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
        if (bulletMatch) {
          const indentPx = Math.min(36, Math.floor(bulletMatch[1].length / 2) * 14);
          return (
            <div
              key={i}
              style={{ paddingLeft: `${indentPx}px` }}
              className="flex items-start gap-1.5"
            >
              <span className="text-[#2d6a3e] font-bold mt-0.5">•</span>
              <span className="flex-1">{renderInlineMarkdown(bulletMatch[2])}</span>
            </div>
          );
        }

        return <p key={i}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}
