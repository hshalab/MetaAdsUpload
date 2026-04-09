// SIE4 Parser for Swedish accounting files
// SIE4 format reference: https://sie.se/

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SieFile {
  accounts: Map<string, string>; // account number -> name
  fiscalYears: { from: string; to: string }[];
  vouchers: SieVoucher[];
}

export interface SieVoucher {
  series: string; // "A", "B", etc.
  number: number;
  date: string; // YYYYMMDD
  description: string;
  transactions: SieTransaction[];
}

export interface SieTransaction {
  account: string; // "1930"
  amount: number; // positive = debit, negative = credit
  description?: string;
}

export interface SieValidationError {
  voucher?: string; // e.g. "A 123"
  message: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Tokenise a single SIE line into fields, respecting quoted strings.
 *
 * Example:
 *   `#VER A 123 20250115 "Invoice payment"`
 *   -> ["#VER", "A", "123", "20250115", "Invoice payment"]
 *
 * Curly-brace groups like `{}` or `{1 2}` are returned as a single token
 * including the braces so callers can recognise dimension fields.
 */
function tokeniseLine(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < line.length) {
    // Skip whitespace
    if (line[i] === " " || line[i] === "\t") {
      i++;
      continue;
    }

    // Quoted string
    if (line[i] === '"') {
      i++; // skip opening quote
      let value = "";
      while (i < line.length && line[i] !== '"') {
        value += line[i];
        i++;
      }
      if (i < line.length) i++; // skip closing quote
      tokens.push(value);
      continue;
    }

    // Curly-brace group (dimensions)
    if (line[i] === "{") {
      let depth = 0;
      let value = "";
      while (i < line.length) {
        if (line[i] === "{") depth++;
        if (line[i] === "}") depth--;
        value += line[i];
        i++;
        if (depth === 0) break;
      }
      tokens.push(value);
      continue;
    }

    // Plain token (unquoted, no braces)
    let value = "";
    while (
      i < line.length &&
      line[i] !== " " &&
      line[i] !== "\t" &&
      line[i] !== '"' &&
      line[i] !== "{" &&
      line[i] !== "}"
    ) {
      value += line[i];
      i++;
    }
    if (value.length > 0) {
      tokens.push(value);
    }
  }

  return tokens;
}

/**
 * Strip an optional leading `#` from a directive token and return
 * the uppercase directive name.
 */
