// ─── Bank CSV Parsers for Swedish Banks ─────────────────────────────────────

export interface BankTransaction {
  date: string; // "YYYY-MM-DD"
  description: string;
  amount: number;
  balance?: number;
}

export type BankFormat = "seb" | "nordea" | "swedbank" | "unknown";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Strip UTF-8 BOM if present */
function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

/** Parse a Swedish-formatted number: remove spaces, replace comma with dot */
function parseSwedishNumber(raw: string): number {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalize a date string to YYYY-MM-DD.
 * Accepts: YYYY-MM-DD, YY-MM-DD, DD.MM.YYYY
 */
function normalizeDate(raw: string): string {
  const trimmed = raw.trim();

  // DD.MM.YYYY
  const dotMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotMatch) {
    return `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
  }

  // YY-MM-DD (2-digit year)
  const shortYearMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1], 10);
    const fullYear = year >= 70 ? 1900 + year : 2000 + year;
    return `${fullYear}-${shortYearMatch[2]}-${shortYearMatch[3]}`;
  }

  // Already YYYY-MM-DD (or close enough)
  return trimmed;
}

/** Split a CSV line by separator, respecting quoted fields */
function splitLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === separator && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Detect the separator used in a line (semicolon, tab, or comma) */
function detectSeparator(headerLine: string): string {
  if (headerLine.includes(";")) return ";";
  if (headerLine.includes("\t")) return "\t";
  if (headerLine.includes(",")) return ",";
  return ";"; // default fallback
}

/** Get non-empty lines from content, stripping BOM and carriage returns */
function getLines(content: string): string[] {
  return stripBom(content)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
}

// ─── Format Detection ───────────────────────────────────────────────────────

export function detectBankFormat(content: string): BankFormat {
  const lines = getLines(content);
  // Check first few lines for characteristic headers
  const headerArea = lines.slice(0, 5).join(" ").toLowerCase();

  // SEB: "bokföringsdatum" or header starting with "datum"
  if (
    headerArea.includes("bokföringsdatum") ||
    /\bdatum\b.*\btext\/mottagare\b/.test(headerArea) ||
    /\bdatum\b.*\bbelopp\b.*\bsaldo\b/.test(headerArea)
  ) {
    // Make sure it's not Nordea (which also can have "datum")
    if (
      !headerArea.includes("bokföringsdag") &&
      !headerArea.includes("avsändare/mottagare")
    ) {
      return "seb";
    }
  }

  // Nordea: "bokföringsdag" or "avsändare/mottagare"
  if (
    headerArea.includes("bokföringsdag") ||
    headerArea.includes("avsändare/mottagare")
  ) {
    return "nordea";
  }

  // Swedbank: "transaktionsdag" or "clnr"
  if (headerArea.includes("transaktionsdag") || headerArea.includes("clnr")) {
    return "swedbank";
  }

  // Fallback: try SEB-like if we see "datum" and "belopp"
  if (headerArea.includes("datum") && headerArea.includes("belopp")) {
    return "seb";
  }

  return "unknown";
}

// ─── SEB Parser ─────────────────────────────────────────────────────────────

function parseSeb(lines: string[]): BankTransaction[] {
  const transactions: BankTransaction[] = [];

  // Find header line
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase();
    if (
      lower.includes("bokföringsdatum") ||
      (lower.includes("datum") && lower.includes("belopp"))
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return transactions;

  const separator = detectSeparator(lines[headerIdx]);
  const headers = splitLine(lines[headerIdx], separator).map((h) =>
    h.toLowerCase()
  );

  // Find column indices
  const dateCol = headers.findIndex(
    (h) => h.includes("bokföringsdatum") || h === "datum"
  );
  const descCol = headers.findIndex(
    (h) =>
      h.includes("text/mottagare") ||
      h.includes("text") ||
      h.includes("mottagare") ||
      h.includes("beskrivning")
  );
  const amountCol = headers.findIndex((h) => h.includes("belopp"));
  const balanceCol = headers.findIndex((h) => h.includes("saldo"));

  if (dateCol === -1 || amountCol === -1) return transactions;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const fields = splitLine(lines[i], separator);
    if (fields.length <= Math.max(dateCol, amountCol)) continue;

    const rawDate = fields[dateCol];
    if (!rawDate || rawDate.trim().length === 0) continue;

    const date = normalizeDate(rawDate);
    const description =
      descCol >= 0 && descCol < fields.length ? fields[descCol] : "";
    const amount = parseSwedishNumber(fields[amountCol]);
    const balance =
      balanceCol >= 0 && balanceCol < fields.length
        ? parseSwedishNumber(fields[balanceCol])
        : undefined;

    transactions.push({
      date,
      description: description.replace(/^"|"$/g, ""),
      amount,
      ...(balance !== undefined ? { balance } : {}),
    });
  }

  return transactions;
}

// ─── Nordea Parser ──────────────────────────────────────────────────────────

function parseNordea(lines: string[]): BankTransaction[] {
  const transactions: BankTransaction[] = [];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("bokföringsdag") || lower.includes("belopp")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return transactions;

  const separator = detectSeparator(lines[headerIdx]);
  const headers = splitLine(lines[headerIdx], separator).map((h) =>
    h.toLowerCase()
  );

  const dateCol = headers.findIndex(
    (h) => h.includes("bokföringsdag") || h === "datum"
  );
  const amountCol = headers.findIndex((h) => h.includes("belopp"));
  const descCol = headers.findIndex(
    (h) =>
      h.includes("avsändare/mottagare") ||
      h.includes("mottagare") ||
      h.includes("rubrik") ||
      h.includes("text")
  );
  const balanceCol = headers.findIndex((h) => h.includes("saldo"));

  if (dateCol === -1 || amountCol === -1) return transactions;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const fields = splitLine(lines[i], separator);
    if (fields.length <= Math.max(dateCol, amountCol)) continue;

    const rawDate = fields[dateCol];
    if (!rawDate || rawDate.trim().length === 0) continue;

    const date = normalizeDate(rawDate);
    const description =
      descCol >= 0 && descCol < fields.length ? fields[descCol] : "";
    const amount = parseSwedishNumber(fields[amountCol]);
    const balance =
      balanceCol >= 0 && balanceCol < fields.length
        ? parseSwedishNumber(fields[balanceCol])
        : undefined;

    transactions.push({
      date,
      description: description.replace(/^"|"$/g, ""),
      amount,
      ...(balance !== undefined ? { balance } : {}),
    });
  }

  return transactions;
}

// ─── Swedbank Parser ────────────────────────────────────────────────────────

function parseSwedbank(lines: string[]): BankTransaction[] {
  const transactions: BankTransaction[] = [];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("transaktionsdag") || lower.includes("clnr")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return transactions;

  const separator = detectSeparator(lines[headerIdx]);
  const headers = splitLine(lines[headerIdx], separator).map((h) =>
    h.toLowerCase()
  );

  // Swedbank columns: Clnr;Kontotyp;Kontonr;Transaktionsdag;Text;Belopp;Saldo
  const dateCol = headers.findIndex((h) => h.includes("transaktionsdag"));
  const descCol = headers.findIndex(
    (h) => h === "text" || h.includes("text") || h.includes("beskrivning")
  );
  const amountCol = headers.findIndex((h) => h.includes("belopp"));
  const balanceCol = headers.findIndex((h) => h.includes("saldo"));

  if (dateCol === -1 || amountCol === -1) return transactions;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const fields = splitLine(lines[i], separator);
    if (fields.length <= Math.max(dateCol, amountCol)) continue;

    const rawDate = fields[dateCol];
    if (!rawDate || rawDate.trim().length === 0) continue;

    const date = normalizeDate(rawDate);
    const description =
      descCol >= 0 && descCol < fields.length ? fields[descCol] : "";
    const amount = parseSwedishNumber(fields[amountCol]);
    const balance =
      balanceCol >= 0 && balanceCol < fields.length
        ? parseSwedishNumber(fields[balanceCol])
        : undefined;

    transactions.push({
      date,
      description: description.replace(/^"|"$/g, ""),
      amount,
      ...(balance !== undefined ? { balance } : {}),
    });
  }

  return transactions;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Parse a bank CSV file. Auto-detects format if not provided.
 * Supports SEB, Nordea, and Swedbank CSV exports.
 */
export function parseBankCsv(
  content: string,
  format?: BankFormat
): BankTransaction[] {
  const detected = format ?? detectBankFormat(content);
  const lines = getLines(content);

  if (lines.length === 0) return [];

  switch (detected) {
    case "seb":
      return parseSeb(lines);
    case "nordea":
      return parseNordea(lines);
    case "swedbank":
      return parseSwedbank(lines);
    case "unknown":
      // Try SEB first (most generic), then Nordea, then Swedbank
      for (const parser of [parseSeb, parseNordea, parseSwedbank]) {
        const result = parser(lines);
        if (result.length > 0) return result;
      }
      return [];
  }
}
