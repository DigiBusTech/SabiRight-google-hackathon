import { db } from './db';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { IStorage } from './storage';
import type { User, InsertUser, Subscription, Credits, Plan, CreditLog, CloakedRoute, TrafficAlert, DashboardTrafficCard, UserProfile, VendorApplication, Event, VendorService, AdminSetting, Payment } from "@shared/schema";
import { randomUUID } from "crypto";

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const users = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return users[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return users[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    await db.insert(schema.users).values({ ...insertUser, id });
    return (await this.getUser(id))!;
  }

  // Plans
  async getAllPlans(): Promise<Plan[]> {
    return db.select().from(schema.plans);
  }

  async getPlansByType(tier: string, userType: 'user' | 'vendor'): Promise<Plan[]> {
    return db.select().from(schema.plans).where(
      and(eq(schema.plans.type, tier), eq(schema.plans.userType, userType))
    );
  }

  async getUserPlan(userId: string): Promise<(Plan & Subscription) | undefined> {
    const subs = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
    if (subs.length === 0) return undefined;
    const plans = await db.select().from(schema.plans).where(eq(schema.plans.id, subs[0].planId));
    if (!plans[0]) return undefined;
    return { ...plans[0], ...subs[0] };
  }

  async createSubscription(subscription: any): Promise<Subscription> {
    const id = randomUUID();
    await db.insert(schema.subscriptions).values({ ...subscription, id });
    const subs = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id));
    return subs[0];
  }

  async updateSubscriptionStatus(subscriptionId: string, status: string): Promise<void> {
    await db.update(schema.subscriptions)
      .set({ status })
      .where(eq(schema.subscriptions.id, subscriptionId));
  }

  async getPlanById(planId: string): Promise<Plan | undefined> {
    const plans = await db.select().from(schema.plans).where(eq(schema.plans.id, planId));
    return plans[0];
  }

  // Credits
  async getUserCredits(userId: string): Promise<Credits | undefined> {
    const credits = await db.select().from(schema.credits).where(eq(schema.credits.userId, userId));
    return credits[0];
  }

  async createCredits(creditsData: any): Promise<Credits> {
    const id = randomUUID();
    await db.insert(schema.credits).values({ ...creditsData, id });
    const credits = await db.select().from(schema.credits).where(eq(schema.credits.id, id));
    return credits[0];
  }

  async refundCredits(userId: string, amount: number, feature: string): Promise<void> {
    const credits = await this.getUserCredits(userId);
    if (credits) {
      await db.update(schema.credits)
        .set({ usedCredits: Math.max(0, (credits.usedCredits || 0) - amount) })
        .where(eq(schema.credits.userId, userId));
      
      await db.insert(schema.creditLog).values({
        userId,
        amount,
        action: 'refunded',
        feature,
        description: `Refunded ${amount} credits for ${feature}`
      });
    }
  }

  async initializeCredits(userId: string, initialCredits: number): Promise<void> {
    await db.insert(schema.credits).values({
      id: randomUUID(),
      userId,
      totalCredits: initialCredits,
      usedCredits: 0,
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }).onConflictDoNothing();
  }

  async deductCredits(userId: string, amount: number, feature: string, description?: string): Promise<boolean> {
    const credits = await this.getUserCredits(userId);
    if (!credits) return false;
    
    const available = (credits.totalCredits || 0) - (credits.usedCredits || 0);
    if (available < amount) return false;

    await db.update(schema.credits)
      .set({ usedCredits: (credits.usedCredits || 0) + amount })
      .where(eq(schema.credits.userId, userId));

    await db.insert(schema.creditLog).values({
      userId,
      amount: -amount,
      action: 'used',
      feature,
      description: description || `Used ${amount} credits for ${feature}`
    });

    return true;
  }

  async addCredits(userId: string, amount: number, reason: string): Promise<void> {
    const credits = await this.getUserCredits(userId);
    if (!credits) {
      await this.initializeCredits(userId, amount);
    } else {
      await db.update(schema.credits)
        .set({ totalCredits: (credits.totalCredits || 0) + amount })
        .where(eq(schema.credits.userId, userId));
    }

    await db.insert(schema.creditLog).values({
      userId,
      amount,
      action: 'granted',
      feature: 'credit_purchase',
      description: reason
    });
  }

  async refreshDailyCredits(userId: string, dailyAmount: number): Promise<void> {
    const credits = await this.getUserCredits(userId);
    if (!credits) {
      await this.initializeCredits(userId, dailyAmount);
      return;
    }

    const lastRefresh = credits.renewalDate ? new Date(credits.renewalDate) : new Date(0);
    const now = new Date();
    const daysSinceRefresh = Math.floor((now.getTime() - lastRefresh.getTime()) / (24 * 60 * 60 * 1000));

    if (daysSinceRefresh >= 1) {
      await db.update(schema.credits)
        .set({ 
          totalCredits: dailyAmount,
          usedCredits: 0,
          renewalDate: new Date()
        })
        .where(eq(schema.credits.userId, userId));
    }
  }

  async getCreditLog(userId: string, limit?: number): Promise<CreditLog[]> {
    const query = db.select().from(schema.creditLog)
      .where(eq(schema.creditLog.userId, userId))
      .orderBy(desc(schema.creditLog.createdAt));
    if (limit) return query.limit(limit);
    return query;
  }

  // Cloaked Routes
  async getUserRoutes(userId: string): Promise<CloakedRoute[]> {
    return db.select().from(schema.cloakedRoutes).where(eq(schema.cloakedRoutes.userId, userId));
  }

  async createRoute(route: any): Promise<CloakedRoute> {
    const id = randomUUID();
    await db.insert(schema.cloakedRoutes).values({ ...route, id });
    const routes = await db.select().from(schema.cloakedRoutes).where(eq(schema.cloakedRoutes.id, id));
    return routes[0];
  }

  async updateRouteStatus(routeId: string, status: string): Promise<void> {
    await db.update(schema.cloakedRoutes)
      .set({ lastStatus: status, lastChecked: new Date() })
      .where(eq(schema.cloakedRoutes.id, routeId));
  }

  async deleteRoute(routeId: string): Promise<void> {
    await db.delete(schema.cloakedRoutes).where(eq(schema.cloakedRoutes.id, routeId));
  }

  // Traffic Alerts
  async getRouteAlerts(routeId: string, limit?: number): Promise<TrafficAlert[]> {
    const query = db.select().from(schema.trafficAlerts)
      .where(eq(schema.trafficAlerts.routeId, routeId))
      .orderBy(desc(schema.trafficAlerts.createdAt));
    if (limit) return query.limit(limit);
    return query;
  }

  async createAlert(alert: any): Promise<TrafficAlert> {
    const id = randomUUID();
    await db.insert(schema.trafficAlerts).values({ ...alert, id });
    const alerts = await db.select().from(schema.trafficAlerts).where(eq(schema.trafficAlerts.id, id));
    return alerts[0];
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await db.update(schema.trafficAlerts)
      .set({ acknowledgedAt: new Date() })
      .where(eq(schema.trafficAlerts.id, alertId));
  }

  // KYC
  async updateUserKYC(userId: string, kycStatus: string, kycDocument?: string): Promise<void> {
    const updateData: any = { kycStatus };
    if (kycDocument) updateData.kycDocument = kycDocument;
    if (kycStatus === 'verified') updateData.kycVerifiedAt = new Date();
    
    const existing = await this.getUserProfile(userId);
    if (existing) {
      await db.update(schema.userProfiles).set(updateData).where(eq(schema.userProfiles.userId, userId));
    } else {
      await db.insert(schema.userProfiles).values({ userId, ...updateData });
    }
  }

  async updateUserProfile(userId: string, profile: any): Promise<void> {
    const existing = await this.getUserProfile(userId);
    if (existing) {
      await db.update(schema.userProfiles).set(profile).where(eq(schema.userProfiles.userId, userId));
    } else {
      await db.insert(schema.userProfiles).values({ userId, ...profile });
    }
  }

  async submitVendorApplication(userId: string, app: any): Promise<VendorApplication> {
    const id = randomUUID();
    await db.insert(schema.vendorApplications).values({
      id,
      userId,
      ...app,
      status: 'pending'
    });
    return (await this.getVendorApplication(userId))!;
  }

  // User Profiles
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
    return profiles[0];
  }

  async createOrUpdateUserProfile(userId: string, profile: any): Promise<UserProfile> {
    const existing = await this.getUserProfile(userId);
    if (existing) {
      await db.update(schema.userProfiles)
        .set(profile)
        .where(eq(schema.userProfiles.userId, userId));
    } else {
      await db.insert(schema.userProfiles).values({
        id: randomUUID(),
        userId,
        ...profile
      });
    }
    return (await this.getUserProfile(userId))!;
  }

  // Vendor Applications
  async getVendorApplication(userId: string): Promise<VendorApplication | undefined> {
    const apps = await db.select().from(schema.vendorApplications).where(eq(schema.vendorApplications.userId, userId));
    return apps[0];
  }

  async createVendorApplication(userId: string, application: any): Promise<VendorApplication> {
    const id = randomUUID();
    await db.insert(schema.vendorApplications).values({
      id,
      userId,
      ...application,
      status: 'pending'
    });
    return (await this.getVendorApplication(userId))!;
  }

  async approveVendorApplication(userId: string): Promise<void> {
    await db.update(schema.vendorApplications)
      .set({ status: 'approved' })
      .where(eq(schema.vendorApplications.userId, userId));
    
    await db.update(schema.userProfiles)
      .set({ isVendor: true })
      .where(eq(schema.userProfiles.userId, userId));
  }

  async rejectVendorApplication(userId: string): Promise<void> {
    await db.update(schema.vendorApplications)
      .set({ status: 'rejected' })
      .where(eq(schema.vendorApplications.userId, userId));
  }

  async switchVendorMode(userId: string, vendorMode: boolean): Promise<void> {
    await db.update(schema.userProfiles)
      .set({ vendorMode })
      .where(eq(schema.userProfiles.userId, userId));
  }

  // Dashboard Traffic
  async getDashboardTraffic(userId: string): Promise<DashboardTrafficCard | undefined> {
    const traffic = await db.select().from(schema.dashboardTrafficCards).where(eq(schema.dashboardTrafficCards.userId, userId));
    return traffic[0];
  }

  async updateDashboardTraffic(userId: string, location: string, status: string, description: string): Promise<void> {
    const existing = await this.getDashboardTraffic(userId);
    if (existing) {
      await db.update(schema.dashboardTrafficCards)
        .set({ location, status, description, lastUpdated: new Date(), lastRefreshedAt: new Date() })
        .where(eq(schema.dashboardTrafficCards.userId, userId));
    } else {
      await db.insert(schema.dashboardTrafficCards).values({
        id: randomUUID(),
        userId,
        location,
        status,
        description,
        lastUpdated: new Date(),
        lastRefreshedAt: new Date()
      });
    }
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return db.select().from(schema.events).orderBy(schema.events.date);
  }

  async createEvent(event: any): Promise<Event> {
    const id = randomUUID();
    await db.insert(schema.events).values({
      ...event,
      id,
      attendees: 0,
      registeredBy: []
    });
    const events = await db.select().from(schema.events).where(eq(schema.events.id, id));
    return events[0];
  }

  async updateEvent(eventId: string, event: any): Promise<void> {
    await db.update(schema.events).set(event).where(eq(schema.events.id, eventId));
  }

  async deleteEvent(eventId: string): Promise<void> {
    await db.delete(schema.events).where(eq(schema.events.id, eventId));
  }

  async registerForEvent(eventId: string, userId: string): Promise<void> {
    const events = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
    if (events.length === 0) return;
    
    const event = events[0];
    const registeredBy = event.registeredBy || [];
    
    if (!registeredBy.includes(userId)) {
      await db.update(schema.events)
        .set({
          registeredBy: [...registeredBy, userId],
          attendees: (event.attendees || 0) + 1
        })
        .where(eq(schema.events.id, eventId));
    }
  }

  // Vendor Services
  async getVendorServices(): Promise<VendorService[]> {
    return db.select().from(schema.vendorServices).where(eq(schema.vendorServices.isActive, true));
  }

  async getVendorServiceById(serviceId: string): Promise<VendorService | undefined> {
    const services = await db.select().from(schema.vendorServices).where(eq(schema.vendorServices.id, serviceId));
    return services[0];
  }

  async createVendorService(service: any): Promise<VendorService> {
    const id = randomUUID();
    await db.insert(schema.vendorServices).values({
      ...service,
      id,
      rating: "0",
      reviewCount: 0,
      verified: false,
      isActive: true
    });
    return (await this.getVendorServiceById(id))!;
  }

  async updateVendorService(serviceId: string, service: any): Promise<void> {
    await db.update(schema.vendorServices).set(service).where(eq(schema.vendorServices.id, serviceId));
  }

  async deleteVendorService(serviceId: string): Promise<void> {
    await db.update(schema.vendorServices).set({ isActive: false }).where(eq(schema.vendorServices.id, serviceId));
  }

  // Admin Settings
  async getAdminSettings(category?: string): Promise<AdminSetting[]> {
    if (category) {
      return db.select().from(schema.adminSettings).where(eq(schema.adminSettings.category, category));
    }
    return db.select().from(schema.adminSettings);
  }

  async getAdminSetting(key: string): Promise<AdminSetting | undefined> {
    const settings = await db.select().from(schema.adminSettings).where(eq(schema.adminSettings.key, key));
    return settings[0];
  }

  async setAdminSetting(key: string, value: string, category: string, isSecret: boolean = false): Promise<void> {
    const existing = await this.getAdminSetting(key);
    if (existing) {
      await db.update(schema.adminSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(schema.adminSettings.key, key));
    } else {
      await db.insert(schema.adminSettings).values({
        id: randomUUID(),
        key,
        value,
        category,
        isSecret,
        updatedAt: new Date()
      });
    }
  }

  // Payments
  async getPayments(userId?: string): Promise<Payment[]> {
    if (userId) {
      return db.select().from(schema.payments).where(eq(schema.payments.userId, userId));
    }
    return db.select().from(schema.payments).orderBy(desc(schema.payments.createdAt));
  }

  async createPayment(payment: any): Promise<Payment> {
    const id = randomUUID();
    await db.insert(schema.payments).values({
      ...payment,
      id,
      status: 'pending'
    });
    const payments = await db.select().from(schema.payments).where(eq(schema.payments.id, id));
    return payments[0];
  }

  async updatePaymentStatus(paymentId: string, status: string, providerRef?: string): Promise<void> {
    const updateData: any = { status };
    if (providerRef) updateData.providerRef = providerRef;
    if (status === 'completed') updateData.completedAt = new Date();
    
    await db.update(schema.payments).set(updateData).where(eq(schema.payments.id, paymentId));
  }

  // Admin User Management
  async getAllUsers(): Promise<UserProfile[]> {
    return db.select().from(schema.userProfiles);
  }

  async getAllVendorApplications(): Promise<VendorApplication[]> {
    return db.select().from(schema.vendorApplications);
  }
}

export const dbStorage = new DatabaseStorage();
