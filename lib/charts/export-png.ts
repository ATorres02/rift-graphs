/**
 * Browser-only helpers that turn a rendered chart into a shareable PNG with a
 * title, a summary, an optional table and a source footer, all in the site's fonts.
 */
import { site } from "@/lib/site";

export interface PngTable {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface PngOptions {
  title: string;
  summary?: string;
  /** Data URL of the chart, already rendered at `scale`. */
  chartDataUrl: string;
  table?: PngTable;
  scale?: number;
}

const cssToken = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** Site line for exported images: name, URL, source and the usual disclaimer. */
export function exportFooter(path = "/charts"): string {
  const host = site.url.replace(/^https?:\/\//, "");
  return `${site.name}, ${host}${path}. Data: Leaguepedia (CC BY-SA). Not affiliated with Riot Games.`;
}

export async function composeChartPng({ title, summary, chartDataUrl, table, scale = 2 }: PngOptions): Promise<string> {
  const bg = cssToken("--card", "#ffffff");
  const fg = cssToken("--foreground", "#111111");
  const muted = cssToken("--muted-foreground", "#777777");
  const brand = cssToken("--brand", "#4d7cff");
  const grid = cssToken("--border", "#444444");
  const display = document.querySelector(".display");
  const headingFont = display ? getComputedStyle(display).fontFamily : "sans-serif";
  const bodyFont = getComputedStyle(document.body).fontFamily || "sans-serif";

  const chart = new Image();
  chart.src = chartDataUrl;
  await chart.decode();

  const pad = 40 * scale;
  const width = Math.max(chart.width + pad * 2, 900 * scale);
  const inner = width - pad * 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const wrap = (text: string, font: string, max: number) => {
    ctx.font = font;
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const probe = line ? `${line} ${word}` : word;
      if (ctx.measureText(probe).width > max && line) {
        lines.push(line);
        line = word;
      } else line = probe;
    }
    if (line) lines.push(line);
    return lines;
  };
  const titleFont = `700 ${34 * scale}px ${headingFont}`;
  const textFont = `400 ${15 * scale}px ${bodyFont}`;
  const cellFont = `400 ${14 * scale}px ${bodyFont}`;
  const headFont = `600 ${14 * scale}px ${bodyFont}`;
  const footFont = `400 ${12 * scale}px ${bodyFont}`;
  const titleLines = wrap(title.toUpperCase(), titleFont, inner);
  const textLines = summary ? wrap(summary, textFont, inner) : [];
  const rowH = 30 * scale;
  const tableH = table ? (table.rows.length + 1) * rowH + 24 * scale : 0;
  const titleH = titleLines.length * 40 * scale;
  const textH = textLines.length * 22 * scale;
  canvas.width = width;
  canvas.height =
    pad + titleH + 10 * scale + textH + 20 * scale + chart.height + 24 * scale + tableH + 20 * scale + pad;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = brand;
  ctx.fillRect(pad, pad + 4 * scale, 4 * scale, titleH - 8 * scale);
  ctx.textBaseline = "top";
  let y = pad;
  ctx.fillStyle = fg;
  ctx.font = titleFont;
  for (const l of titleLines) {
    ctx.fillText(l, pad + 16 * scale, y);
    y += 40 * scale;
  }
  y += 10 * scale;
  ctx.fillStyle = muted;
  ctx.font = textFont;
  for (const l of textLines) {
    ctx.fillText(l, pad, y);
    y += 22 * scale;
  }
  y += 20 * scale;
  ctx.drawImage(chart, Math.round((width - chart.width) / 2), y);
  y += chart.height + 24 * scale;

  if (table) {
    const cols = table.columns.length;
    const firstW = Math.round(inner * 0.4);
    const otherW = Math.floor((inner - firstW) / Math.max(cols - 1, 1));
    const colX = (i: number) => (i === 0 ? pad : pad + firstW + (i - 1) * otherW);
    const drawRow = (cells: (string | number | null)[], font: string, color: string) => {
      ctx.font = font;
      ctx.fillStyle = color;
      cells.forEach((c, i) => {
        const text = c === null || c === undefined ? "–" : String(c);
        if (i === 0) {
          ctx.textAlign = "left";
          ctx.fillText(text, colX(i), y + 8 * scale);
        } else {
          ctx.textAlign = "right";
          ctx.fillText(text, colX(i) + otherW - 8 * scale, y + 8 * scale);
        }
      });
      ctx.textAlign = "left";
      y += rowH;
      ctx.fillStyle = grid;
      ctx.fillRect(pad, y, inner, 1);
    };
    drawRow(table.columns, headFont, fg);
    for (const r of table.rows) drawRow(r, cellFont, fg);
    y += 24 * scale;
  }

  ctx.fillStyle = muted;
  ctx.fillRect(pad, y - 12 * scale, inner, 1);
  ctx.font = footFont;
  ctx.fillText(exportFooter(window.location.pathname), pad, y);
  ctx.textAlign = "right";
  ctx.fillText(new Date().toISOString().slice(0, 10), width - pad, y);
  ctx.textAlign = "left";
  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export function downloadText(text: string, filename: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}
