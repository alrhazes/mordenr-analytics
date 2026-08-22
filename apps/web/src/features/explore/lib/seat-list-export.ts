import type { SeatListRow } from "@/queries/explore";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

export function seatListSearchText(row: SeatListRow): string {
  return [
    row.member,
    row.partyGroup,
    row.party,
    row.parliamentCode,
    row.seatLabel,
    row.mapCode,
    row.state,
    row.year,
    row.government,
    row.ethnicityLabel,
    formatNumber(row.voters),
    formatNumber(row.majority),
    String(row.majorityPercent),
    String(row.turnout),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterSeatListRows(
  rows: SeatListRow[],
  query: string,
): SeatListRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => seatListSearchText(row).includes(q));
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): T[] {
  if (pageSize < 0) return rows;
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function totalPages(count: number, pageSize: number): number {
  if (pageSize < 0) return 1;
  return Math.max(1, Math.ceil(count / pageSize));
}

export type SeatListExportColumn = {
  header: string;
  value: (row: SeatListRow) => string;
};

export function seatListExportColumns(
  mapLevel: "parliament" | "dun",
): SeatListExportColumn[] {
  const cols: SeatListExportColumn[] = [
    { header: mapLevel === "parliament" ? "NAMA MP" : "NAMA ADUN", value: (r) => r.member },
    { header: "GABUNGAN", value: (r) => r.partyGroup },
    { header: "PARTI", value: (r) => r.party },
  ];
  if (mapLevel === "dun") {
    cols.push({ header: "PARLIMEN", value: (r) => r.parliamentCode || "" });
  }
  cols.push(
    { header: mapLevel === "parliament" ? "PARLIMEN" : "DUN", value: (r) => r.seatLabel },
    { header: "JUMLAH PENGUNDI", value: (r) => String(r.voters) },
    { header: "KERAJAAN", value: (r) => r.government },
    { header: "NEGERI", value: (r) => r.state },
    { header: "TAHUN", value: (r) => r.year },
    {
      header: "KAUM",
      value: (r) =>
        r.ethnicityLabel
          ? `${r.ethnicityLabel} ${r.ethnicityPercent}%`
          : "",
    },
    {
      header: "MAJORITI",
      value: (r) => `${r.majority} (${r.majorityPercent}%)`,
    },
    { header: "TOV", value: (r) => `${r.turnout}%` },
  );
  return cols;
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(
  rows: SeatListRow[],
  columns: SeatListExportColumn[],
): string {
  const header = columns.map((c) => escapeCsv(c.header)).join(",");
  const body = rows
    .map((row) =>
      columns.map((col) => escapeCsv(col.value(row))).join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8;",
) {
  const blob = new Blob(["\uFEFF", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyRowsToClipboard(
  rows: SeatListRow[],
  columns: SeatListExportColumn[],
) {
  const text = [
    columns.map((c) => c.header).join("\t"),
    ...rows.map((row) => columns.map((col) => col.value(row)).join("\t")),
  ].join("\n");
  await navigator.clipboard.writeText(text);
}

export function printSeatListTable(
  title: string,
  rows: SeatListRow[],
  columns: SeatListExportColumn[],
) {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; }
          h1 { font-size: 18px; margin-bottom: 12px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #eef2f7; text-transform: uppercase; font-size: 10px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>${columns.map((c) => `<th>${c.header}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) =>
                  `<tr>${columns
                    .map((col) => `<td>${col.value(row)}</td>`)
                    .join("")}</tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
