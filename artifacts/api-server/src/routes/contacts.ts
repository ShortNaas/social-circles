import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, asc, and } from "drizzle-orm";
import crypto from "crypto";
import { getAuth } from "@clerk/express";
import { db, contactsTable } from "@workspace/db";
import {
  ListContactsQueryParams,
  CreateContactBody,
  UpdateContactBody,
  GetContactParams,
  UpdateContactParams,
  DeleteContactParams,
  TouchContactParams,
  GetContactCalendarParams,
  GetContactStatsResponse,
  GetDueContactsResponse,
  ListContactsResponse,
  GetContactResponse,
  UpdateContactResponse,
  TouchContactResponse,
  GetCalendarTokenResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}

function getUserId(req: Request): string {
  return (req as any).userId as string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultIntervalDays(tier: string): number {
  if (tier === "core") return 21;
  if (tier === "monthly") return 60;
  return 365;
}

function calcNextContactDate(intervalDays: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + intervalDays);
  return d.toISOString().slice(0, 10);
}

function intervalLabel(tier: string, intervalDays: number | null): string {
  const days = intervalDays ?? defaultIntervalDays(tier);
  if (days < 30) return `every ${days === 7 ? "1 week" : days === 14 ? "2 weeks" : "3 weeks"}`;
  if (days < 180) {
    const months = Math.round(days / 30);
    return `every ${months} month${months > 1 ? "s" : ""}`;
  }
  if (days < 365) return "every 6 months";
  return "every year";
}

function getCalendarFeedToken(userId: string): string {
  const secret = process.env.SESSION_SECRET ?? "dev-fallback-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`social-circle-calendar-feed-v2:${userId}`)
    .digest("hex")
    .slice(0, 40);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /contacts
router.get("/contacts", requireAuth, async (req, res): Promise<void> => {
  const query = ListContactsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { tier, overdue } = query.data;
  const today = new Date().toISOString().slice(0, 10);
  const userId = getUserId(req);

  let contacts = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.userId, userId))
    .orderBy(asc(contactsTable.nextContactDate), asc(contactsTable.name));

  if (tier) contacts = contacts.filter((c) => c.tier === tier);
  if (overdue) contacts = contacts.filter((c) => c.nextContactDate != null && c.nextContactDate <= today);

  res.json(ListContactsResponse.parse(contacts));
});

// POST /contacts
router.post("/contacts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lastContactDate, tier, intervalDays } = parsed.data;
  const effectiveInterval = intervalDays ?? defaultIntervalDays(tier);
  const nextContactDate = lastContactDate
    ? calcNextContactDate(effectiveInterval, new Date(lastContactDate))
    : calcNextContactDate(effectiveInterval);

  const [contact] = await db
    .insert(contactsTable)
    .values({
      ...parsed.data,
      userId: getUserId(req),
      intervalDays: intervalDays ?? null,
      lastContactDate: lastContactDate ?? null,
      nextContactDate,
    })
    .returning();

  res.status(201).json(GetContactResponse.parse(contact));
});

// GET /contacts/stats
router.get("/contacts/stats", requireAuth, async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const userId = getUserId(req);

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.userId, userId));

  const core = contacts.filter((c) => c.tier === "core").length;
  const monthly = contacts.filter((c) => c.tier === "monthly").length;
  const yearly = contacts.filter((c) => c.tier === "yearly").length;
  const overdueCount = contacts.filter((c) => c.nextContactDate != null && c.nextContactDate <= today).length;
  const dueThisWeek = contacts.filter(
    (c) => c.nextContactDate != null && c.nextContactDate > today && c.nextContactDate <= weekLater,
  ).length;

  res.json(GetContactStatsResponse.parse({ total: contacts.length, core, monthly, yearly, overdueCount, dueThisWeek }));
});

// GET /contacts/due
router.get("/contacts/due", requireAuth, async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const userId = getUserId(req);

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.userId, userId))
    .orderBy(asc(contactsTable.nextContactDate));

  const due = contacts
    .filter((c) => c.nextContactDate != null)
    .map((c) => {
      const next = new Date(c.nextContactDate!);
      const todayDate = new Date(today);
      const daysOverdue = Math.round((todayDate.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
      return { ...c, daysOverdue };
    })
    .filter((c) => c.daysOverdue >= -7)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  res.json(GetDueContactsResponse.parse(due));
});

// GET /contacts/:id
router.get("/contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contact] = await db
    .select()
    .from(contactsTable)
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, getUserId(req))));

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.json(GetContactResponse.parse(contact));
});