function directiveName(token: string): string {
  return token.startsWith("#") ? token.slice(1).toUpperCase() : token.toUpperCase();
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse raw SIE4 text content into a structured `SieFile`.
 *
 * The parser is intentionally lenient: unknown directives are silently
 * skipped, and minor formatting variations (e.g. `{` on the same line as
 * `#VER` or on a separate line) are handled.
 */
export function parseSie(content: string): SieFile {
  // Normalise line endings
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  const accounts: Map<string, string> = new Map();
  const fiscalYears: { from: string; to: string }[] = [];
  const vouchers: SieVoucher[] = [];

  let currentVoucher: SieVoucher | null = null;
  let insideVerBlock = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx].trim();

    // Skip empty lines
    if (raw.length === 0) continue;

    // ----- Block delimiters -----

    // A standalone `{` opens the transaction list of the current voucher
    if (raw === "{") {
      if (currentVoucher) {
        insideVerBlock = true;
      }
      continue;
    }

    // A standalone `}` closes the current VER block
    if (raw === "}") {
      if (currentVoucher) {
        vouchers.push(currentVoucher);
        currentVoucher = null;
        insideVerBlock = false;
      }
      continue;
    }

    // ----- Directive lines -----
    if (raw.startsWith("#")) {
      const tokens = tokeniseLine(raw);
      if (tokens.length === 0) continue;

      const directive = directiveName(tokens[0]);

      switch (directive) {
        case "KONTO": {
          // #KONTO accountNumber "Account Name"
          if (tokens.length >= 3) {
            accounts.set(tokens[1], tokens[2]);
          }
          break;
        }

        case "RAR": {
          // #RAR index fromDate toDate
          if (tokens.length >= 4) {
            fiscalYears.push({ from: tokens[2], to: tokens[3] });
          }
          break;
        }

        case "VER": {
          // #VER series number date "description" [possible { on same line]
          //
          // Minimal: #VER A 123 20250115
          // Full:    #VER A 123 20250115 "Beskrivning" {
          const series = tokens.length > 1 ? tokens[1] : "";
          const number = tokens.length > 2 ? parseInt(tokens[2], 10) : 0;
          const date = tokens.length > 3 ? tokens[3] : "";
          // Description is the first non-brace token at position 4
          let description = "";
          if (tokens.length > 4) {
            // The description may be at index 4 — but if `{` appeared
            // on the same line it will also be a token. Skip brace tokens.
            for (let t = 4; t < tokens.length; t++) {
              if (tokens[t] === "{" || tokens[t] === "}") continue;
              if (!description) {
                description = tokens[t];
              }
            }
          }

          currentVoucher = {
            series,
            number: isNaN(number) ? 0 : number,
            date,
            description,
            transactions: [],
          };

          // Check if `{` appeared on the same line
          if (raw.includes("{")) {
            insideVerBlock = true;
            // If the line also contains `}` it is a self-closing VER
            // (extremely rare, but handle it).
            if (raw.indexOf("}") > raw.indexOf("{")) {
              // Parse any inline #TRANS between { and }
              // This is unusual, so we just finalise the voucher.
              vouchers.push(currentVoucher);
              currentVoucher = null;
              insideVerBlock = false;
            }
          }
          break;
        }

        case "TRANS": {
          // #TRANS account dimensions amount [date] [description]
          // dimensions is something like {} or {1 "Cost centre"}
          if (currentVoucher && tokens.length >= 4) {
            const account = tokens[1];
            // tokens[2] is the dimensions field (curly braces) — skip it
            const amount = parseFloat(tokens[3]);

            // Optional description — after amount there may be a date
            // and then a description, or just a description.
            let transDescription: string | undefined;
            for (let t = 4; t < tokens.length; t++) {
              // If this token looks like a date (8 digits), skip it
              if (/^\d{8}$/.test(tokens[t])) continue;
              // Otherwise treat it as the description
              if (tokens[t] && tokens[t] !== "{" && tokens[t] !== "}") {
                transDescription = tokens[t];
                break;
              }
            }

            currentVoucher.transactions.push({
              account,
              amount: isNaN(amount) ? 0 : amount,
              ...(transDescription !== undefined && { description: transDescription }),
            });
          }
          break;
        }

        default:
          // Unknown directive — skip gracefully
          break;
      }

      continue;
    }

    // Lines inside a VER block that don't start with # are ignored
    // (could be comments or empty dimension lines).
  }

  // Edge case: if the file ends without a closing `}` for an open voucher,
  // include it anyway to avoid silent data loss.
  if (currentVoucher) {
    vouchers.push(currentVoucher);
  }

  return { accounts, fiscalYears, vouchers };
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a parsed SIE file and return a list of errors.
 *
 * Checks performed:
 * 1. Each voucher's transactions sum to approximately zero (tolerance +/-0.01).
 * 2. Every transaction account exists in the chart of accounts.
 * 3. Voucher dates fall within a defined fiscal year (if any fiscal years
 *    are present in the file).
 */
export function validateSie(file: SieFile): SieValidationError[] {
  const errors: SieValidationError[] = [];

  for (const voucher of file.vouchers) {
    const voucherId = `${voucher.series} ${voucher.number}`;

    // 1. Balance check
    const sum = voucher.transactions.reduce((acc, tx) => acc + tx.amount, 0);
    if (Math.abs(sum) > 0.01) {
      errors.push({
        voucher: voucherId,
        message: `Voucher does not balance: sum is ${sum.toFixed(2)} (expected 0.00)`,
      });
    }

    // 2. Account existence check
    for (const tx of voucher.transactions) {
      if (!file.accounts.has(tx.account)) {
        errors.push({
          voucher: voucherId,
          message: `Account ${tx.account} is not defined in the chart of accounts`,
        });
      }
    }

    // 3. Date within fiscal year check
    if (file.fiscalYears.length > 0 && voucher.date) {
      const dateNum = parseInt(voucher.date, 10);
      const withinAnyYear = file.fiscalYears.some((fy) => {
        const from = parseInt(fy.from, 10);
        const to = parseInt(fy.to, 10);
        return dateNum >= from && dateNum <= to;
      });

      if (!withinAnyYear) {
        errors.push({
          voucher: voucherId,
          message: `Date ${voucher.date} is outside all defined fiscal years`,
        });
      }
    }
  }

  return errors;
}
