import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, isNull } from "drizzle-orm";
import { Resend } from "resend";
import { getAuth } from "@clerk/express";
import { db, contactsTable } from "@workspace/db";
import { logger } from "../lib/logger";

async function getClerkUser(userId: string): Promise<{ email: string; firstName: string }> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not configured");
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) throw new Error(`Clerk API error: ${res.status}`);
  const user = await res.json() as {
    email_addresses: Array<{ id: string; email_address: string }>;
    primary_email_address_id: string;
    first_name: string | null;
  };
  const email = user.email_addresses.find((e) => e.id === user.primary_email_address_id)?.email_address ?? "";
  if (!email) throw new Error("No primary email found for user");
  const firstName = user.first_name ?? email.split("@")[0];
  return { email, firstName };
}

const router: IRouter = Router();

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = auth.userId;
  next();
}

function getUserId(req: Request): string {
  return (req as any).userId as string;
}

function defaultIntervalDays(tier: string): number {
  if (tier === "core") return 21;
  if (tier === "monthly") return 60;
  return 365;
}

async function buildAndSendDigest(userId: string, userEmail: string, userName: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.DIGEST_FROM_EMAIL ?? "digest@social-circle.app";

  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.userId, userId) && isNull(contactsTable.archivedAt) as any);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekLaterStr = weekLater.toISOString().slice(0, 10);

  const overdue = contacts
    .filter((c) => c.nextContactDate != null && c.nextContactDate < todayStr)
    .sort((a, b) => (a.nextContactDate ?? "").localeCompare(b.nextContactDate ?? ""));

  const dueThisWeek = contacts
    .filter((c) => c.nextContactDate != null && c.nextContactDate >= todayStr && c.nextContactDate <= weekLaterStr)
    .sort((a, b) => (a.nextContactDate ?? "").localeCompare(b.nextContactDate ?? ""));

  const year = today.getFullYear();
  const upcoming30Days = contacts
    .filter((c): c is typeof c & { birthday: string } => c.birthday != null)
    .map((c) => {
      const [, mm, dd] = c.birthday.split("-");
      let bday = new Date(year, parseInt(mm) - 1, parseInt(dd));
      if (bday < today) bday = new Date(year + 1, parseInt(mm) - 1, parseInt(dd));
      const daysUntil = Math.round((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...c, daysUntil, birthdayDisplay: bday.toLocaleDateString(undefined, { month: "long", day: "numeric" }) };
    })
    .filter((c) => c.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const row = (name: string, detail: string, urgency?: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0ebe4;">
        <strong style="color:#2c2318;">${name}</strong>
        <span style="color:#8c7b6e;font-size:13px;margin-left:8px;">${detail}</span>
      </td>
      ${urgency ? `<td style="padding:10px 0;border-bottom:1px solid #f0ebe4;text-align:right;font-size:12px;color:#c0714a;">${urgency}</td>` : "<td></td>"}
    </tr>`;

  const section = (title: string, rows: string, emptyMsg: string) =>
    rows
      ? `<h3 style="font-family:Georgia,serif;color:#2c2318;margin:28px 0 8px;">${title}</h3><table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
      : `<h3 style="font-family:Georgia,serif;color:#2c2318;margin:28px 0 8px;">${title}</h3><p style="color:#8c7b6e;font-size:14px;">${emptyMsg}</p>`;

  const overdueRows = overdue.map((c) => row(c.name, c.relationshipType, "Overdue")).join("");
  const weekRows = dueThisWeek.map((c) => {
    const d = new Date(c.nextContactDate! + "T00:00:00");
    return row(c.name, c.relationshipType, d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }));
  }).join("");
  const bdayRows = upcoming30Days.map((c) =>
    row(c.name, c.birthdayDisplay, c.daysUntil === 0 ? "Today! 🎉" : c.daysUntil === 1 ? "Tomorrow" : `In ${c.daysUntil} days`)
  ).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:Inter,system-ui,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #e8e0d8;overflow:hidden;">
    <div style="background:#c0714a;padding:28px 32px;">
      <h1 style="font-family:Georgia,serif;color:#fff;margin:0;font-size:22px;">Social Circle — Weekly Digest</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">Hi ${userName}! Here's your relationship check-in for the week.</p>
    </div>
    <div style="padding:24px 32px 32px;">
      ${section("⚠️ Overdue", overdueRows, "No overdue contacts — great job keeping up!")}
      ${section("📅 Due This Week", weekRows, "No follow-ups due this week.")}
      ${upcoming30Days.length > 0 ? section("🎂 Upcoming Birthdays (30 days)", bdayRows, "") : ""}
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f0ebe4;text-align:center;">
        <a href="${process.env.APP_URL ?? "https://socialcircle.app"}" style="display:inline-block;background:#c0714a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open Social Circle</a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#faf8f5;text-align:center;font-size:12px;color:#8c7b6e;">
      Made by <a href="https://naas.work" style="color:#c0714a;">naas.work</a> with <a href="https://replit.com" style="color:#c0714a;">Replit</a>
    </div>
  </div>
</body>
</html>`;

  const resend = new Resend(resendKey);
  await resend.emails.send({
    from: fromEmail,
    to: userEmail,
    subject: `Social Circle — Your weekly relationship digest`,
    html,
  });
}

// POST /digest — authenticated user triggers digest for themselves
router.post("/digest", requireAuth, wrap(async (req, res) => {
  const userId = getUserId(req);
  const { email, firstName } = await getClerkUser(userId);
  await buildAndSendDigest(userId, email, firstName);
  res.json({ sent: true, to: email });
}));

// POST /digest/cron — called by a cron job, protected by CRON_SECRET header
router.post("/digest/cron", wrap(async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers["x-cron-secret"] !== cronSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rows = await db
    .selectDistinct({ userId: contactsTable.userId })
    .from(contactsTable);

  let sent = 0;
  let errors = 0;

  for (const { userId } of rows) {
    try {
      const { email, firstName } = await getClerkUser(userId);
      await buildAndSendDigest(userId, email, firstName);
      sent++;
    } catch (err) {
      logger.error({ err, userId }, "Failed to send digest");
      errors++;
    }
  }

  res.json({ sent, errors, total: rows.length });
}));

export default router;
