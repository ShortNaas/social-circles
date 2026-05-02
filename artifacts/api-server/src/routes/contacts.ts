import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
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
} from "@workspace/api-zod";

const router: IRouter = Router();

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

// GET /contacts
router.get("/contacts", async (req, res): Promise<void> => {
  const query = ListContactsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { tier, overdue } = query.data;
  const today = new Date().toISOString().slice(0, 10);

  let contacts = await db
    .select()
    .from(contactsTable)
    .orderBy(asc(contactsTable.nextContactDate), asc(contactsTable.name));

  if (tier) {
    contacts = contacts.filter((c) => c.tier === tier);
  }
  if (overdue) {
    contacts = contacts.filter(
      (c) => c.nextContactDate != null && c.nextContactDate <= today,
    );
  }

  res.json(ListContactsResponse.parse(contacts));
});

// POST /contacts
router.post("/contacts", async (req, res): Promise<void> => {
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
      intervalDays: intervalDays ?? null,
      lastContactDate: lastContactDate ?? null,
      nextContactDate,
    })
    .returning();

  res.status(201).json(GetContactResponse.parse(contact));
});

// GET /contacts/stats
router.get("/contacts/stats", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const contacts = await db.select().from(contactsTable);

  const core = contacts.filter((c) => c.tier === "core").length;
  const monthly = contacts.filter((c) => c.tier === "monthly").length;
  const yearly = contacts.filter((c) => c.tier === "yearly").length;
  const overdueCount = contacts.filter(
    (c) => c.nextContactDate != null && c.nextContactDate <= today,
  ).length;
  const dueThisWeek = contacts.filter(
    (c) =>
      c.nextContactDate != null &&
      c.nextContactDate > today &&
      c.nextContactDate <= weekLater,
  ).length;

  res.json(
    GetContactStatsResponse.parse({
      total: contacts.length,
      core,
      monthly,
      yearly,
      overdueCount,
      dueThisWeek,
    }),
  );
});

// GET /contacts/due
router.get("/contacts/due", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  const contacts = await db
    .select()
    .from(contactsTable)
    .orderBy(asc(contactsTable.nextContactDate));

  const due = contacts
    .filter((c) => c.nextContactDate != null)
    .map((c) => {
      const next = new Date(c.nextContactDate!);
      const todayDate = new Date(today);
      const diffMs = todayDate.getTime() - next.getTime();
      const daysOverdue = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return { ...c, daysOverdue };
    })
    .filter((c) => c.daysOverdue >= -7)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  res.json(GetDueContactsResponse.parse(due));
});

// GET /contacts/:id
router.get("/contacts/:id", async (req, res): Promise<void> => {
  const params = GetContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contact] = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.id, params.data.id));

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.json(GetContactResponse.parse(contact));
});

// PATCH /contacts/:id
router.patch("/contacts/:id", async (req, res): Promise<void> => {
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

  // Fetch existing contact to compute next date if needed
  const [existing] = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const updates: Record<string, unknown> = { ...parsed.data };

  // Recalculate next contact date if tier, intervalDays, or lastContactDate changed
  const tierChanged = parsed.data.tier != null;
  const intervalChanged = parsed.data.intervalDays !== undefined;
  const lastDateChanged = parsed.data.lastContactDate !== undefined;

  if ((tierChanged || intervalChanged || lastDateChanged) && !parsed.data.nextContactDate) {
    const tier = parsed.data.tier ?? existing.tier;
    const intervalDays = intervalChanged
      ? (parsed.data.intervalDays ?? defaultIntervalDays(tier))
      : (existing.intervalDays ?? defaultIntervalDays(existing.tier));
    const effectiveInterval = intervalDays;
    const lastDate = parsed.data.lastContactDate !== undefined
      ? parsed.data.lastContactDate
      : existing.lastContactDate;
    if (lastDate) {
      updates.nextContactDate = calcNextContactDate(effectiveInterval, new Date(lastDate));
    }
  }

  const [contact] = await db
    .update(contactsTable)
    .set(updates as Parameters<typeof db.update>[0])
    .where(eq(contactsTable.id, params.data.id))
    .returning();

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.json(UpdateContactResponse.parse(contact));
});

// DELETE /contacts/:id
router.delete("/contacts/:id", async (req, res): Promise<void> => {
  const params = DeleteContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contact] = await db
    .delete(contactsTable)
    .where(eq(contactsTable.id, params.data.id))
    .returning();

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.sendStatus(204);
});

// POST /contacts/:id/touch
router.post("/contacts/:id/touch", async (req, res): Promise<void> => {
  const params = TouchContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.id, params.data.id));

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
    .where(eq(contactsTable.id, params.data.id))
    .returning();

  res.json(TouchContactResponse.parse(contact));
});

// GET /contacts/:id/calendar.ics
router.get("/contacts/:id/calendar.ics", async (req, res): Promise<void> => {
  const params = GetContactCalendarParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contact] = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.id, params.data.id));

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const nextDate = contact.nextContactDate
    ? contact.nextContactDate.replace(/-/g, "")
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const freqLabel = intervalLabel(contact.tier, contact.intervalDays);

  const uid = `social-circle-${contact.id}-${nextDate}@socialcircle`;
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/, "Z");

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
