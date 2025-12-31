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
  city: text("city"),
  state: text("state"),
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

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  city: text("city"),
  category: text("category").notNull(),
  organizer: text("organizer").notNull(),
  organizerId: varchar("organizer_id").references(() => users.id),
  attendees: integer("attendees").default(0),
  maxAttendees: integer("max_attendees"),
  registeredBy: text("registered_by").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendorServices = pgTable("vendor_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  specialization: text("specialization"),
  description: text("description"),
  location: text("location").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").default(0),
  verified: boolean("verified").default(false),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  priceRange: text("price_range"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value"),
  category: text("category").notNull(), // 'api_keys', 'payments', 'general'
  isSecret: boolean("is_secret").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("NGN"),
  provider: text("provider").notNull(), // 'stripe', 'paystack', 'flutterwave'
  providerRef: text("provider_ref"),
  status: text("status").notNull(), // 'pending', 'completed', 'failed', 'refunded'
  type: text("type").notNull(), // 'subscription', 'credits', 'service'
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Coupons for subscriptions
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(), // 'percentage', 'fixed'
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  maxRedemptions: integer("max_redemptions"),
  currentRedemptions: integer("current_redemptions").default(0),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User wallets
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0"),
  currency: text("currency").notNull().default("NGN"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet transactions
export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),
  type: text("type").notNull(), // 'deposit', 'withdrawal', 'escrow_fund', 'escrow_release', 'payment'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 12, scale: 2 }),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }),
  reference: text("reference"),
  description: text("description"),
  status: text("status").notNull().default("completed"), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
});

// Service bookings
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => vendorServices.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  vendorId: varchar("vendor_id").notNull().references(() => users.id),
  status: text("status").notNull().default("requested"), // 'requested', 'confirmed', 'in_progress', 'completed', 'disputed', 'cancelled'
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  scheduledDate: timestamp("scheduled_date"),
  requiresInitialPayment: boolean("requires_initial_payment").default(false),
  initialPaymentPercent: integer("initial_payment_percent"),
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  completedAt: timestamp("completed_at"),
});

// Booking milestones for staged payments
export const bookingMilestones = pgTable("booking_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id),
  title: text("title").notNull(),
  description: text("description"),
  amountPercent: integer("amount_percent").notNull(), // percentage of total
  amount: numeric("amount", { precision: 12, scale: 2 }),
  order: integer("order").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'released'
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  releasedAt: timestamp("released_at"),
});

// Escrow accounts for bookings
export const escrowAccounts = pgTable("escrow_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  fundedAmount: numeric("funded_amount", { precision: 12, scale: 2 }).default("0"),
  releasedAmount: numeric("released_amount", { precision: 12, scale: 2 }).default("0"),
  status: text("status").notNull().default("pending"), // 'pending', 'funded', 'partial', 'released', 'disputed', 'refunded'
  createdAt: timestamp("created_at").defaultNow(),
  fundedAt: timestamp("funded_at"),
  releasedAt: timestamp("released_at"),
});

// Escrow transaction events
export const escrowEvents = pgTable("escrow_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  escrowId: varchar("escrow_id").notNull().references(() => escrowAccounts.id),
  type: text("type").notNull(), // 'funded', 'milestone_released', 'full_released', 'refunded', 'disputed'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  milestoneId: varchar("milestone_id").references(() => bookingMilestones.id),
  description: text("description"),
  performedBy: varchar("performed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contracts for bookings
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id),
  title: text("title").notNull(),
  terms: text("terms").notNull(),
  vendorSignedAt: timestamp("vendor_signed_at"),
  userSignedAt: timestamp("user_signed_at"),
  status: text("status").notNull().default("pending"), // 'pending', 'vendor_signed', 'fully_signed', 'cancelled'
  createdAt: timestamp("created_at").defaultNow(),
});

