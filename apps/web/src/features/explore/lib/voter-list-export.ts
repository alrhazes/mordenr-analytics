import type { VoterListRow } from "@/queries/demography";
import { downloadTextFile } from "@/features/explore/lib/seat-list-export";

export type VoterListExportColumn = {
  header: string;
  value: (row: VoterListRow) => string;
};

export const voterListExportColumns: VoterListExportColumn[] = [
  { header: "NAMA", value: (r) => r.nama },
  { header: "IC", value: (r) => r.ic },
  { header: "JANTINA", value: (r) => r.jantina },
  { header: "KAUM", value: (r) => r.bangsa },
  { header: "AGAMA", value: (r) => r.agama },
  { header: "UMUR", value: (r) => String(r.age) },
  { header: "NEGERI", value: (r) => r.negeri },
  { header: "PARLIMEN", value: (r) => r.parlimen },
  { header: "DUN", value: (r) => r.dun },
  { header: "DM", value: (r) => r.dm },
  { header: "LOKALITI", value: (r) => r.lokaliti },
  { header: "SIKAP", value: (r) => r.sikap },
  { header: "PARTI", value: (r) => r.parti },
];

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(rows: VoterListRow[], columns: VoterListExportColumn[]) {
  const header = columns.map((c) => escapeCsv(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((col) => escapeCsv(col.value(row))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function voterRowsToCsv(rows: VoterListRow[]) {
  return rowsToCsv(rows, voterListExportColumns);
}

export function downloadVoterCsv(filename: string, rows: VoterListRow[]) {
  downloadTextFile(filename, voterRowsToCsv(rows));
}

export function downloadVoterExcel(filename: string, rows: VoterListRow[]) {
  downloadTextFile(
    filename.endsWith(".xls") ? filename : `${filename}.xls`,
    voterRowsToCsv(rows),
    "application/vnd.ms-excel;charset=utf-8;",
  );
}

export async function copyVoterRows(rows: VoterListRow[]) {
  const text = [
    voterListExportColumns.map((c) => c.header).join("\t"),
    ...rows.map((row) =>
      voterListExportColumns.map((col) => col.value(row)).join("\t"),
    ),
  ].join("\n");
  await navigator.clipboard.writeText(text);
}

export function printVoterTable(title: string, rows: VoterListRow[]) {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; margin: 24px; }
          h1 { font-size: 16px; margin-bottom: 8px; }
          p { color: #666; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; }
          th { background: #eef2f7; text-transform: uppercase; font-size: 9px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${rows.length} rekod</p>
        <table>
          <thead>
            <tr>${voterListExportColumns.map((c) => `<th>${c.header}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) =>
                  `<tr>${voterListExportColumns
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

export function slugifyFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
