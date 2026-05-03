import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, interactionsTable, contactsTable } from "@workspace/db";
import {
  ListInteractionsParams,
  ListInteractionsResponse,
  ListInteractionsResponseItem,
  CreateInteractionParams,
  CreateInteractionBody,
  DeleteInteractionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as any).userId = userId;
  next();
}

function getUserId(req: Request): string {
  return (req as any).userId as string;
}

// GET /contacts/:id/interactions
router.get("/contacts/:id/interactions", requireAuth, wrap(async (req, res) => {
  const params = ListInteractionsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const userId = getUserId(req);

  const [contact] = await db
    .select({ id: contactsTable.id })
    .from(contactsTable)
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

  const interactions = await db
    .select()
    .from(interactionsTable)
    .where(and(eq(interactionsTable.contactId, params.data.id), eq(interactionsTable.userId, userId)))
    .orderBy(desc(interactionsTable.date), desc(interactionsTable.createdAt));

  res.json(ListInteractionsResponse.parse(interactions));
}));

// POST /contacts/:id/interactions
router.post("/contacts/:id/interactions", requireAuth, wrap(async (req, res) => {
  const params = CreateInteractionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = CreateInteractionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = getUserId(req);

  const [contact] = await db
    .select({ id: contactsTable.id })
    .from(contactsTable)
    .where(and(eq(contactsTable.id, params.data.id), eq(contactsTable.userId, userId)));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

  const toDateStr = (d: Date | string): string =>
    d instanceof Date ? d.toISOString().slice(0, 10) : d;

  const [interaction] = await db
    .insert(interactionsTable)
    .values({
      contactId: params.data.id,
      userId,
      date: toDateStr(parsed.data.date as unknown as Date | string),
      type: parsed.data.type,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(ListInteractionsResponseItem.parse(interaction));
}));

// DELETE /contacts/:id/interactions/:interactionId
router.delete("/contacts/:id/interactions/:interactionId", requireAuth, wrap(async (req, res) => {
  const params = DeleteInteractionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const userId = getUserId(req);

  const [deleted] = await db
    .delete(interactionsTable)
    .where(and(eq(interactionsTable.id, params.data.interactionId), eq(interactionsTable.userId, userId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Interaction not found" }); return; }

  res.sendStatus(204);
}));

export default router;
