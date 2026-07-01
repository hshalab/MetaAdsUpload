import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

// ─── WhatsApp notifications (Meta WhatsApp Business Cloud API) ───────────────
// Activates when env vars are set — otherwise every call is a silent no-op,
// so the app works fine before WhatsApp is configured.
//
// Required env:
//   WHATSAPP_ACCESS_TOKEN     — System User token with whatsapp_business_messaging
//   WHATSAPP_PHONE_NUMBER_ID  — the sender phone number ID from WhatsApp Manager
// Optional:
//   WHATSAPP_ADMIN_PHONE      — E.164 number that receives admin notifications
//
// NOTE on the 24h rule: free-form text messages only deliver inside an open
// 24h customer-service window (i.e. the editor messaged you recently).
// Business-initiated messages outside the window need an approved TEMPLATE.
// Create a template named "task_update" with one body variable ({{1}}) in
// WhatsApp Manager; we automatically fall back to it when free text fails.

const WA_API_VERSION = "v21.0";

function waConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function waPost(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(
    `https://graph.facebook.com/${WA_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: (data as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}` };
}

/** Send a WhatsApp message; tries free text, falls back to the task_update template. */
export async function sendWhatsApp(toE164: string, text: string): Promise<void> {
  if (!waConfigured() || !toE164) return;
  try {
    const to = toE164.replace(/[^\d+]/g, "");
    const freeText = await waPost({ messaging_product: "whatsapp", to, type: "text", text: { body: text } });
    if (freeText.ok) return;

    // Outside the 24h window → template fallback
    const tpl = await waPost({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: "task_update",
        language: { code: "en" },
        components: [{ type: "body", parameters: [{ type: "text", text: text.slice(0, 1000) }] }],
      },
    });
    if (!tpl.ok) console.warn(`WhatsApp send failed to ${to}: ${tpl.error}`);
  } catch (e) {
    console.warn("WhatsApp send error:", e instanceof Error ? e.message : e);
  }
}

async function phoneForUser(userId: string): Promise<string | null> {
  const [user] = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return user?.phone ?? null;
}

export type AssignmentEvent =
  | "assigned"
  | "revision_requested"
  | "version_uploaded"
  | "completed"
  | "publish_failed";

/**
 * Fire-and-forget notification for assignment lifecycle events.
 * Never throws — a notification failure must not break the workflow.
 */
export async function notifyAssignmentEvent(
  event: AssignmentEvent,
  assignment: { id: string; title?: string | null; autoName?: string | null; assignedToId?: string | null; dueDate?: Date | string | null }
): Promise<void> {
  if (!waConfigured()) return;
  try {
    const name = assignment.autoName || assignment.title || assignment.id;
    const due = assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 10) : null;

    if (event === "assigned" || event === "revision_requested") {
      // → editor
      if (!assignment.assignedToId) return;
      const phone = await phoneForUser(assignment.assignedToId);
      if (!phone) return;
      const msg =
        event === "assigned"
          ? `🎬 New assignment: ${name}${due ? ` — due ${due}` : ""}. Open My Work to start.`
          : `✏️ Revision requested on: ${name}. Check the feedback in My Work.`;
      await sendWhatsApp(phone, msg);
      return;
    }

    // → admin
    const adminPhone = process.env.WHATSAPP_ADMIN_PHONE;
    if (!adminPhone) return;
    const msg =
      event === "version_uploaded"
        ? `📥 New version uploaded: ${name} — ready for review.`
        : event === "completed"
          ? `✅ Completed: ${name}.`
          : `⚠️ Publish to Meta FAILED for: ${name}. Check the upload log.`;
    await sendWhatsApp(adminPhone, msg);
  } catch (e) {
    console.warn("notifyAssignmentEvent error:", e instanceof Error ? e.message : e);
  }
}
