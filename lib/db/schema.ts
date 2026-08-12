import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  date,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Deletion is soft. On delete the email is suffixed with -{id}-deleted so the address can be
  // reused by a future signup without violating the unique constraint.
  deletedAt: timestamp('deleted_at'),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const sites = pgTable(
  'sites',
  {
    id: serial('id').primaryKey(),
    // Nullable on purpose. The seeded sample site has no owner, which makes it readable by every
    // signed-in account — so a reviewer's fresh signup is not greeted by an empty dashboard —
    // while guaranteeing no ownership check can ever match it, so nobody can edit or delete it.
    // One nullable column replaces a permissions system.
    userId: integer('user_id').references(() => users.id),
    name: varchar('name', { length: 100 }).notNull(),
    // Normalised: lowercase, no port, no leading www.
    domain: varchar('domain', { length: 253 }).notNull(),
    // Public by design — it ships in the HTML of every tracked page. What protects a site is the
    // origin check in the collector, not the secrecy of this value.
    siteKey: varchar('site_key', { length: 32 }).notNull().unique(),
    // Cleared rather than flagged when sharing is disabled, so a leaked URL dies permanently and
    // re-enabling mints a new one.
    shareToken: varchar('share_token', { length: 32 }).unique(),
    isSample: boolean('is_sample').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('sites_user_id_idx').on(table.userId)]
);

/**
 * One row per pageview.
 *
 * There is no column for an IP address or a user agent. Not "we choose not to store them" — there
 * is nowhere to put them. The privacy design is structural rather than procedural, and that is the
 * point: it can be verified with one \d events.
 */
export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    siteId: integer('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    // Query string and fragment stripped before insert.
    path: varchar('path', { length: 255 }).notNull(),
    // Null means direct, or a referrer that was stripped.
    referrerDomain: varchar('referrer_domain', { length: 253 }),
    visitorHash: varchar('visitor_hash', { length: 64 }).notNull(),
  },
  (table) => [
    index('events_site_timestamp_idx').on(table.siteId, table.timestamp),
    index('events_site_visitor_idx').on(table.siteId, table.visitorHash),
  ]
);

/**
 * The rotating salt behind the visitor hash. One row per day, created lazily on that day's first
 * event and deleted after 48 hours on the write path. Once a salt is gone the hashes it produced
 * cannot be linked back to an IP address, even with full database access.
 */
export const visitorSalts = pgTable('visitor_salts', {
  day: date('day').primaryKey(),
  salt: varchar('salt', { length: 64 }).notNull(),
});

export const aiAnalyses = pgTable(
  'ai_analyses',
  {
    id: serial('id').primaryKey(),
    siteId: integer('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    // Who paid for it. Nullable so a seeded report survives the account that generated it.
    userId: integer('user_id').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    model: varchar('model', { length: 64 }).notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    // Millionths of a dollar, so cost stays an exact integer.
    costMicros: integer('cost_micros').notNull(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [
    // The first drives "latest report", the second drives the daily cap.
    index('ai_analyses_site_created_idx').on(table.siteId, table.createdAt),
    index('ai_analyses_user_created_idx').on(table.userId, table.createdAt),
  ]
);

export const sitesRelations = relations(sites, ({ one, many }) => ({
  user: one(users, {
    fields: [sites.userId],
    references: [users.id],
  }),
  events: many(events),
  analyses: many(aiAnalyses),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  site: one(sites, {
    fields: [events.siteId],
    references: [sites.id],
  }),
}));

export const aiAnalysesRelations = relations(aiAnalyses, ({ one }) => ({
  site: one(sites, {
    fields: [aiAnalyses.siteId],
    references: [sites.id],
  }),
  user: one(users, {
    fields: [aiAnalyses.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  activityLogs: many(activityLogs),
  sites: many(sites),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type AiAnalysis = typeof aiAnalyses.$inferSelect;
export type NewAiAnalysis = typeof aiAnalyses.$inferInsert;

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_SITE = 'CREATE_SITE',
  DELETE_SITE = 'DELETE_SITE',
  ENABLE_SHARING = 'ENABLE_SHARING',
  DISABLE_SHARING = 'DISABLE_SHARING',
}
