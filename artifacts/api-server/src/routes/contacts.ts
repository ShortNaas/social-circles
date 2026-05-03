import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, asc, desc, and, isNull, isNotNull } from "drizzle-orm";
import crypto from "crypto";
import { getAuth } from "@clerk/express";
import { db, contactsTable, contactInfoHistoryTable } from "@workspace/db";
import {
  ListContactsQueryParams,
  CreateContactBody,
  UpdateContactBody,
  GetContactParams,
  UpdateContactParams,
  DeleteContactParams,
  TouchContactParams,
  GetContactCalendarParams,
  GetContactInfoHistoryParams,
  GetContactStatsResponse,
  GetDueContactsResponse,
  ListContactsResponse,
  GetContactResponse,
  UpdateContactResponse,
  TouchContactResponse,
  GetCalendarTokenResponse,
  GetContactInfoHistoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Wraps async route handlers so thrown errors reach Express's error middleware
function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

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

// Parses tags from JSON string in DB to array for API responses
function parseDbContact<T extends { tags?: string | null }>(c: T): Omit<T, "tags"> & { tags: string[] | null } {
  let tags: string[] | null = null;
  if (c.tags) {
    try { tags = JSON.parse(c.tags); } catch { tags = []; }
  }
  return { ...c, tags };
}

// The info fields we track history for
const TRACKED_INFO_FIELDS = ["email", "phone", "linkedin", "twitter", "instagram", "address"] as const;

function getCalendarFeedToken(userId: string): string {
  const secret = process.env.SESSION_SECRET ?? "dev-fallback-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`social-circle-calendar-feed-v2:${userId}`)
    .digest("hex")
    .slice(0, 40);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /contacts/import — bulk import contacts from a JSON array
router.post("/contacts/import", requireAuth, wrap(async (req, res) => {
  const userId = getUserId(req);
  const { contacts: rows } = req.body as { contacts: unknown[] };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "contacts must be a non-empty array" });
    return;
  }

  const toDateStr = (d: Date | string | null | undefined): string | null =>
    d ? (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10) : null;

  const values = rows
    .map((row: any) => {
      const parsed = CreateContactBody.safeParse(row);
      if (!parsed.success) return null;
      const { tier, intervalDays, lastContactDate } = parsed.data;
      const effectiveInterval = intervalDays ?? defaultIntervalDays(tier);
      const nextContactDate = lastContactDate
        ? calcNextContactDate(effectiveInterval, new Date(lastContactDate as any))
        : calcNextContactDate(effectiveInterval);
      return {
        userId,
        name: parsed.data.name,
        tier,
        intervalDays: intervalDays ?? null,
        relationshipType: parsed.data.relationshipType,
        lastContactDate: toDateStr(lastContactDate as any),
        nextContactDate,
        notes: parsed.data.notes ?? null,
        birthday: parsed.data.birthday ?? null,
      };
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof toDateStr> extends string ? any : any>[];

  if (values.length === 0) {
    res.status(400).json({ error: "No valid contacts in import data" });
    return;
  }

  await db.insert(contactsTable).values(values);
  res.json({ imported: values.length });
}));

// GET /contacts/export — download all contacts as a CSV file
router.get("/contacts/export", requireAuth, wrap(async (req, res) => {
  const userId = getUserId(req);
  const contacts = await db
    .select()
    .from(contactsTable)
    .where(and(eq(contactsTable.userId, userId), isNull(contactsTable.archivedAt)))
    .orderBy(asc(contactsTable.name));

  const escape = (v: string | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const header = ["Name", "Tier", "Relationship", "Interval (days)", "Last Contact", "Next Contact", "Notes"];
  const rows = contacts.map((c) => [
    escape(c.name),
    escape(c.tier),
    escape(c.relationshipType),
    escape(c.intervalDays != null ? String(c.intervalDays) : ""),
    escape(c.lastContactDate),
    escape(c.nextContactDate),
    escape(c.notes),
  ]);

  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="social-circle-contacts.csv"');
  res.send(csv);
}));

// GET /contacts
router.get("/contacts", requireAuth, wrap(async (req, res) => {
  const query = ListContactsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { tier, overdue, archived } = query.data;
  const today = new Date().toISOString().slice(0, 10);
  const userId = getUserId(req);

  let contacts = await db
    .select()
    .from(contactsTable)
    .where(
      archived
        ? and(eq(contactsTable.userId, userId), isNotNull(contactsTable.archivedAt))
        : and(eq(contactsTable.userId, userId), isNull(contactsTable.archivedAt))
    )
    .orderBy(asc(contactsTable.nextContactDate), asc(contactsTable.name));

  if (tier) contacts = contacts.filter((c) => c.tier === tier);
  if (overdue) contacts = contacts.filter((c) => c.nextContactDate != null && c.nextContactDate <= today);

  res.json(ListContactsResponse.parse(contacts.map(parseDbContact)));
}));

// POST /contacts
router.post("/contacts", requireAuth, wrap(async (req, res) => {
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

  const toDateStr = (d: Date | string | null | undefined): string | null =>
    d ? (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10) : null;

  const [contact] = await db
    .insert(contactsTable)
    .values({
      name: parsed.data.name,
      tier: parsed.data.tier,
      intervalDays: intervalDays ?? null,
      relationshipType: parsed.data.relationshipType,
      lastContactDate: toDateStr(lastContactDate),
      nextContactDate,
      notes: parsed.data.notes ?? null,
      birthday: parsed.data.birthday ?? null,
      userId: getUserId(req),
    })
    .returning();

  res.status(201).json(GetContactResponse.parse(parseDbContact(contact)));
}));

// GET /contacts/stats
router.get("/contacts/stats", requireAuth, wrap(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const userId = getUserId(req);

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(and(eq(contactsTable.userId, userId), isNull(contactsTable.archivedAt)));

  const core = contacts.filter((c) => c.tier === "core").length;
  const monthly = contacts.filter((c) => c.tier === "monthly").length;
  const yearly = contacts.filter((c) => c.tier === "yearly").length;
  const overdueCount = contacts.filter((c) => c.nextContactDate != null && c.nextContactDate <= today).length;
  const dueThisWeek = contacts.filter(
    (c) => c.nextContactDate != null && c.nextContactDate > today && c.nextContactDate <= weekLater,
  ).length;

  res.json(GetContactStatsResponse.parse({ total: contacts.length, core, monthly, yearly, overdueCount, dueThisWeek }));
}));

// GET /contacts/due
router.get("/contacts/due", requireAuth, wrap(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const userId = getUserId(req);

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(and(eq(contactsTable.userId, userId), isNull(contactsTable.archivedAt)))
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

  res.json(GetDueContactsResponse.parse(due.map(parseDbContact)));
}));

