import { pgTable, serial, text, date, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tierEnum = pgEnum("tier", ["core", "monthly", "yearly"]);

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  name: text("name").notNull(),
  tier: tierEnum("tier").notNull(),
  intervalDays: integer("interval_days"),
  relationshipType: text("relationship_type").notNull(),
  lastContactDate: date("last_contact_date"),
  nextContactDate: date("next_contact_date"),
  notes: text("notes"),
  birthday: date("birthday"),
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  twitter: text("twitter"),
  instagram: text("instagram"),
  address: text("address"),
  snoozedUntil: date("snoozed_until"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const contactInfoHistoryTable = pgTable("contact_info_history", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
export type ContactInfoHistory = typeof contactInfoHistoryTable.$inferSelect;