// PATCH /contacts/:id
router.patch("/contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getUserId(req);

  const [existing] = await db
    .select()
    .from(contactsTable)
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const updates: Record<string, unknown> = { ...parsed.data };

  const tierChanged = parsed.data.tier != null;
  const intervalChanged = parsed.data.intervalDays !== undefined;
  const lastDateChanged = parsed.data.lastContactDate !== undefined;

  if ((tierChanged || intervalChanged || lastDateChanged) && !parsed.data.nextContactDate) {
    const tier = parsed.data.tier ?? existing.tier;
    const intervalDays = intervalChanged
      ? (parsed.data.intervalDays ?? defaultIntervalDays(tier))
      : (existing.intervalDays ?? defaultIntervalDays(existing.tier));
    const lastDate = parsed.data.lastContactDate !== undefined ? parsed.data.lastContactDate : existing.lastContactDate;
    if (lastDate) {
      updates.nextContactDate = calcNextContactDate(intervalDays, new Date(lastDate));
    }
  }

  const [contact] = await db
    .update(contactsTable)
    .set(updates as Parameters<typeof db.update>[0])
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)))
    .returning();

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.json(UpdateContactResponse.parse(contact));
});

// DELETE /contacts/:id
router.delete("/contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contact] = await db
    .delete(contactsTable)
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, getUserId(req))))
    .returning();

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.sendStatus(204);
});

// POST /contacts/:id/touch
router.post("/contacts/:id/touch", requireAuth, async (req, res): Promise<void> => {
  const params = TouchContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getUserId(req);

  const [existing] = await db
    .select()
    .from(contactsTable)
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const effectiveInterval = existing.intervalDays ?? defaultIntervalDays(existing.tier);
  const nextContactDate = calcNextContactDate(effectiveInterval);

  const [contact] = await db
    .update(contactsTable)
    .set({ lastContactDate: today, nextContactDate })
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)))
    .returning();

  res.json(TouchContactResponse.parse(contact));
});

// GET /calendar/token
router.get("/calendar/token", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const token = getCalendarFeedToken(userId);
  const host = req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const feedUrl = `${proto}://${host}/api/calendar/feed.ics?uid=${encodeURIComponent(userId)}&token=${token}`;

  res.json(GetCalendarTokenResponse.parse({ token, feedUrl }));
});

// GET /calendar/feed.ics?uid=UID&token=TOKEN
router.get("/calendar/feed.ics", async (req, res): Promise<void> => {
  const uid = req.query.uid as string | undefined;
  if (!uid) {
    res.status(401).json({ error: "Missing uid" });
    return;
  }

  const expected = getCalendarFeedToken(uid);
  if (req.query.token !== expected) {
    res.status(401).json({ error: "Invalid or missing token" });
    return;
  }

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.userId, uid))
    .orderBy(asc(contactsTable.nextContactDate));

  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");

  const events = contacts
    .filter((c) => c.nextContactDate)
    .map((c) => {
      const dateStr = c.nextContactDate!.replace(/-/g, "");
      const uid2 = `social-circle-${c.id}-${dateStr}@socialcircle`;
      const freqLabel = intervalLabel(c.tier, c.intervalDays);
      const description = [
        `Time to reach out to ${c.name} (${c.relationshipType}).`,
        `Tier: ${c.tier} — ${freqLabel}`,
        c.notes ? `Notes: ${c.notes.slice(0, 200)}` : "",
      ]
        .filter(Boolean)
        .join("\\n")
        .replace(/,/g, "\\,");

      return [
        "BEGIN:VEVENT",
        `UID:${uid2}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${dateStr}`,
        `SUMMARY:Reach out to ${c.name}`,
        `DESCRIPTION:${description}`,
        "STATUS:CONFIRMED",
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      ].join("\r\n");
    });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Social Circle//Follow-up Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Social Circle",
    "X-WR-CALDESC:Your relationship follow-up reminders from Social Circle",
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.setHeader("Content-Disposition", 'attachment; filename="social-circle.ics"');
  res.send(ics);
});

// GET /contacts/:id/calendar.ics
router.get("/contacts/:id/calendar.ics", requireAuth, async (req, res): Promise<void> => {
  const params = GetContactCalendarParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contact] = await db
    .select()
    .from(contactsTable)
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, getUserId(req))));

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const nextDate = contact.nextContactDate
    ? contact.nextContactDate.replace(/-/g, "")
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const freqLabel = intervalLabel(contact.tier, contact.intervalDays);
  const uid = `social-circle-${contact.id}-${nextDate}@socialcircle`;
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Social Circle//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${nextDate}`,
    `DTEND;VALUE=DATE:${nextDate}`,
    `SUMMARY:Reach out to ${contact.name}`,
    `DESCRIPTION:Time to reach out to ${contact.name} (${contact.relationshipType}).\\nTier: ${contact.tier} — ${freqLabel}${contact.notes ? `\\nNotes: ${contact.notes}` : ""}`,
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="reach-out-${contact.name.toLowerCase().replace(/\s+/g, "-")}.ics"`,
  );
  res.send(ics);
});

export default router;
