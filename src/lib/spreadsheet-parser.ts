import * as XLSX from "xlsx";
import { MAX_BYTES, MAX_ROWS, MAX_COLUMNS, ParsedFile } from "./lead-import";
import { normalized } from "./crm";
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error("Malformed CSV quoting.");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        rows.push(row);
        row = [];
        if (rows.length > MAX_ROWS + 1)
          throw new Error(`Maximum ${MAX_ROWS} rows.`);
      }
    } else {
      if (closed) throw new Error("Unexpected text after a quoted CSV value.");
      cell += c;
    }
    if (cell.length > 10000)
      throw new Error("A cell exceeds 10,000 characters.");
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (cell || row.length || closed) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export function parseFile(buffer: ArrayBuffer, filename: string): ParsedFile {
  if (!buffer.byteLength || buffer.byteLength > MAX_BYTES)
    throw new Error("Choose a non-empty file no larger than 5 MB.");
  const extension = filename.split(".").at(-1)?.toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(extension ?? ""))
    throw new Error("Supported formats: CSV, XLSX and XLS.");
  let grid: string[][];
  let sheetName = "CSV";
  const formulaRows: number[] = [];
  if (extension === "csv") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    if (text.includes("\0")) throw new Error("CSV must be UTF-8 text.");
    grid = parseCsv(text);
  } else {
    const bytes = new Uint8Array(buffer);
    if (extension === "xlsx" && (bytes[0] !== 0x50 || bytes[1] !== 0x4b))
      throw new Error("Invalid XLSX file signature.");
    if (extension === "xls" && !(bytes[0] === 0xd0 && bytes[1] === 0xcf))
      throw new Error("Use a genuine Excel 97–2003 XLS workbook.");
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      cellFormula: true,
      sheetRows: MAX_ROWS + 2,
      cellHTML: false,
      bookVBA: false,
    });
    sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!ref"]) throw new Error("The first worksheet is empty.");
    const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
    if (range.e.r > MAX_ROWS || range.e.c >= MAX_COLUMNS)
      throw new Error(
        `Maximum ${MAX_ROWS} data rows and ${MAX_COLUMNS} columns, starting at A1.`,
      );
    grid = [];
    for (let r = 0; r <= range.e.r; r++) {
      const row: string[] = [];
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell?.f) formulaRows.push(r + 1);
        const value = cell?.v;
        row.push(
          value instanceof Date
            ? value.toISOString()
            : value == null
              ? ""
              : String(value),
        );
      }
      grid.push(row);
    }
  }
  if (grid.length < 2)
    throw new Error("Include a header row and at least one data row.");
  const headers = grid.shift()!.map((v) => v.trim());
  if (headers.length > MAX_COLUMNS || grid.length > MAX_ROWS)
    throw new Error(`Limit: ${MAX_COLUMNS} columns and ${MAX_ROWS} rows.`);
  if (
    headers.some((h) => !h) ||
    new Set(headers.map(normalized)).size !== headers.length
  )
    throw new Error("Column headings must be non-empty and unique.");
  if (formulaRows.includes(1))
    throw new Error("Formula column headings are not supported.");
  if (grid.some((r) => r.length > headers.length))
    throw new Error("A row has more cells than the header.");
  if (grid.some((r) => r.some((v) => v.length > 10000)))
    throw new Error("A cell exceeds 10,000 characters.");
  return {
    headers,
    rows: grid.map((r) =>
      headers.map((_, i) =>
        (r[i] ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""),
      ),
    ),
    sheetName,
    formulaRows,
  };
}