// Disputes for bookings
export const disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id),
  openedBy: varchar("opened_by").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  description: text("description"),
  evidence: jsonb("evidence").default([]), // array of {type, url, description}
  status: text("status").notNull().default("open"), // 'open', 'under_review', 'resolved', 'closed'
  resolution: text("resolution"), // 'user_favor', 'vendor_favor', 'split', 'cancelled'
  resolutionNotes: text("resolution_notes"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Booking chat messages
export const bookingMessages = pgTable("booking_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isAdminMessage: boolean("is_admin_message").default(false),
  attachments: jsonb("attachments").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'booking', 'payment', 'kyc', 'system', 'event', 'job'
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data").default({}), // additional data like booking_id, event_id
  channel: text("channel").notNull().default("in_app"), // 'in_app', 'email', 'push'
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Notification templates (admin managed)
export const notificationTemplates = pgTable("notification_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  type: text("type").notNull(), // 'booking', 'payment', 'kyc', 'system'
  subject: text("subject").notNull(),
  bodyTemplate: text("body_template").notNull(), // supports {{variable}} placeholders
  channels: text("channels").array().default([]), // ['email', 'push', 'in_app']
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SMTP settings (admin managed)
export const smtpSettings = pgTable("smtp_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(), // encrypted
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  encryption: text("encryption").default("tls"), // 'tls', 'ssl', 'none'
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull(),
  keys: jsonb("keys").notNull(), // {p256dh, auth}
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved jobs
export const savedJobs = pgTable("saved_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  jobId: varchar("job_id").notNull(),
  savedAt: timestamp("saved_at").defaultNow(),
});

// Applied jobs
export const appliedJobs = pgTable("applied_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  jobId: varchar("job_id").notNull(),
  status: text("status").notNull().default("applied"), // 'applied', 'reviewing', 'interviewing', 'accepted', 'rejected'
  appliedAt: timestamp("applied_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Generated jobs (AI suggested)
export const generatedJobs = pgTable("generated_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  jobData: jsonb("job_data").notNull(),
  source: text("source").default("ai"), // 'ai', 'system'
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved events
export const savedEvents = pgTable("saved_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventId: varchar("event_id").notNull(),
  savedAt: timestamp("saved_at").defaultNow(),
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

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  createdAt: true,
  currentRedemptions: true,
});

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  confirmedAt: true,
  completedAt: true,
});

export const insertBookingMilestoneSchema = createInsertSchema(bookingMilestones).omit({
  id: true,
  completedAt: true,
  releasedAt: true,
});

export const insertEscrowAccountSchema = createInsertSchema(escrowAccounts).omit({
  id: true,
  createdAt: true,
  fundedAt: true,
  releasedAt: true,
});

export const insertEscrowEventSchema = createInsertSchema(escrowEvents).omit({
  id: true,
  createdAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
});

export const insertDisputeSchema = createInsertSchema(disputes).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export const insertBookingMessageSchema = createInsertSchema(bookingMessages).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type InsertBookingMilestone = z.infer<typeof insertBookingMilestoneSchema>;
export type InsertEscrowAccount = z.infer<typeof insertEscrowAccountSchema>;
export type InsertEscrowEvent = z.infer<typeof insertEscrowEventSchema>;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type InsertBookingMessage = z.infer<typeof insertBookingMessageSchema>;
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
export type Event = typeof events.$inferSelect;
export type VendorService = typeof vendorServices.$inferSelect;
export type AdminSetting = typeof adminSettings.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingMilestone = typeof bookingMilestones.$inferSelect;
export type EscrowAccount = typeof escrowAccounts.$inferSelect;
export type EscrowEvent = typeof escrowEvents.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
export type BookingMessage = typeof bookingMessages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type SmtpSettings = typeof smtpSettings.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type SavedJob = typeof savedJobs.$inferSelect;
export type AppliedJob = typeof appliedJobs.$inferSelect;
export type GeneratedJob = typeof generatedJobs.$inferSelect;
export type SavedEvent = typeof savedEvents.$inferSelect;
