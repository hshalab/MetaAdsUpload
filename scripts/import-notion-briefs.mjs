#!/usr/bin/env node
// ─── Notion → MetaAdsUpload brief importer ───────────────────────────────────
// Usage:
//   1. In Notion: open your briefs database → ⋯ → Export → CSV
//   2. node scripts/import-notion-briefs.mjs path/to/export.csv --dry-run
//   3. node scripts/import-notion-briefs.mjs path/to/export.csv
//
// Column mapping (case-insensitive; adjust MAPPING below to your columns):
//   Name/Title → title · Brief/Description/Content → briefContent
//   Batch → batchNumber · Editor (email or name) → assignedToId lookup
//   Due/Deadline → dueDate · Priority → priority · Links/References → references
//
// Requires DATABASE_URL in env (same as the app).

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const MAPPING = {
  title: ["name", "title", "brief"],
  briefContent: ["content", "description", "brief text", "details"],
  batchNumber: ["batch", "batch number", "batch #"],
  editor: ["editor", "assigned to", "assignee"],
  dueDate: ["due", "due date", "deadline"],
  priority: ["priority"],
  references: ["links", "references", "inspiration"],
};

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

function pick(headers, names) {
  const idx = headers.findIndex((h) => names.includes(h.toLowerCase().trim()));
  return idx === -1 ? null : idx;
}

const [, , csvPath, flag] = process.argv;
if (!csvPath) { console.error("Usage: node scripts/import-notion-briefs.mjs <export.csv> [--dry-run]"); process.exit(1); }
const dryRun = flag === "--dry-run";
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl && !dryRun) { console.error("DATABASE_URL not set"); process.exit(1); }

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const headers = rows.shift();
const col = Object.fromEntries(Object.entries(MAPPING).map(([k, names]) => [k, pick(headers, names)]));
console.log("Detected columns:", col);

const sql = dryRun ? null : neon(dbUrl);
let admin = null, editorsByKey = new Map();
if (!dryRun) {
  const users = await sql`SELECT id, name, email, role FROM users WHERE is_active = true`;
  admin = users.find((u) => u.role === "admin");
  if (!admin) { console.error("No active admin user found"); process.exit(1); }
  for (const u of users) {
    editorsByKey.set(u.email.toLowerCase(), u.id);
    editorsByKey.set(u.name.toLowerCase(), u.id);
  }
}

let imported = 0, skipped = 0;
for (const r of rows) {
  const get = (k) => (col[k] != null ? (r[col[k]] || "").trim() : "");
  const title = get("title");
  if (!title) { skipped++; continue; }
  const editorKey = get("editor").toLowerCase();
  const briefContent = get("briefContent") || null;
  const batch = parseInt(get("batchNumber"), 10);
  const due = get("dueDate") ? new Date(get("dueDate")) : null;
  const priority = ["low", "medium", "high", "urgent"].includes(get("priority").toLowerCase()) ? get("priority").toLowerCase() : "medium";
  const references = get("references")
    ? get("references").split(/[\s,]+/).filter((s) => s.startsWith("http")).map((url) => ({ id: randomUUID(), kind: "url", value: url }))
    : [];

  if (dryRun) {
    console.log(`[dry] ${title} · batch=${Number.isFinite(batch) ? batch : "?"} · editor=${editorKey || "-"} · refs=${references.length}`);
    imported++;
    continue;
  }

  const assignedToId = editorsByKey.get(editorKey) || admin.id;
  await sql`
    INSERT INTO assignments (id, title, description, brief_content, "references", batch_number, version,
      assigned_to_id, assigned_by_id, status, priority, due_date, auto_name, customer_avatar_ids, created_at, updated_at)
    VALUES (${randomUUID()}, ${title}, NULL, ${briefContent}, ${JSON.stringify(references)}::jsonb,
      ${Number.isFinite(batch) ? batch : 0}, 1, ${assignedToId}, ${admin.id}, 'draft', ${priority},
      ${due && !isNaN(due) ? due.toISOString() : null}, ${title}, '[]'::jsonb, now(), now())
  `;
  imported++;
}
console.log(`${dryRun ? "[dry-run] " : ""}Imported ${imported}, skipped ${skipped} (no title). Imported briefs land as status='draft' for review.`);
