import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  date: timestamp("date").notNull(),
  capacity: integer("capacity").notNull(),
  price: integer("price").notNull(),
  imageUrl: text("image_url").notNull(),
});

export const registrations = pgTable("registrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  status: text("status").notNull(), // 'pending', 'confirmed', 'cancelled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export const insertEventSchema = createInsertSchema(events);
export const insertRegistrationSchema = createInsertSchema(registrations);
export const insertWaitlistSchema = createInsertSchema(waitlist).pick({
  email: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type Waitlist = typeof waitlist.$inferSelect;
