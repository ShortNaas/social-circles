import { pgTable, serial, text, date, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";

export const interactionTypeEnum = pgEnum("interaction_type", [
  "call",
  "email",
  "coffee",
  "message",
  "video_call",
  "other",
]);

export const interactionsTable = pgTable("interactions", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contactsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  type: interactionTypeEnum("type").notNull().default("other"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Interaction = typeof interactionsTable.$inferSelect;