// GET /contacts/:id
router.get("/contacts/:id", requireAuth, wrap(async (req, res) => {
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

  res.json(GetContactResponse.parse(parseDbContact(contact)));
}));

// PATCH /contacts/:id
router.patch("/contacts/:id", requireAuth, wrap(async (req, res) => {
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

  // Serialize tags array to JSON string for storage
  if (parsed.data.tags !== undefined) {
    updates.tags = parsed.data.tags != null ? JSON.stringify(parsed.data.tags) : null;
  }

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

  // Guard: if nothing to update, return existing contact as-is
  if (Object.keys(updates).length === 0) {
    res.json(UpdateContactResponse.parse(parseDbContact(existing)));
    return;
  }

  // Track changes to contact info fields and log history
  const historyEntries: Array<{ contactId: number; field: string; oldValue: string | null; newValue: string | null }> = [];
  for (const field of TRACKED_INFO_FIELDS) {
    if (field in parsed.data) {
      const oldVal = (existing as any)[field] as string | null;
      const newVal = (parsed.data as any)[field] as string | null;
      if (oldVal !== newVal) {
        historyEntries.push({ contactId: params.data.id, field, oldValue: oldVal ?? null, newValue: newVal ?? null });
      }
    }
  }

  const [contact] = await db
    .update(contactsTable)
    .set(updates as any)
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)))
    .returning();

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  if (historyEntries.length > 0) {
    await db.insert(contactInfoHistoryTable).values(historyEntries);
  }

  res.json(UpdateContactResponse.parse(parseDbContact(contact)));
}));

// DELETE /contacts/:id
router.delete("/contacts/:id", requireAuth, wrap(async (req, res) => {
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
}));

// POST /contacts/:id/touch
router.post("/contacts/:id/touch", requireAuth, wrap(async (req, res) => {
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

  res.json(TouchContactResponse.parse(parseDbContact(contact)));
}));

// POST /contacts/:id/archive
router.post("/contacts/:id/archive", requireAuth, wrap(async (req, res) => {
  const params = GetContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getUserId(req);
  const [contact] = await db
    .update(contactsTable)
    .set({ archivedAt: new Date() })
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)))
    .returning();
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.json(GetContactResponse.parse(parseDbContact(contact)));
}));

// POST /contacts/:id/unarchive
router.post("/contacts/:id/unarchive", requireAuth, wrap(async (req, res) => {
  const params = GetContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getUserId(req);
  const [contact] = await db
    .update(contactsTable)
    .set({ archivedAt: null })
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)))
    .returning();
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.json(GetContactResponse.parse(parseDbContact(contact)));
}));

// GET /contacts/:id/info-history
router.get("/contacts/:id/info-history", requireAuth, wrap(async (req, res) => {
  const params = GetContactInfoHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getUserId(req);
  const [contact] = await db.select().from(contactsTable)
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)));
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const history = await db.select().from(contactInfoHistoryTable)
    .where(eq(contactInfoHistoryTable.contactId, params.data.id))
    .orderBy(desc(contactInfoHistoryTable.changedAt));
  res.json(GetContactInfoHistoryResponse.parse(history));
}));

// GET /calendar/token
router.get("/calendar/token", requireAuth, wrap(async (req, res) => {
  const userId = getUserId(req);
  const token = getCalendarFeedToken(userId);
  const host = req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const feedUrl = `${proto}://${host}/api/calendar/feed.ics?uid=${encodeURIComponent(userId)}&token=${token}`;

  res.json(GetCalendarTokenResponse.parse({ token, feedUrl }));
}));

// GET /calendar/feed.ics?uid=UID&token=TOKEN
router.get("/calendar/feed.ics", wrap(async (req, res) => {
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
}));

// GET /contacts/:id/calendar.ics
router.get("/contacts/:id/calendar.ics", requireAuth, wrap(async (req, res) => {
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
}));

export default router;
