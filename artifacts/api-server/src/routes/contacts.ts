import { Router, type IRouter } from "express";
import { eq, and, lte, sql, asc } from "drizzle-orm";
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

function calcNextContactDate(tier: string, from: Date = new Date()): string {
  const d = new Date(from);
  if (tier === "core") {
    d.setDate(d.getDate() + 21); // 3 weeks
  } else if (tier === "monthly") {
    d.setMonth(d.getMonth() + 2); // 2 months
  } else {
    d.setFullYear(d.getFullYear() + 1); // 1 year
  }
  return d.toISOString().slice(0, 10);
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

  const { lastContactDate, tier } = parsed.data;
  const nextContactDate = lastContactDate
    ? calcNextContactDate(tier, new Date(lastContactDate))
    : calcNextContactDate(tier);

  const [contact] = await db
    .insert(contactsTable)
    .values({
      ...parsed.data,
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
    .filter((c) => c.daysOverdue >= -7) // include due in next 7 days too
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

  const updates: Record<string, unknown> = { ...parsed.data };

  // Recalculate next contact date if tier or lastContactDate changed
  if (parsed.data.tier || parsed.data.lastContactDate !== undefined) {
    const [existing] = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    const tier = parsed.data.tier ?? existing.tier;
    const lastDate = parsed.data.lastContactDate ?? existing.lastContactDate;
    if (lastDate && !parsed.data.nextContactDate) {
      updates.nextContactDate = calcNextContactDate(tier, new Date(lastDate));
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
  const nextContactDate = calcNextContactDate(existing.tier);

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

  const tierLabel =
    contact.tier === "core"
      ? "Core (every 3 weeks)"
      : contact.tier === "monthly"
        ? "Monthly (every 2 months)"
        : "Yearly (every year)";

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
    `DESCRIPTION:Time to reach out to ${contact.name} (${contact.relationshipType}).\\nTier: ${tierLabel}${contact.notes ? `\\nNotes: ${contact.notes}` : ""}`,
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
