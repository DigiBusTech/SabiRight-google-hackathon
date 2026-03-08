import { db } from './db';
import { eq, desc, and, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { IStorage } from './types';
import { log } from './index';
import type { 
  User, InsertUser, Subscription, Credits, Plan, CreditLog, 
  CloakedRoute, TrafficAlert, DashboardTrafficCard, UserProfile, 
  VendorApplication, Event, VendorService, AdminSetting, Payment,
  Notification, NotificationTemplate, SmtpSettings
} from "@shared/schema";
import { randomUUID } from "crypto";

export class DatabaseStorage {
  constructor() {
    this.seedPlans().catch(err => log(`Failed to seed plans: ${err.message}`, "database"));
  }

  private async seedPlans(): Promise<void> {
    try {
      const existingPlans = await this.getAllPlans();
      if (existingPlans.length === 0) {
        log("Seeding default plans into PostgreSQL...", "database");
        const defaultPlans: any[] = [
          { id: 'free-user', name: 'Free', description: 'Basic access', price: '0', dailyCredits: 5, marketplaceListings: 0, features: ['AI Legal Help', 'Basic Civic Info'], type: 'free', userType: 'user' },
          { id: 'basic-user', name: 'Basic', description: 'Standard access', price: '2000', dailyCredits: 15, marketplaceListings: 3, features: ['AI Legal Help', 'Civic Info', 'Job Matches', 'Events'], type: 'basic', userType: 'user' },
          { id: 'pro-user', name: 'Pro', description: 'Full access', price: '5000', dailyCredits: 50, marketplaceListings: 10, features: ['All Features', 'Priority Support', 'Advanced AI'], type: 'pro', userType: 'user' },
          { id: 'free-vendor', name: 'Vendor Free', description: 'Basic vendor access', price: '0', dailyCredits: 10, marketplaceListings: 3, features: ['List 3 Services', 'Basic Analytics'], type: 'free', userType: 'vendor' },
          { id: 'pro-vendor', name: 'Vendor Pro', description: 'Full vendor access', price: '10000', dailyCredits: 100, marketplaceListings: null, features: ['Unlimited Services', 'Priority Listing', 'Full Analytics'], type: 'pro', userType: 'vendor' },
        ];
        
        for (const plan of defaultPlans) {
          await db.insert(schema.plans).values(plan);
        }
        log("Default plans seeded successfully.", "database");
      }
    } catch (error: any) {
      log(`Error seeding plans: ${error.message}`, "database");
    }
  }

  private async query<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      log(`Database operation failed: ${error.message}`, "database");
      if (error.code === 'ECONNREFUSED' || error.message.includes('connection refused')) {
        throw new Error("Database connection unavailable. Please check if PostgreSQL is running.");
      }
      throw error;
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.query(async () => {
      const users = await db.select().from(schema.users).where(eq(schema.users.id, id));
      return users[0];
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.query(async () => {
      const users = await db.select().from(schema.users).where(eq(schema.users.username, username));
      return users[0];
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.users).values({ ...insertUser, id });
      const newUser = await this.getUser(id);
      if (!newUser) throw new Error("Failed to create user");
      return newUser;
    });
  }

  // Plans
  async getAllPlans(): Promise<Plan[]> {
    return this.query(async () => {
      return db.select().from(schema.plans);
    });
  }

  async getPlansByType(tier: string, userType: 'user' | 'vendor'): Promise<Plan[]> {
    return this.query(async () => {
      return db.select().from(schema.plans).where(
        and(eq(schema.plans.type, tier), eq(schema.plans.userType, userType))
      );
    });
  }

  async getUserPlan(userId: string): Promise<(Plan & Subscription) | undefined> {
    return this.query(async () => {
      const subs = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
      if (subs.length === 0) return undefined;
      const plans = await db.select().from(schema.plans).where(eq(schema.plans.id, subs[0].planId));
      if (!plans[0]) return undefined;
      return { ...plans[0], ...subs[0] };
    });
  }

  async createSubscription(subscription: any): Promise<Subscription> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.subscriptions).values({ ...subscription, id });
      const subs = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id));
      return subs[0];
    });
  }

  async updateSubscriptionStatus(subscriptionId: string, status: string): Promise<void> {
    return this.query(async () => {
      await db.update(schema.subscriptions)
        .set({ status })
        .where(eq(schema.subscriptions.id, subscriptionId));
    });
  }

  async getPlanById(planId: string): Promise<Plan | undefined> {
    return this.query(async () => {
      const plans = await db.select().from(schema.plans).where(eq(schema.plans.id, planId));
      return plans[0];
    });
  }

  async createPlan(plan: any): Promise<Plan> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.plans).values({ ...plan, id });
      const newPlan = await this.getPlanById(id);
      if (!newPlan) throw new Error("Failed to create plan");
      return newPlan;
    });
  }

  async updatePlan(planId: string, updates: any): Promise<Plan | undefined> {
    return this.query(async () => {
      await db.update(schema.plans).set(updates).where(eq(schema.plans.id, planId));
      return this.getPlanById(planId);
    });
  }

  async deletePlan(planId: string): Promise<boolean> {
    try {
      return await this.query(async () => {
        await db.delete(schema.plans).where(eq(schema.plans.id, planId));
        return true;
      });
    } catch (error) {
      return false;
    }
  }

  // Credits
  async getUserCredits(userId: string): Promise<Credits | undefined> {
    return this.query(async () => {
      const credits = await db.select().from(schema.credits).where(eq(schema.credits.userId, userId));
      return credits[0];
    });
  }

  async createCredits(creditsData: any): Promise<Credits> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.credits).values({ ...creditsData, id });
      const credits = await db.select().from(schema.credits).where(eq(schema.credits.id, id));
      return credits[0];
    });
  }

  async deductCredits(userId: string, amount: number, feature: string, description: string): Promise<boolean> {
    return this.query(async () => {
      const credits = await this.getUserCredits(userId);
      if (!credits || (credits.totalCredits || 0) - (credits.usedCredits || 0) < amount) {
        return false;
      }

      await db.update(schema.credits)
        .set({ totalCredits: (credits.totalCredits || 0) - amount })
        .where(eq(schema.credits.userId, userId));

      await db.insert(schema.creditLog).values({
        id: randomUUID(),
        userId,
        amount: -amount,
        action: 'deducted',
        feature,
        description,
        createdAt: new Date()
      });

      return true;
    });
  }

  async refundCredits(userId: string, amount: number, feature: string): Promise<void> {
    return this.query(async () => {
      const credits = await this.getUserCredits(userId);
      if (credits) {
        await db.update(schema.credits)
        .set({ totalCredits: (credits.totalCredits || 0) + amount })
        .where(eq(schema.credits.userId, userId));
        
        await db.insert(schema.creditLog).values({
          id: randomUUID(),
          userId,
          amount,
          action: 'refunded',
          feature,
          description: `Refunded ${amount} credits for ${feature}`,
          createdAt: new Date()
        });
      }
    });
  }

  async addCredits(userId: string, amount: number, reason: string): Promise<void> {
    return this.query(async () => {
      const credits = await this.getUserCredits(userId);
      if (!credits) {
        await this.initializeCredits(userId, amount);
      } else {
        await db.update(schema.credits)
          .set({ totalCredits: (credits.totalCredits || 0) + amount })
          .where(eq(schema.credits.userId, userId));
      }

      await db.insert(schema.creditLog).values({
        id: randomUUID(),
        userId,
        amount,
        action: 'granted',
        feature: 'credit_purchase',
        description: reason,
        createdAt: new Date()
      });
    });
  }

  async refreshDailyCredits(userId: string, dailyAmount: number): Promise<void> {
    return this.query(async () => {
      const credits = await this.getUserCredits(userId);
      if (credits) {
        await db.update(schema.credits)
          .set({ usedCredits: 0, totalCredits: dailyAmount })
          .where(eq(schema.credits.userId, userId));
      }
    });
  }

  async getCreditLog(userId: string, limit: number = 50): Promise<CreditLog[]> {
    return this.query(async () => {
      return db.select().from(schema.creditLog)
        .where(eq(schema.creditLog.userId, userId))
        .orderBy(desc(schema.creditLog.createdAt))
        .limit(limit);
    });
  }

  async initializeCredits(userId: string, initialCredits: number): Promise<void> {
    return this.query(async () => {
      await db.insert(schema.credits).values({
        id: randomUUID(),
        userId,
        totalCredits: initialCredits,
        usedCredits: 0
      });
    });
  }

  // Cloaked Routes
  async getUserRoutes(userId: string): Promise<CloakedRoute[]> {
    return this.query(async () => {
      return db.select().from(schema.cloakedRoutes).where(eq(schema.cloakedRoutes.userId, userId));
    });
  }

  async createRoute(route: any): Promise<CloakedRoute> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.cloakedRoutes).values({ ...route, id });
      const results = await db.select().from(schema.cloakedRoutes).where(eq(schema.cloakedRoutes.id, id));
      return results[0];
    });
  }

  async updateRouteStatus(routeId: string, status: string): Promise<void> {
    return this.query(async () => {
      await db.update(schema.cloakedRoutes).set({ lastStatus: status }).where(eq(schema.cloakedRoutes.id, routeId));
    });
  }

  async deleteRoute(routeId: string): Promise<void> {
    return this.query(async () => {
      await db.delete(schema.cloakedRoutes).where(eq(schema.cloakedRoutes.id, routeId));
    });
  }

  // Traffic Alerts
  async getRouteAlerts(routeId: string, limit: number = 50): Promise<TrafficAlert[]> {
    return this.query(async () => {
      return db.select().from(schema.trafficAlerts)
        .where(eq(schema.trafficAlerts.routeId, routeId))
        .orderBy(desc(schema.trafficAlerts.createdAt))
        .limit(limit);
    });
  }

  async createAlert(alert: any): Promise<TrafficAlert> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.trafficAlerts).values({ ...alert, id });
      const results = await db.select().from(schema.trafficAlerts).where(eq(schema.trafficAlerts.id, id));
      return results[0];
    });
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    return this.query(async () => {
      await db.update(schema.trafficAlerts).set({ acknowledgedAt: new Date() }).where(eq(schema.trafficAlerts.id, alertId));
    });
  }

  // Email Verification & Vendor
  async updateEmailVerificationStatus(userId: string, emailVerificationStatus: string, verificationDocument?: string): Promise<void> {
    return this.query(async () => {
      const updateData: any = { 
        emailVerificationStatus,
        emailVerified: emailVerificationStatus === 'verified',
        emailVerifiedAt: emailVerificationStatus === 'verified' ? new Date() : null
      };
      if (verificationDocument) updateData.verificationDocument = verificationDocument;
      await db.update(schema.userProfiles).set(updateData).where(eq(schema.userProfiles.userId, userId));
    });
  }

  async setEmailVerificationCode(userId: string, code: string, expires: Date): Promise<void> {
    return this.query(async () => {
      await db.update(schema.userProfiles)
        .set({ 
          emailVerificationCode: code, 
          emailVerificationExpires: expires,
          emailVerificationSentAt: new Date()
        })
        .where(eq(schema.userProfiles.userId, userId));
    });
  }

  async verifyEmailCode(userId: string, code: string): Promise<boolean> {
    return this.query(async () => {
      const profile = await this.getUserProfile(userId);
      if (!profile) return false;

      if (!profile.emailVerificationCode || profile.emailVerificationCode !== code) {
        return false;
      }

      if (profile.emailVerificationExpires && profile.emailVerificationExpires < new Date()) {
        return false;
      }

      await this.updateEmailVerificationStatus(userId, 'verified');
      
      // Clear code
      await db.update(schema.userProfiles)
        .set({ 
          emailVerificationCode: null, 
          emailVerificationExpires: null 
        })
        .where(eq(schema.userProfiles.userId, userId));

      return true;
    });
  }

  // User Profiles
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return this.query(async () => {
      const profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
      return profiles[0];
    });
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | undefined> {
    return this.query(async () => {
      const existing = await this.getUserProfile(userId);
      if (existing) {
        await db.update(schema.userProfiles)
          .set(updates)
          .where(eq(schema.userProfiles.userId, userId));
      } else {
        await db.insert(schema.userProfiles).values({
          userId,
          ...updates
        });
      }
      const updatedProfile = await this.getUserProfile(userId);
      if (!updatedProfile) throw new Error("Failed to update user profile");
      return updatedProfile;
    });
  }

  // Vendor Applications
  async getVendorApplication(userId: string): Promise<VendorApplication | undefined> {
    return this.query(async () => {
      const apps = await db.select().from(schema.vendorApplications).where(eq(schema.vendorApplications.userId, userId));
      return apps[0];
    });
  }

  async submitVendorApplication(userId: string, application: any): Promise<VendorApplication> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.vendorApplications).values({
        id,
        userId,
        ...application,
        status: 'pending'
      });
      const newApp = await this.getVendorApplication(userId);
      if (!newApp) throw new Error("Failed to submit vendor application");
      return newApp;
    });
  }

  async approveVendorApplication(userId: string): Promise<void> {
    return this.query(async () => {
      await db.update(schema.vendorApplications)
        .set({ status: 'approved' })
        .where(eq(schema.vendorApplications.userId, userId));
      
      await db.update(schema.userProfiles)
        .set({ isVendor: true })
        .where(eq(schema.userProfiles.userId, userId));
    });
  }

  async rejectVendorApplication(userId: string): Promise<void> {
    return this.query(async () => {
      await db.update(schema.vendorApplications)
        .set({ status: 'rejected' })
        .where(eq(schema.vendorApplications.userId, userId));
    });
  }

  async switchVendorMode(userId: string, vendorMode: boolean): Promise<void> {
    return this.query(async () => {
      await db.update(schema.userProfiles)
        .set({ vendorMode })
        .where(eq(schema.userProfiles.userId, userId));
    });
  }

  // Dashboard Traffic
  async getDashboardTraffic(userId: string): Promise<DashboardTrafficCard | undefined> {
    return this.query(async () => {
      const traffic = await db.select().from(schema.dashboardTrafficCards).where(eq(schema.dashboardTrafficCards.userId, userId));
      return traffic[0];
    });
  }

  async updateDashboardTraffic(userId: string, location: string, status: string, description: string): Promise<void> {
    return this.query(async () => {
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
    });
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return this.query(async () => {
      return db.select().from(schema.events).orderBy(schema.events.date);
    });
  }

  async createEvent(event: any): Promise<Event> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.events).values({
        ...event,
        id,
        attendees: 0,
        registeredBy: []
      });
      const events = await db.select().from(schema.events).where(eq(schema.events.id, id));
      return events[0];
    });
  }

  async updateEvent(eventId: string, event: any): Promise<void> {
    return this.query(async () => {
      await db.update(schema.events).set(event).where(eq(schema.events.id, eventId));
    });
  }

  async deleteEvent(eventId: string): Promise<void> {
    return this.query(async () => {
      await db.delete(schema.events).where(eq(schema.events.id, eventId));
    });
  }

  async registerForEvent(eventId: string, userId: string): Promise<void> {
    return this.query(async () => {
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
    });
  }

  // Vendor Services
  async getVendorServices(filters?: { type?: string, city?: string, specialization?: string, lat?: number, lng?: number }): Promise<VendorService[]> {
    return this.query(async () => {
      let results: VendorService[];
      
      if (filters) {
        const conditions = [eq(schema.vendorServices.isActive, true)];
        if (filters.type) {
          conditions.push(eq(schema.vendorServices.type, filters.type));
        }
        if (filters.specialization) {
          conditions.push(eq(schema.vendorServices.specialization, filters.specialization));
        }
        
        results = await db.select().from(schema.vendorServices).where(and(...conditions));

        if (filters.lat && filters.lng) {
          const R = 6371; // Earth's radius in km
          const fLat = filters.lat;
          const fLng = filters.lng;
          const servicesWithDistance = results.map(s => {
            const sLat = parseFloat(s.latitude || '0');
            const sLng = parseFloat(s.longitude || '0');
            if (sLat === 0 && sLng === 0) return { ...s, distance: 9999 };
            
            const dLat = (sLat - fLat) * Math.PI / 180;
            const dLon = (sLng - fLng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(fLat * Math.PI / 180) * Math.cos(sLat * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return { ...s, distance: R * c };
          });
          servicesWithDistance.sort((a, b) => (a as any).distance - (b as any).distance);
          return servicesWithDistance as VendorService[];
        } else if (filters.city) {
          const cityLower = filters.city.toLowerCase();
          return results.filter(s => s.location?.toLowerCase().includes(cityLower));
        }
        return results;
      }
      
      return db.select().from(schema.vendorServices).where(eq(schema.vendorServices.isActive, true));
    });
  }

  async getVendorServiceById(serviceId: string): Promise<VendorService | undefined> {
    return this.query(async () => {
      const services = await db.select().from(schema.vendorServices).where(eq(schema.vendorServices.id, serviceId));
      return services[0];
    });
  }

  async createVendorService(service: any): Promise<VendorService> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.vendorServices).values({
        ...service,
        id,
        rating: "0",
        reviewCount: 0,
        verified: false,
        isActive: true
      });
      const newService = await this.getVendorServiceById(id);
      if (!newService) throw new Error("Failed to create vendor service");
      return newService;
    });
  }

  async updateVendorService(serviceId: string, service: any): Promise<void> {
    return this.query(async () => {
      await db.update(schema.vendorServices).set(service).where(eq(schema.vendorServices.id, serviceId));
    });
  }

  async deleteVendorService(serviceId: string): Promise<void> {
    return this.query(async () => {
      await db.update(schema.vendorServices).set({ isActive: false }).where(eq(schema.vendorServices.id, serviceId));
    });
  }

  // Admin Settings
  async getAdminSettings(category?: string): Promise<AdminSetting[]> {
    return this.query(async () => {
      if (category) {
        return db.select().from(schema.adminSettings).where(eq(schema.adminSettings.category, category));
      }
      return db.select().from(schema.adminSettings);
    });
  }

  async getAdminSetting(key: string): Promise<AdminSetting | undefined> {
    return this.query(async () => {
      const settings = await db.select().from(schema.adminSettings).where(eq(schema.adminSettings.key, key));
      return settings[0];
    });
  }

  async setAdminSetting(key: string, value: string, category: string, isSecret: boolean = false): Promise<void> {
    return this.query(async () => {
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
    });
  }

  // Payments
  async getPayments(userId?: string): Promise<Payment[]> {
    return this.query(async () => {
      if (userId) {
        return db.select().from(schema.payments).where(eq(schema.payments.userId, userId));
      }
      return db.select().from(schema.payments).orderBy(desc(schema.payments.createdAt));
    });
  }

  async createPayment(payment: any): Promise<Payment> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.payments).values({
        ...payment,
        id,
        status: 'pending'
      });
      const payments = await db.select().from(schema.payments).where(eq(schema.payments.id, id));
      return payments[0];
    });
  }

  async updatePaymentStatus(paymentId: string, status: string, providerRef?: string): Promise<void> {
    return this.query(async () => {
      const updateData: any = { status };
      if (providerRef) updateData.providerRef = providerRef;
      if (status === 'completed') updateData.completedAt = new Date();
      
      await db.update(schema.payments).set(updateData).where(eq(schema.payments.id, paymentId));
    });
  }

  // Admin User Management
  async getAllUsers(): Promise<UserProfile[]> {
    return this.query(async () => {
      return db.select().from(schema.userProfiles);
    });
  }

  async getAllVendorApplications(): Promise<VendorApplication[]> {
    return this.query(async () => {
      return db.select().from(schema.vendorApplications);
    });
  }

  async setUserAsAdmin(userId: string): Promise<boolean> {
    return this.toggleUserAdmin(userId, true);
  }

  async toggleUserAdmin(userId: string, isAdmin: boolean): Promise<boolean> {
    return this.query(async () => {
      try {
        await db.update(schema.userProfiles)
          .set({ isAdmin })
          .where(eq(schema.userProfiles.userId, userId));
        return true;
      } catch (error) {
        return false;
      }
    });
  }

  async getAllVendors(): Promise<UserProfile[]> {
    return this.query(async () => {
      return db.select().from(schema.userProfiles).where(eq(schema.userProfiles.isVendor, true));
    });
  }

  async getImpersonationToken(userId: string): Promise<string> {
    // This is a placeholder. In a real app, you'd generate a temporary JWT or similar.
    // For now, we'll return a special token that the client can use to log in as this user.
    return `impersonate_${userId}_${Date.now()}`;
  }

  async deleteUser(userId: string): Promise<boolean> {
    return this.query(async () => {
      try {
        await db.delete(schema.users).where(eq(schema.users.id, userId));
        await db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
        await db.delete(schema.credits).where(eq(schema.credits.userId, userId));
        return true;
      } catch (error) {
        console.error('Failed to delete user:', error);
        return false;
      }
    });
  }

  // Jobs
  async getJobs(limit: number = 50): Promise<any[]> {
    return this.query(async () => {
      const query = db.select().from(schema.generatedJobs).orderBy(desc(schema.generatedJobs.createdAt));
      if (limit) {
        return query.limit(limit);
      }
      return query;
    });
  }

  async createJob(job: any): Promise<any> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.generatedJobs).values({
        id,
        userId: job.userId || job.postedBy,
        jobData: job.jobData || job,
        source: job.source || 'system'
      });
      return (await db.select().from(schema.generatedJobs).where(eq(schema.generatedJobs.id, id)))[0];
    });
  }

  async updateJob(jobId: string, updates: any): Promise<void> {
    return this.query(async () => {
      await db.update(schema.generatedJobs)
        .set({ jobData: updates })
        .where(eq(schema.generatedJobs.id, jobId));
    });
  }

  async deleteJob(jobId: string): Promise<void> {
    return this.query(async () => {
      await db.delete(schema.generatedJobs).where(eq(schema.generatedJobs.id, jobId));
    });
  }

  // Vendor Analytics
  async getVendorStats(vendorId: string): Promise<any> {
    return this.query(async () => {
      const bookings = await db.select().from(schema.bookings).where(eq(schema.bookings.vendorId, vendorId));
      const totalEarnings = bookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + parseFloat(b.totalAmount), 0);
      
      return {
        totalLeads: 0, // Would need a leads table
        totalBookings: bookings.length,
        totalEarnings,
        thisMonthLeads: 0,
        thisMonthBookings: 0,
        thisMonthEarnings: 0
      };
    });
  }

  async getVendorLeads(vendorId: string): Promise<any[]> {
    return [];
  }

  async getVendorBookings(vendorId: string): Promise<any[]> {
    return this.query(async () => {
      return db.select().from(schema.bookings).where(eq(schema.bookings.vendorId, vendorId));
    });
  }

  async createVendorLead(lead: any): Promise<any> {
    return { id: randomUUID(), ...lead, createdAt: new Date() };
  }

  async createVendorBooking(booking: any): Promise<any> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.bookings).values({ ...booking, id });
      return (await db.select().from(schema.bookings).where(eq(schema.bookings.id, id)))[0];
    });
  }

  async setUserCredits(userId: string, totalCredits: number): Promise<void> {
    return this.query(async () => {
      const existing = await this.getUserCredits(userId);
      if (existing) {
        await db.update(schema.credits)
          .set({ totalCredits })
          .where(eq(schema.credits.userId, userId));
      } else {
        await db.insert(schema.credits).values({
          id: randomUUID(),
          userId,
          totalCredits,
          usedCredits: 0
        });
      }
    });
  }

  // Escrow & Disputes
  async getDisputes(): Promise<any[]> {
    return this.query(async () => {
      return db.select().from(schema.disputes).orderBy(desc(schema.disputes.createdAt));
    });
  }

  async getDisputeById(id: string): Promise<any | undefined> {
    return this.query(async () => {
      const results = await db.select().from(schema.disputes).where(eq(schema.disputes.id, id));
      return results[0];
    });
  }

  async createDispute(dispute: any): Promise<any> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.disputes).values({ ...dispute, id, status: 'open', adminJoined: false });
      return (await this.getDisputeById(id));
    });
  }

  async updateDisputeStatus(id: string, status: string, resolution?: string, notes?: string, resolvedBy?: string): Promise<void> {
    return this.query(async () => {
      const updateData: any = { status };
      if (resolution) updateData.resolution = resolution;
      if (notes) updateData.resolutionNotes = notes;
      if (resolvedBy) updateData.resolvedBy = resolvedBy;
      if (status === 'resolved') updateData.resolvedAt = new Date();
      
      await db.update(schema.disputes).set(updateData).where(eq(schema.disputes.id, id));
    });
  }

  async joinDispute(id: string, adminId: string): Promise<any | undefined> {
    return this.query(async () => {
      await db.update(schema.disputes)
        .set({ adminJoined: true, status: 'under_review' })
        .where(eq(schema.disputes.id, id));
      return await this.getDisputeById(id);
    });
  }

  async getBookingById(id: string): Promise<any | undefined> {
    return this.query(async () => {
      const results = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
      return results[0];
    });
  }

  async updateBookingStatus(id: string, status: string): Promise<void> {
    return this.query(async () => {
      await db.update(schema.bookings).set({ status }).where(eq(schema.bookings.id, id));
    });
  }

  async getEscrowByBookingId(bookingId: string): Promise<any | undefined> {
    return this.query(async () => {
      const results = await db.select().from(schema.escrowAccounts).where(eq(schema.escrowAccounts.bookingId, bookingId));
      return results[0];
    });
  }

  async updateEscrowStatus(id: string, status: string, releasedAmount?: string): Promise<void> {
    return this.query(async () => {
      const updateData: any = { status };
      if (releasedAmount) updateData.releasedAmount = releasedAmount;
      if (status === 'released' || status === 'refunded') updateData.releasedAt = new Date();
      
      await db.update(schema.escrowAccounts).set(updateData).where(eq(schema.escrowAccounts.id, id));
    });
  }

  async getWalletByUserId(userId: string): Promise<any | undefined> {
    return this.query(async () => {
      const results = await db.select().from(schema.wallets).where(eq(schema.wallets.userId, userId));
      return results[0];
    });
  }

  async topUpWallet(userId: string, amount: number, reference: string, description: string): Promise<void> {
    return this.query(async () => {
      let wallet = await this.getWalletByUserId(userId);
      if (!wallet) {
        const id = randomUUID();
        await db.insert(schema.wallets).values({
          id,
          userId,
          balance: "0",
          currency: "NGN"
        });
        wallet = await this.getWalletByUserId(userId);
      }

      if (wallet) {
        const currentBalance = parseFloat(wallet.balance || "0");
        const newBalance = (currentBalance + amount).toString();
        
        await db.update(schema.wallets)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(schema.wallets.id, wallet.id));
          
        await db.insert(schema.walletTransactions).values({
          id: randomUUID(),
          walletId: wallet.id,
          type: 'deposit',
          amount: amount.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance,
          reference,
          description
        });
      }
    });
  }

  async createBookingMessage(message: any): Promise<any> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.bookingMessages).values({ ...message, id });
      const results = await db.select().from(schema.bookingMessages).where(eq(schema.bookingMessages.id, id));
      return results[0];
    });
  }

  // Notifications
  async createNotification(notification: any): Promise<Notification> {
    return this.query(async () => {
      const id = randomUUID();
      const newNotification = {
        ...notification,
        id,
        isRead: false,
        createdAt: new Date(),
      };
      await db.insert(schema.notifications).values(newNotification);
      const results = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id));
      return results[0];
    });
  }

  async getNotificationsByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    return this.query(async () => {
      return db.select().from(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .orderBy(desc(schema.notifications.createdAt))
        .limit(limit);
    });
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return this.query(async () => {
      const results = await db.select({ count: sql<number>`count(*)` })
        .from(schema.notifications)
        .where(and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, false)
        ));
      return results[0]?.count || 0;
    });
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    return this.query(async () => {
      await db.update(schema.notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(eq(schema.notifications.id, notificationId));
    });
  }

  async sendNotification(options: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    templateName?: string;
    variables?: Record<string, string>;
    channels?: string[];
  }): Promise<Notification> {
    let { title, message } = options;
    const { userId, type, data, templateName, variables } = options;

    if (templateName) {
      const template = await this.getNotificationTemplateByName(templateName);
      if (template && template.isActive) {
        title = this.substituteVariables(template.subject, variables || {});
        message = this.substituteVariables(template.bodyTemplate, variables || {});
      }
    }

    if (options.channels?.includes('email')) {
      console.log(`[Email Mock] Verification/Notification for ${userId}: ${title} - ${message}`);
    }

    return this.createNotification({
      userId,
      type,
      title,
      message,
      data: data || {},
      channel: (options.channels || ['in_app']).join(',')
    });
  }

  async getNotificationTemplateByName(name: string): Promise<NotificationTemplate | undefined> {
    return this.query(async () => {
      const templates = await db.select().from(schema.notificationTemplates).where(eq(schema.notificationTemplates.name, name));
      return templates[0];
    });
  }

  // Forum
  async getForumPost(postId: string): Promise<any | undefined> {
    // Forum is currently Firestore-only, but we provide placeholders for IStorage compliance
    return undefined;
  }

  async createForumPost(post: any): Promise<any> {
    // Placeholder for IStorage compliance
    return { id: randomUUID(), ...post, timestamp: new Date() };
  }

  async updateForumPost(postId: string, updates: any): Promise<void> {
    // Forum is currently Firestore-only
  }

  async deleteForumPost(postId: string): Promise<void> {
    // Forum is currently Firestore-only
  }

  // MOAT Data
  async getMoatData(category?: string): Promise<any[]> {
    return this.query(async () => {
      if (category) {
        return db.select().from(schema.moatData)
          .where(eq(schema.moatData.category, category))
          .orderBy(desc(schema.moatData.createdAt));
      }
      return db.select().from(schema.moatData).orderBy(desc(schema.moatData.createdAt));
    });
  }

  async createMoatData(data: any): Promise<any> {
    return this.query(async () => {
      const id = randomUUID();
      await db.insert(schema.moatData).values({
        id,
        ...data,
        createdAt: new Date()
      });
      const items = await db.select().from(schema.moatData).where(eq(schema.moatData.id, id));
      return items[0];
    });
  }

  async deleteMoatData(id: string): Promise<void> {
    return this.query(async () => {
      await db.delete(schema.moatData).where(eq(schema.moatData.id, id));
    });
  }

  private substituteVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
}

export const dbStorage = new DatabaseStorage();
