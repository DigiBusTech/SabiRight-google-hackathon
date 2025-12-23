import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  email: text("email"),
  displayName: text("display_name"),
  isVendor: boolean("is_vendor").default(false),
  kycStatus: text("kyc_status").default("pending"), // 'pending', 'verified', 'rejected'
  kycDocument: text("kyc_document"),
  kycSubmittedAt: timestamp("kyc_submitted_at"),
  kycVerifiedAt: timestamp("kyc_verified_at"),
  vendorMode: boolean("vendor_mode").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'free', 'basic', 'pro', 'enterprise'
  userType: text("user_type").notNull(), // 'user' or 'vendor'
  price: numeric("price", { precision: 10, scale: 2 }),
  billingCycle: text("billing_cycle"), // 'monthly', 'yearly'
  dailyCredits: integer("daily_credits"),
  marketplaceListings: integer("marketplace_listings"),
  features: jsonb("features").default([]),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  planId: varchar("plan_id").notNull().references(() => plans.id),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull(), // 'active', 'cancelled', 'expired'
  startDate: timestamp("start_date").defaultNow(),
  renewalDate: timestamp("renewal_date"),
  cancelledAt: timestamp("cancelled_at"),
});

export const credits = pgTable("credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalCredits: integer("total_credits").default(0),
  usedCredits: integer("used_credits").default(0),
  lastRefreshDate: timestamp("last_refresh_date").defaultNow(),
  renewalDate: timestamp("renewal_date"),
});

export const creditLog = pgTable("credit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  action: text("action").notNull(), // 'used', 'refunded', 'granted'
  feature: text("feature").notNull(), // 'civic_guard', 'job_search', 'marketplace_listing'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendorApplications = pgTable("vendor_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  businessName: text("business_name").notNull(),
  serviceType: text("service_type").notNull(),
  businessDocument: text("business_document"),
  taxId: text("tax_id"),
  status: text("status").notNull(), // 'pending', 'approved', 'rejected'
  kycStatus: text("kyc_status").default("pending"), // 'pending', 'verified', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  kycVerifiedAt: timestamp("kyc_verified_at"),
});

export const cloakedRoutes = pgTable("cloaked_routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  routeName: text("route_name").notNull(),
  startLocation: text("start_location").notNull(),
  endLocation: text("end_location").notNull(),
  startLat: numeric("start_lat", { precision: 10, scale: 8 }),
  startLng: numeric("start_lng", { precision: 11, scale: 8 }),
  endLat: numeric("end_lat", { precision: 10, scale: 8 }),
  endLng: numeric("end_lng", { precision: 11, scale: 8 }),
  lastStatus: text("last_status").notNull().default("active"), // 'active', 'cleared', 'unknown'
  lastChecked: timestamp("last_checked").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trafficAlerts = pgTable("traffic_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: varchar("route_id").notNull().references(() => cloakedRoutes.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  alertType: text("alert_type").notNull(), // 'active_checkpoint', 'cleared', 'unknown'
  message: text("message"),
  severity: text("severity"), // 'high', 'medium', 'low'
  createdAt: timestamp("created_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
});

export const dashboardTrafficCards = pgTable("dashboard_traffic_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  location: text("location").notNull(),
  status: text("status").notNull(), // 'active', 'cleared', 'normal'
  description: text("description"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  lastRefreshedAt: timestamp("last_refreshed_at"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  createdAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  startDate: true,
});

export const insertCreditsSchema = createInsertSchema(credits).omit({
  lastRefreshDate: true,
  renewalDate: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Credits = typeof credits.$inferSelect;
export type CreditLog = typeof creditLog.$inferSelect;
export type VendorApplication = typeof vendorApplications.$inferSelect;
export type CloakedRoute = typeof cloakedRoutes.$inferSelect;
export type TrafficAlert = typeof trafficAlerts.$inferSelect;
export type DashboardTrafficCard = typeof dashboardTrafficCards.$inferSelect;
