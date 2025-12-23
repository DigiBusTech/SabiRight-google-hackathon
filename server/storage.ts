import { type User, type InsertUser, type Subscription, type Credits, type Plan, type CreditLog, type CloakedRoute, type TrafficAlert, type DashboardTrafficCard, type UserProfile, type VendorApplication } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Subscriptions & Plans
  getUserPlan(userId: string): Promise<(Plan & Subscription) | undefined>;
  createSubscription(subscription: any): Promise<Subscription>;
  updateSubscriptionStatus(subscriptionId: string, status: string): Promise<void>;
  
  // Credits
  getUserCredits(userId: string): Promise<Credits | undefined>;
  createCredits(credits: any): Promise<Credits>;
  deductCredits(userId: string, amount: number, feature: string, description: string): Promise<boolean>;
  refundCredits(userId: string, amount: number, feature: string): Promise<void>;
  refreshDailyCredits(userId: string, dailyAmount: number): Promise<void>;
  
  // Credit Log
  getCreditLog(userId: string, limit?: number): Promise<CreditLog[]>;
  
  // Plans
  getAllPlans(): Promise<Plan[]>;
  getPlanById(planId: string): Promise<Plan | undefined>;
  getPlansByType(type: 'free' | 'basic' | 'pro' | 'enterprise', userType: 'user' | 'vendor'): Promise<Plan[]>;

  // Cloaked Routes
  getUserRoutes(userId: string): Promise<CloakedRoute[]>;
  createRoute(route: any): Promise<CloakedRoute>;
  updateRouteStatus(routeId: string, status: string): Promise<void>;
  deleteRoute(routeId: string): Promise<void>;

  // Traffic Alerts
  getRouteAlerts(routeId: string, limit?: number): Promise<TrafficAlert[]>;
  createAlert(alert: any): Promise<TrafficAlert>;
  acknowledgeAlert(alertId: string): Promise<void>;

  // KYC & Vendor
  updateUserKYC(userId: string, kycStatus: string, kycDocument?: string): Promise<void>;
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  updateUserProfile(userId: string, profile: any): Promise<void>;
  submitVendorApplication(userId: string, app: any): Promise<VendorApplication>;
  getVendorApplication(userId: string): Promise<VendorApplication | undefined>;
  approveVendorApplication(userId: string): Promise<void>;
  rejectVendorApplication(userId: string): Promise<void>;
  switchVendorMode(userId: string, vendorMode: boolean): Promise<void>;

  // Dashboard Traffic
  getDashboardTraffic(userId: string): Promise<DashboardTrafficCard | undefined>;
  updateDashboardTraffic(userId: string, location: string, status: string, description: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private subscriptions: Map<string, Subscription>;
  private credits: Map<string, Credits>;
  private creditLogs: Map<string, CreditLog[]>;
  private plans: Map<string, Plan>;
  private routes: Map<string, CloakedRoute>;
  private alerts: Map<string, TrafficAlert>;
  private userProfiles: Map<string, UserProfile>;
  private vendorApplications: Map<string, VendorApplication>;
  private dashboardTraffic: Map<string, DashboardTrafficCard>;

  constructor() {
    this.users = new Map();
    this.subscriptions = new Map();
    this.credits = new Map();
    this.creditLogs = new Map();
    this.plans = this.initializePlans();
    this.routes = new Map();
    this.alerts = new Map();
    this.userProfiles = new Map();
    this.vendorApplications = new Map();
    this.dashboardTraffic = new Map();
  }

  private initializePlans(): Map<string, Plan> {
    const plans = new Map<string, Plan>();
    
    // User Plans
    const userFreePlan: Plan = {
      id: 'plan-user-free',
      name: 'Free',
      description: 'Limited daily credits for essential features',
      type: 'free',
      userType: 'user',
      price: null,
      billingCycle: null,
      dailyCredits: 10,
      marketplaceListings: null,
      features: ['civic_guard', 'job_search', 'marketplace_browse', 'community_forum', 'events']
    };
    
    const userProPlan: Plan = {
      id: 'plan-user-pro',
      name: 'Pro',
      description: 'Unlimited credits and premium features',
      type: 'pro',
      userType: 'user',
      price: '9.99',
      billingCycle: 'monthly',
      dailyCredits: 100,
      marketplaceListings: null,
      features: ['civic_guard_priority', 'job_search_unlimited', 'marketplace_features', 'community_forum', 'events']
    };
    
    // Vendor Plans
    const vendorFreePlan: Plan = {
      id: 'plan-vendor-free',
      name: 'Free Vendor',
      description: 'List up to 3 services',
      type: 'free',
      userType: 'vendor',
      price: null,
      billingCycle: null,
      dailyCredits: null,
      marketplaceListings: 3,
      features: ['marketplace_listing', 'basic_profile', 'client_messaging']
    };
    
    const vendorProPlan: Plan = {
      id: 'plan-vendor-pro',
      name: 'Professional',
      description: 'Unlimited listings and analytics',
      type: 'pro',
      userType: 'vendor',
      price: '19.99',
      billingCycle: 'monthly',
      dailyCredits: null,
      marketplaceListings: 999,
      features: ['unlimited_listings', 'analytics_dashboard', 'priority_support', 'customer_reviews', 'booking_system']
    };

    plans.set(userFreePlan.id, userFreePlan);
    plans.set(userProPlan.id, userProPlan);
    plans.set(vendorFreePlan.id, vendorFreePlan);
    plans.set(vendorProPlan.id, vendorProPlan);
    
    return plans;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    // Initialize free plan credits
    await this.createCredits({ userId: id, totalCredits: 10, usedCredits: 0 });
    return user;
  }

  // Plans
  async getAllPlans(): Promise<Plan[]> {
    return Array.from(this.plans.values());
  }

  async getPlanById(planId: string): Promise<Plan | undefined> {
    return this.plans.get(planId);
  }

  async getPlansByType(type: 'free' | 'basic' | 'pro' | 'enterprise', userType: 'user' | 'vendor'): Promise<Plan[]> {
    return Array.from(this.plans.values()).filter(
      p => p.type === type && p.userType === userType
    );
  }

  // Subscriptions
  async getUserPlan(userId: string): Promise<(Plan & Subscription) | undefined> {
    const subscription = Array.from(this.subscriptions.values()).find(
      s => s.userId === userId && s.status === 'active'
    );
    if (!subscription) return undefined;
    
    const plan = this.plans.get(subscription.planId);
    if (!plan) return undefined;
    
    return { ...plan, ...subscription };
  }

  async createSubscription(subscription: any): Promise<Subscription> {
    const id = randomUUID();
    const newSub: Subscription = { 
      ...subscription, 
      id,
      startDate: new Date(),
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
    this.subscriptions.set(id, newSub);
    return newSub;
  }

  async updateSubscriptionStatus(subscriptionId: string, status: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      this.subscriptions.set(subscriptionId, { ...sub, status });
    }
  }

  // Credits
  async getUserCredits(userId: string): Promise<Credits | undefined> {
    return this.credits.get(userId);
  }

  async createCredits(credits: any): Promise<Credits> {
    const newCredits: Credits = {
      id: randomUUID(),
      userId: credits.userId,
      totalCredits: credits.totalCredits || 10,
      usedCredits: credits.usedCredits || 0,
      lastRefreshDate: new Date(),
      renewalDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
    this.credits.set(credits.userId, newCredits);
    return newCredits;
  }

  async deductCredits(userId: string, amount: number, feature: string, description: string): Promise<boolean> {
    const credits = this.credits.get(userId);
    if (!credits) return false;

    const totalCredits = credits.totalCredits || 0;
    const usedCredits = credits.usedCredits || 0;
    const availableCredits = totalCredits - usedCredits;
    if (availableCredits < amount) return false;

    credits.usedCredits = usedCredits + amount;
    this.credits.set(userId, credits);
    
    // Log the transaction
    if (!this.creditLogs.has(userId)) {
      this.creditLogs.set(userId, []);
    }
    
    const log: CreditLog = {
      id: randomUUID(),
      userId,
      amount: -amount,
      action: 'used',
      feature,
      description,
      createdAt: new Date()
    };
    
    this.creditLogs.get(userId)!.push(log);
    return true;
  }

  async refundCredits(userId: string, amount: number, feature: string): Promise<void> {
    const credits = this.credits.get(userId);
    if (credits) {
      const usedCredits = credits.usedCredits || 0;
      credits.usedCredits = Math.max(0, usedCredits - amount);
      this.credits.set(userId, credits);
      
      if (!this.creditLogs.has(userId)) {
        this.creditLogs.set(userId, []);
      }
      
      const log: CreditLog = {
        id: randomUUID(),
        userId,
        amount,
        action: 'refunded',
        feature,
        description: 'Credit refunded',
        createdAt: new Date()
      };
      
      this.creditLogs.get(userId)!.push(log);
    }
  }

  async refreshDailyCredits(userId: string, dailyAmount: number): Promise<void> {
    const credits = this.credits.get(userId);
    if (credits) {
      const now = new Date();
      const lastRefresh = credits.lastRefreshDate ? new Date(credits.lastRefreshDate) : new Date();
      
      // Check if 24 hours have passed
      if (now.getTime() - lastRefresh.getTime() >= 24 * 60 * 60 * 1000) {
        const total = credits.totalCredits || 0;
        credits.totalCredits = total + dailyAmount;
        credits.usedCredits = 0;
        credits.lastRefreshDate = now;
        credits.renewalDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        this.credits.set(userId, credits);
      }
    }
  }

  async getCreditLog(userId: string, limit: number = 20): Promise<CreditLog[]> {
    const logs = this.creditLogs.get(userId) || [];
    return logs.slice(-limit).reverse();
  }

  // Cloaked Routes
  async getUserRoutes(userId: string): Promise<CloakedRoute[]> {
    return Array.from(this.routes.values()).filter(r => r.userId === userId && r.isActive);
  }

  async createRoute(route: any): Promise<CloakedRoute> {
    const id = randomUUID();
    const newRoute: CloakedRoute = {
      ...route,
      id,
      lastChecked: new Date(),
      createdAt: new Date(),
      isActive: true,
      lastStatus: 'active'
    };
    this.routes.set(id, newRoute);
    return newRoute;
  }

  async updateRouteStatus(routeId: string, status: string): Promise<void> {
    const route = this.routes.get(routeId);
    if (route) {
      route.lastStatus = status;
      route.lastChecked = new Date();
      this.routes.set(routeId, route);
    }
  }

  async deleteRoute(routeId: string): Promise<void> {
    const route = this.routes.get(routeId);
    if (route) {
      route.isActive = false;
      this.routes.set(routeId, route);
    }
  }

  // Traffic Alerts
  async getRouteAlerts(routeId: string, limit: number = 20): Promise<TrafficAlert[]> {
    return Array.from(this.alerts.values())
      .filter(a => a.routeId === routeId)
      .slice(-limit)
      .reverse();
  }

  async createAlert(alert: any): Promise<TrafficAlert> {
    const id = randomUUID();
    const newAlert: TrafficAlert = {
      ...alert,
      id,
      createdAt: new Date()
    };
    this.alerts.set(id, newAlert);
    return newAlert;
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledgedAt = new Date();
      this.alerts.set(alertId, alert);
    }
  }

  // KYC & Vendor
  async updateUserKYC(userId: string, kycStatus: string, kycDocument?: string): Promise<void> {
    const profile = this.userProfiles.get(userId);
    if (profile) {
      profile.kycStatus = kycStatus;
      if (kycDocument) profile.kycDocument = kycDocument;
      if (kycStatus === 'verified') {
        profile.kycVerifiedAt = new Date();
      }
      profile.kycSubmittedAt = new Date();
      this.userProfiles.set(userId, profile);
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return this.userProfiles.get(userId);
  }

  async updateUserProfile(userId: string, profile: any): Promise<void> {
    const existing = this.userProfiles.get(userId);
    if (existing) {
      const updated = { ...existing, ...profile };
      this.userProfiles.set(userId, updated);
    }
  }

  async submitVendorApplication(userId: string, app: any): Promise<VendorApplication> {
    const id = randomUUID();
    const application: VendorApplication = {
      ...app,
      id,
      userId,
      status: 'pending',
      kycStatus: 'pending',
      createdAt: new Date()
    };
    this.vendorApplications.set(id, application);
    return application;
  }

  async getVendorApplication(userId: string): Promise<VendorApplication | undefined> {
    return Array.from(this.vendorApplications.values()).find(a => a.userId === userId);
  }

  async approveVendorApplication(userId: string): Promise<void> {
    const app = Array.from(this.vendorApplications.values()).find(a => a.userId === userId);
    if (app) {
      app.status = 'approved';
      app.approvedAt = new Date();
      app.kycStatus = 'verified';
      app.kycVerifiedAt = new Date();
      this.vendorApplications.set(app.id, app);
      
      const profile = this.userProfiles.get(userId);
      if (profile) {
        profile.isVendor = true;
        this.userProfiles.set(userId, profile);
      }
    }
  }

  async rejectVendorApplication(userId: string): Promise<void> {
    const app = Array.from(this.vendorApplications.values()).find(a => a.userId === userId);
    if (app) {
      app.status = 'rejected';
      this.vendorApplications.set(app.id, app);
    }
  }

  async switchVendorMode(userId: string, vendorMode: boolean): Promise<void> {
    const profile = this.userProfiles.get(userId);
    if (profile && profile.isVendor) {
      profile.vendorMode = vendorMode;
      this.userProfiles.set(userId, profile);
    }
  }

  async getDashboardTraffic(userId: string): Promise<DashboardTrafficCard | undefined> {
    return this.dashboardTraffic.get(userId);
  }

  async updateDashboardTraffic(userId: string, location: string, status: string, description: string): Promise<void> {
    const existing = this.dashboardTraffic.get(userId);
    const traffic: DashboardTrafficCard = existing || {
      id: randomUUID(),
      userId,
      location,
      status,
      description,
      lastUpdated: new Date(),
      lastRefreshedAt: new Date()
    };
    if (existing) {
      traffic.location = location;
      traffic.status = status;
      traffic.description = description;
      traffic.lastUpdated = new Date();
      traffic.lastRefreshedAt = new Date();
    }
    this.dashboardTraffic.set(userId, traffic);
  }
}

export const storage = new MemStorage();
