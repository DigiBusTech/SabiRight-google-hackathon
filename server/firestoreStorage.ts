import admin from 'firebase-admin';
import { type User, type InsertUser, type Subscription, type Credits, type Plan, type CreditLog, type CloakedRoute, type TrafficAlert, type DashboardTrafficCard, type UserProfile, type VendorApplication, type Event, type VendorService, type AdminSetting, type Payment, type Coupon, type Wallet, type WalletTransaction, type Booking, type BookingMilestone, type EscrowAccount, type EscrowEvent, type Contract, type Dispute, type BookingMessage, type Notification, type NotificationTemplate, type SmtpSettings, type PushSubscription } from "@shared/schema";
import { type IStorage } from "./storage";

const FIREBASE_APP_ID = 'digital-citizen-v2';

export async function verifyUserToken(idToken: string): Promise<{ 
  valid: boolean; 
  userId?: string; 
  error?: 'invalid_token';
}> {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return { valid: true, userId: decodedToken.uid };
  } catch (error) {
    console.error('User auth: Token verification failed', error);
    return { valid: false, error: 'invalid_token' };
  }
}

export async function verifyAdminToken(idToken: string): Promise<{ 
  valid: boolean; 
  userId?: string; 
  isAdmin?: boolean;
  error?: 'invalid_token' | 'no_profile' | 'not_admin';
}> {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    
    const profileDoc = await admin.firestore()
      .collection('artifacts')
      .doc(FIREBASE_APP_ID)
      .collection('profiles')
      .doc(userId)
      .get();
    
    if (!profileDoc.exists) {
      console.log(`Admin auth: No profile found for user ${userId}`);
      return { valid: false, userId, isAdmin: false, error: 'no_profile' };
    }
    
    const profile = profileDoc.data();
    const isAdmin = profile?.isAdmin === true;
    
    if (!isAdmin) {
      console.log(`Admin auth: User ${userId} is not an admin`);
      return { valid: false, userId, isAdmin: false, error: 'not_admin' };
    }
    
    return { valid: true, userId, isAdmin: true };
  } catch (error) {
    console.error('Admin auth: Token verification failed', error);
    return { valid: false, error: 'invalid_token' };
  }
}

function initializeFirebase() {
  if (admin.apps && admin.apps.length > 0) {
    return admin.app();
  }
  
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }
  
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON');
  }
  
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'legal-13d13',
  });
}

initializeFirebase();
const db = admin.firestore();

const collections = {
  users: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('users'),
  profiles: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('profiles'),
  subscriptions: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('subscriptions'),
  credits: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('credits'),
  creditLogs: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('creditLogs'),
  plans: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('plans'),
  routes: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('routes'),
  alerts: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('alerts'),
  vendorApplications: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('vendorApplications'),
  dashboardTraffic: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('dashboardTraffic'),
  events: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('events'),
  vendorServices: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('vendorServices'),
  adminSettings: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('adminSettings'),
  payments: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('payments'),
  jobs: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('jobs'),
  vendorLeads: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('vendorLeads'),
  vendorBookings: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('vendorBookings'),
  coupons: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('coupons'),
  wallets: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('wallets'),
  walletTransactions: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('walletTransactions'),
  bookings: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('bookings'),
  bookingMilestones: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('bookingMilestones'),
  escrowAccounts: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('escrowAccounts'),
  escrowEvents: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('escrowEvents'),
  contracts: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('contracts'),
  disputes: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('disputes'),
  bookingMessages: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('bookingMessages'),
  savedEvents: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('savedEvents'),
  savedJobs: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('savedJobs'),
  appliedJobs: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('appliedJobs'),
  generatedJobs: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('generatedJobs'),
  notifications: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('notifications'),
  notificationTemplates: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('notificationTemplates'),
  smtpSettings: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('smtpSettings'),
  pushSubscriptions: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('pushSubscriptions'),
};

export class FirestoreStorage implements IStorage {
  
  constructor() {
    this.initializeDefaults();
  }

  private async initializeDefaults(): Promise<void> {
    const plansSnapshot = await collections.plans().get();
    if (plansSnapshot.empty) {
      const defaultPlans: any[] = [
        { id: 'free-user', name: 'Free', description: 'Basic access', price: '0', dailyCredits: 5, marketplaceListings: 0, features: ['AI Legal Help', 'Basic Civic Info'], type: 'free', userType: 'user' },
        { id: 'basic-user', name: 'Basic', description: 'Standard access', price: '2000', dailyCredits: 15, marketplaceListings: 3, features: ['AI Legal Help', 'Civic Info', 'Job Matches', 'Events'], type: 'basic', userType: 'user' },
        { id: 'pro-user', name: 'Pro', description: 'Full access', price: '5000', dailyCredits: 50, marketplaceListings: 10, features: ['All Features', 'Priority Support', 'Advanced AI'], type: 'pro', userType: 'user' },
        { id: 'free-vendor', name: 'Vendor Free', description: 'Basic vendor access', price: '0', dailyCredits: 10, marketplaceListings: 3, features: ['List 3 Services', 'Basic Analytics'], type: 'free', userType: 'vendor' },
        { id: 'pro-vendor', name: 'Vendor Pro', description: 'Full vendor access', price: '10000', dailyCredits: 100, marketplaceListings: null, features: ['Unlimited Services', 'Priority Listing', 'Full Analytics'], type: 'pro', userType: 'vendor' },
      ];
      
      const batch = db.batch();
      defaultPlans.forEach(plan => {
        batch.set(collections.plans().doc(plan.id), plan);
      });
      await batch.commit();
    }

    const settingsSnapshot = await collections.adminSettings().get();
    if (settingsSnapshot.empty) {
      const defaults = [
        { key: 'google_maps_api_key', value: '', category: 'api_keys', isSecret: true },
        { key: 'gemini_api_key', value: '', category: 'api_keys', isSecret: true },
        { key: 'stripe_enabled', value: 'true', category: 'payments', isSecret: false },
        { key: 'paystack_enabled', value: 'true', category: 'payments', isSecret: false },
        { key: 'flutterwave_enabled', value: 'true', category: 'payments', isSecret: false },
        { key: 'payment_mode', value: 'automatic', category: 'payments', isSecret: false },
      ];
      
      const batch = db.batch();
      defaults.forEach(s => {
        batch.set(collections.adminSettings().doc(s.key), { ...s, updatedAt: new Date().toISOString() });
      });
      await batch.commit();
    }

    // Initialize empty placeholder documents to make collections visible in Firestore Console
    await this.ensureCollectionExists('users', '_placeholder');
    await this.ensureCollectionExists('profiles', '_placeholder');
    await this.ensureCollectionExists('events', '_placeholder');
    await this.ensureCollectionExists('jobs', '_placeholder');
    await this.ensureCollectionExists('vendorServices', '_placeholder');
    await this.ensureCollectionExists('vendorApplications', '_placeholder');
    await this.ensureCollectionExists('vendorLeads', '_placeholder');
    await this.ensureCollectionExists('vendorBookings', '_placeholder');
    await this.ensureCollectionExists('subscriptions', '_placeholder');
    await this.ensureCollectionExists('credits', '_placeholder');
    await this.ensureCollectionExists('routes', '_placeholder');
    await this.ensureCollectionExists('alerts', '_placeholder');
    await this.ensureCollectionExists('payments', '_placeholder');
    await this.ensureCollectionExists('coupons', '_placeholder');
    await this.ensureCollectionExists('wallets', '_placeholder');
    await this.ensureCollectionExists('walletTransactions', '_placeholder');
    await this.ensureCollectionExists('notifications', '_placeholder');
    await this.ensureCollectionExists('notificationTemplates', '_placeholder');
    await this.ensureCollectionExists('smtpSettings', '_placeholder');
    await this.ensureCollectionExists('pushSubscriptions', '_placeholder');
  }

  private async ensureCollectionExists(collectionName: string, placeholderId: string): Promise<void> {
    const collRef = db.collection('artifacts').doc(FIREBASE_APP_ID).collection(collectionName);
    const snapshot = await collRef.limit(1).get();
    if (snapshot.empty) {
      await collRef.doc(placeholderId).set({
        _isPlaceholder: true,
        _createdAt: new Date().toISOString(),
        _note: 'This is a placeholder document to make the collection visible. It can be deleted once real data exists.'
      });
    }
  }

  async setUserAsAdmin(userId: string): Promise<boolean> {
    try {
      const profileRef = collections.profiles().doc(userId);
      const doc = await profileRef.get();
      
      if (doc.exists) {
        await profileRef.update({ isAdmin: true });
      } else {
        await profileRef.set({
          userId,
          isAdmin: true,
          displayName: 'Admin User',
          email: null,
          isVendor: false,
          kycStatus: 'verified',
          createdAt: new Date(),
        });
      }
      return true;
    } catch (error) {
      console.error('Failed to set user as admin:', error);
      return false;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const doc = await collections.users().doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as User : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const snapshot = await collections.users().where('username', '==', username).limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = (user as any).id || crypto.randomUUID();
    const newUser = { ...user, id };
    await collections.users().doc(id).set(newUser);
    
    const profile = {
      userId: id,
      displayName: user.username,
      email: null,
      isVendor: false,
      kycStatus: 'pending',
      kycDocument: null,
      kycSubmittedAt: null,
      kycVerifiedAt: null,
      vendorMode: false,
      createdAt: new Date(),
    };
    await collections.profiles().doc(id).set(profile);
    
    const creditsData = {
      id: crypto.randomUUID(),
      userId: id,
      totalCredits: 10,
      usedCredits: 0,
      lastRefreshDate: new Date(),
      renewalDate: null,
    };
    await collections.credits().doc(id).set(creditsData);
    
    return newUser as User;
  }

  async getUserPlan(userId: string): Promise<(Plan & Subscription) | undefined> {
    const subSnapshot = await collections.subscriptions().where('userId', '==', userId).where('status', '==', 'active').limit(1).get();
    if (subSnapshot.empty) return undefined;
    
    const sub = subSnapshot.docs[0].data() as Subscription;
    const planDoc = await collections.plans().doc(sub.planId).get();
    if (!planDoc.exists) return undefined;
    
    return { ...planDoc.data(), ...sub, id: sub.id } as Plan & Subscription;
  }

  async createSubscription(subscription: any): Promise<Subscription> {
    const id = crypto.randomUUID();
    const newSub = { ...subscription, id, createdAt: new Date().toISOString() };
    await collections.subscriptions().doc(id).set(newSub);
    return newSub as Subscription;
  }

  async updateSubscriptionStatus(subscriptionId: string, status: string): Promise<void> {
    await collections.subscriptions().doc(subscriptionId).update({ status });
  }

  async getUserCredits(userId: string): Promise<Credits | undefined> {
    const doc = await collections.credits().doc(userId).get();
    return doc.exists ? doc.data() as Credits : undefined;
  }

  async createCredits(credits: any): Promise<Credits> {
    const id = credits.userId;
    await collections.credits().doc(id).set(credits);
    return credits as Credits;
  }

  async deductCredits(userId: string, amount: number, feature: string, description: string): Promise<boolean> {
    const creditsRef = collections.credits().doc(userId);
    const doc = await creditsRef.get();
    
    if (!doc.exists) return false;
    const current = doc.data() as Credits;
    const available = (current.totalCredits || 0) - (current.usedCredits || 0);
    if (available < amount) return false;
    
    await creditsRef.update({
      usedCredits: admin.firestore.FieldValue.increment(amount)
    });
    
    await collections.creditLogs().add({
      id: crypto.randomUUID(),
      userId,
      amount: -amount,
      action: 'used',
      feature,
      description,
      createdAt: new Date(),
    });
    
    return true;
  }

  async refundCredits(userId: string, amount: number, feature: string): Promise<void> {
    await collections.credits().doc(userId).update({
      usedCredits: admin.firestore.FieldValue.increment(-amount)
    });
    
    await collections.creditLogs().add({
      id: crypto.randomUUID(),
      userId,
      amount,
      action: 'refunded',
      feature,
      description: 'Credit refund',
      createdAt: new Date(),
    });
  }

  async refreshDailyCredits(userId: string, dailyAmount: number): Promise<void> {
    await collections.credits().doc(userId).update({
      totalCredits: admin.firestore.FieldValue.increment(dailyAmount),
      lastRefreshDate: new Date(),
    });
  }

  async setUserCredits(userId: string, totalCredits: number): Promise<void> {
    const creditsRef = collections.credits().doc(userId);
    const doc = await creditsRef.get();
    
    if (!doc.exists) {
      await creditsRef.set({
        id: crypto.randomUUID(),
        userId,
        totalCredits,
        usedCredits: 0,
        lastRefreshDate: new Date(),
        renewalDate: null,
      });
    } else {
      await creditsRef.update({ totalCredits });
    }
    
    await collections.creditLogs().add({
      id: crypto.randomUUID(),
      userId,
      amount: totalCredits,
      action: 'admin_set',
      feature: 'admin_adjustment',
      description: 'Admin set total credits',
      createdAt: new Date(),
    });
  }

  async getCreditLog(userId: string, limit: number = 50): Promise<CreditLog[]> {
    const snapshot = await collections.creditLogs()
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditLog));
  }

  async getAllPlans(): Promise<Plan[]> {
    const snapshot = await collections.plans().get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
  }

  async getPlanById(planId: string): Promise<Plan | undefined> {
    const doc = await collections.plans().doc(planId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Plan : undefined;
  }

  async getPlansByType(type: 'free' | 'basic' | 'pro' | 'enterprise', userType: 'user' | 'vendor'): Promise<Plan[]> {
    const snapshot = await collections.plans()
      .where('type', '==', type)
      .where('userType', '==', userType)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
  }

  async createPlan(plan: any): Promise<Plan> {
    const id = crypto.randomUUID();
    const newPlan = { ...plan, id, createdAt: new Date().toISOString() };
    await collections.plans().doc(id).set(newPlan);
    return newPlan as Plan;
  }

  async updatePlan(planId: string, updates: any): Promise<Plan | undefined> {
    const planRef = collections.plans().doc(planId);
    const doc = await planRef.get();
    if (!doc.exists) return undefined;
    
    await planRef.update({ ...updates, updatedAt: new Date().toISOString() });
    const updated = await planRef.get();
    return { id: updated.id, ...updated.data() } as Plan;
  }

  async deletePlan(planId: string): Promise<boolean> {
    const planRef = collections.plans().doc(planId);
    const doc = await planRef.get();
    if (!doc.exists) return false;
    
    await planRef.delete();
    return true;
  }

  async toggleUserAdmin(userId: string, isAdmin: boolean): Promise<boolean> {
    try {
      await collections.profiles().doc(userId).update({ isAdmin });
      return true;
    } catch (error) {
      console.error('Failed to toggle user admin:', error);
      return false;
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      await collections.users().doc(userId).delete();
      await collections.profiles().doc(userId).delete();
      await collections.credits().doc(userId).delete();
      return true;
    } catch (error) {
      console.error('Failed to delete user:', error);
      return false;
    }
  }

  async getUserRoutes(userId: string): Promise<CloakedRoute[]> {
    const snapshot = await collections.routes().where('userId', '==', userId).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CloakedRoute));
  }

  async createRoute(route: any): Promise<CloakedRoute> {
    const id = crypto.randomUUID();
    const newRoute = { ...route, id, createdAt: new Date().toISOString() };
    await collections.routes().doc(id).set(newRoute);
    return newRoute as CloakedRoute;
  }

  async updateRouteStatus(routeId: string, status: string): Promise<void> {
    await collections.routes().doc(routeId).update({ status });
  }

  async deleteRoute(routeId: string): Promise<void> {
    await collections.routes().doc(routeId).delete();
  }

  async getRouteAlerts(routeId: string, limit: number = 50): Promise<TrafficAlert[]> {
    const snapshot = await collections.alerts()
      .where('routeId', '==', routeId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrafficAlert));
  }

  async createAlert(alert: any): Promise<TrafficAlert> {
    const id = crypto.randomUUID();
    const newAlert = { ...alert, id, timestamp: new Date().toISOString() };
    await collections.alerts().doc(id).set(newAlert);
    return newAlert as TrafficAlert;
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await collections.alerts().doc(alertId).update({ acknowledged: true });
  }

  async updateUserKYC(userId: string, kycStatus: string, kycDocument?: string): Promise<void> {
    const updateData: any = { kycStatus, kycSubmittedAt: new Date().toISOString() };
    if (kycDocument) updateData.kycDocument = kycDocument;
    if (kycStatus === 'verified') updateData.kycVerifiedAt = new Date().toISOString();
    await collections.profiles().doc(userId).set(updateData, { merge: true });
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    // Check new profiles collection first
    const profileDoc = await collections.profiles().doc(userId).get();
    
    // Also check old users collection for legacy data
    const userDoc = await collections.users().doc(userId).get();
    
    if (!profileDoc.exists && !userDoc.exists) return undefined;
    
    // Merge data from both sources (profile takes priority, but include legacy fields)
    const profileData = profileDoc.exists ? profileDoc.data() : {};
    const userData = userDoc.exists ? userDoc.data() : {};
    
    // Map old format fields to new format
    const merged = {
      userId,
      displayName: profileData?.displayName || userData?.name || userData?.username || null,
      email: profileData?.email || userData?.email || null,
      city: profileData?.city || userData?.city || null,
      state: profileData?.state || userData?.state || null,
      isVendor: profileData?.isVendor ?? userData?.isVendor ?? false,
      isAdmin: profileData?.isAdmin ?? userData?.isAdmin ?? (userData?.role === 'admin'),
      kycStatus: profileData?.kycStatus || (userData?.isVerified ? 'verified' : 'pending'),
      kycDocument: profileData?.kycDocument || null,
      kycSubmittedAt: profileData?.kycSubmittedAt || null,
      kycVerifiedAt: profileData?.kycVerifiedAt || null,
      vendorMode: profileData?.vendorMode ?? false,
      createdAt: profileData?.createdAt || userData?.joinedAt || new Date(),
    };
    
    return merged as UserProfile;
  }

  async updateUserProfile(userId: string, profile: any): Promise<void> {
    await collections.profiles().doc(userId).set(profile, { merge: true });
  }

  async submitVendorApplication(userId: string, app: any): Promise<VendorApplication> {
    const id = crypto.randomUUID();
    const newApp = { ...app, id, userId, status: 'pending', createdAt: new Date().toISOString() };
    await collections.vendorApplications().doc(userId).set(newApp);
    return newApp as VendorApplication;
  }

  async getVendorApplication(userId: string): Promise<VendorApplication | undefined> {
    const doc = await collections.vendorApplications().doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as VendorApplication : undefined;
  }

  async approveVendorApplication(userId: string): Promise<void> {
    await collections.vendorApplications().doc(userId).update({ status: 'approved' });
    await collections.profiles().doc(userId).update({ vendorMode: true });
  }

  async rejectVendorApplication(userId: string): Promise<void> {
    await collections.vendorApplications().doc(userId).update({ status: 'rejected' });
  }

  async switchVendorMode(userId: string, vendorMode: boolean): Promise<void> {
    const docRef = collections.profiles().doc(userId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error(`Profile not found for user ${userId}`);
    }
    await docRef.update({ vendorMode });
  }

  async getDashboardTraffic(userId: string): Promise<DashboardTrafficCard | undefined> {
    const doc = await collections.dashboardTraffic().doc(userId).get();
    return doc.exists ? doc.data() as DashboardTrafficCard : undefined;
  }

  async updateDashboardTraffic(userId: string, location: string, status: string, description: string): Promise<void> {
    await collections.dashboardTraffic().doc(userId).set({
      userId,
      location: location || '',
      status: status || 'unknown',
      description: description || '',
      lastUpdate: new Date().toISOString(),
    });
  }

  async getEvents(): Promise<Event[]> {
    const snapshot = await collections.events().orderBy('date', 'asc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
  }

  async createEvent(event: any): Promise<Event> {
    const id = crypto.randomUUID();
    const newEvent = { ...event, id, createdAt: new Date().toISOString() };
    await collections.events().doc(id).set(newEvent);
    return newEvent as Event;
  }

  async updateEvent(eventId: string, event: any): Promise<void> {
    await collections.events().doc(eventId).update(event);
  }

  async deleteEvent(eventId: string): Promise<void> {
    await collections.events().doc(eventId).delete();
  }

  async registerForEvent(eventId: string, userId: string): Promise<void> {
    await collections.events().doc(eventId).update({
      registrations: admin.firestore.FieldValue.arrayUnion(userId)
    });
  }

  async getVendorServices(): Promise<VendorService[]> {
    const snapshot = await collections.vendorServices().get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorService));
  }

  async getVendorServiceById(serviceId: string): Promise<VendorService | undefined> {
    const doc = await collections.vendorServices().doc(serviceId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as VendorService : undefined;
  }

  async createVendorService(service: any): Promise<VendorService> {
    const id = crypto.randomUUID();
    const newService = { ...service, id, createdAt: new Date().toISOString() };
    await collections.vendorServices().doc(id).set(newService);
    return newService as VendorService;
  }

  async updateVendorService(serviceId: string, service: any): Promise<void> {
    await collections.vendorServices().doc(serviceId).update(service);
  }

  async deleteVendorService(serviceId: string): Promise<void> {
    await collections.vendorServices().doc(serviceId).delete();
  }

  async getAdminSettings(category?: string): Promise<AdminSetting[]> {
    let query: admin.firestore.Query = collections.adminSettings();
    if (category) {
      query = query.where('category', '==', category);
    }
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ key: doc.id, ...doc.data() } as AdminSetting));
  }

  async getAdminSetting(key: string): Promise<AdminSetting | undefined> {
    const doc = await collections.adminSettings().doc(key).get();
    return doc.exists ? { key: doc.id, ...doc.data() } as AdminSetting : undefined;
  }

  async setAdminSetting(key: string, value: string, category: string, isSecret: boolean = false): Promise<void> {
    await collections.adminSettings().doc(key).set({
      key,
      value,
      category,
      isSecret,
      updatedAt: new Date().toISOString(),
    });
  }

  async getPayments(userId?: string): Promise<Payment[]> {
    let query: admin.firestore.Query = collections.payments();
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    const snapshot = await query.get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Payment))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createPayment(payment: any): Promise<Payment> {
    const id = crypto.randomUUID();
    const newPayment = { ...payment, id, createdAt: new Date().toISOString() };
    await collections.payments().doc(id).set(newPayment);
    return newPayment as Payment;
  }

  async updatePaymentStatus(paymentId: string, status: string, providerRef?: string): Promise<void> {
    const update: any = { status };
    if (providerRef) update.providerRef = providerRef;
    await collections.payments().doc(paymentId).update(update);
  }

  async getAllUsers(): Promise<UserProfile[]> {
    const snapshot = await collections.profiles().get();
    return snapshot.docs.map(doc => doc.data() as UserProfile);
  }

  async getAllVendorApplications(): Promise<VendorApplication[]> {
    const snapshot = await collections.vendorApplications().get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorApplication));
  }

  async getJobs(limit: number = 50): Promise<any[]> {
    const snapshot = await collections.jobs().orderBy('postedAt', 'desc').limit(limit).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createJob(job: any): Promise<any> {
    const id = crypto.randomUUID();
    const newJob = { ...job, id, postedAt: new Date().toISOString() };
    await collections.jobs().doc(id).set(newJob);
    return newJob;
  }

  async getVendorLeads(vendorId: string): Promise<any[]> {
    const snapshot = await collections.vendorLeads().where('vendorId', '==', vendorId).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createVendorLead(lead: any): Promise<any> {
    const id = crypto.randomUUID();
    const newLead = { ...lead, id, createdAt: new Date().toISOString(), status: 'new' };
    await collections.vendorLeads().doc(id).set(newLead);
    return newLead;
  }

  async getVendorBookings(vendorId: string): Promise<any[]> {
    const snapshot = await collections.vendorBookings().where('vendorId', '==', vendorId).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createVendorBooking(booking: any): Promise<any> {
    const id = crypto.randomUUID();
    const newBooking = { ...booking, id, createdAt: new Date().toISOString(), status: 'pending' };
    await collections.vendorBookings().doc(id).set(newBooking);
    return newBooking;
  }

  async updateVendorBooking(bookingId: string, updates: any): Promise<void> {
    await collections.vendorBookings().doc(bookingId).update(updates);
  }

  async getVendorStats(vendorId: string): Promise<{ leads: number; bookings: number; earnings: number }> {
    const leadsSnapshot = await collections.vendorLeads().where('vendorId', '==', vendorId).get();
    const bookingsSnapshot = await collections.vendorBookings().where('vendorId', '==', vendorId).where('status', '==', 'completed').get();
    
    let earnings = 0;
    bookingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      earnings += data.amount || 0;
    });

    return {
      leads: leadsSnapshot.size,
      bookings: bookingsSnapshot.size,
      earnings
    };
  }

  async getAllCoupons(): Promise<Coupon[]> {
    const snapshot = await collections.coupons().orderBy('createdAt', 'desc').get();
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
  }

  async getCouponById(couponId: string): Promise<Coupon | undefined> {
    const doc = await collections.coupons().doc(couponId).get();
    return doc.exists && !doc.data()?._isPlaceholder ? { id: doc.id, ...doc.data() } as Coupon : undefined;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const snapshot = await collections.coupons().where('code', '==', code.toUpperCase()).limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Coupon;
  }

  async createCoupon(coupon: Omit<Coupon, 'id' | 'createdAt' | 'currentRedemptions'>): Promise<Coupon> {
    const id = crypto.randomUUID();
    const createdAt = new Date();
    const newCoupon = { 
      ...coupon, 
      id, 
      code: coupon.code.toUpperCase(),
      currentRedemptions: 0,
      createdAt
    };
    await collections.coupons().doc(id).set({
      ...newCoupon,
      createdAt: createdAt.toISOString()
    });
    return newCoupon as Coupon;
  }

  async updateCoupon(couponId: string, updates: Partial<Coupon>): Promise<Coupon | undefined> {
    const couponRef = collections.coupons().doc(couponId);
    const doc = await couponRef.get();
    if (!doc.exists) return undefined;
    
    const updateData = { ...updates };
    if (updateData.code) updateData.code = updateData.code.toUpperCase();
    
    await couponRef.update(updateData);
    const updated = await couponRef.get();
    return { id: updated.id, ...updated.data() } as Coupon;
  }

  async deleteCoupon(couponId: string): Promise<boolean> {
    const couponRef = collections.coupons().doc(couponId);
    const doc = await couponRef.get();
    if (!doc.exists) return false;
    
    await couponRef.delete();
    return true;
  }

  async validateCoupon(code: string): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
    const coupon = await this.getCouponByCode(code);
    
    if (!coupon) {
      return { valid: false, error: 'Coupon not found' };
    }
    
    if (!coupon.isActive) {
      return { valid: false, error: 'Coupon is inactive' };
    }
    
    const now = new Date();
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return { valid: false, error: 'Coupon is not yet valid' };
    }
    
    if (coupon.validTo && new Date(coupon.validTo) < now) {
      return { valid: false, error: 'Coupon has expired' };
    }
    
    if (coupon.maxRedemptions && (coupon.currentRedemptions || 0) >= coupon.maxRedemptions) {
      return { valid: false, error: 'Coupon has reached maximum redemptions' };
    }
    
    return { valid: true, coupon };
  }

  async redeemCoupon(couponId: string): Promise<void> {
    await collections.coupons().doc(couponId).update({
      currentRedemptions: admin.firestore.FieldValue.increment(1)
    });
  }

  async getWallet(userId: string): Promise<Wallet | undefined> {
    const snapshot = await collections.wallets().where('userId', '==', userId).limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Wallet;
  }

  async createWallet(userId: string, currency: string = 'NGN'): Promise<Wallet> {
    const existing = await this.getWallet(userId);
    if (existing) return existing;
    
    const id = crypto.randomUUID();
    const newWallet: any = {
      id,
      userId,
      balance: '0',
      currency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await collections.wallets().doc(id).set(newWallet);
    return newWallet as Wallet;
  }

  async updateWalletBalance(walletId: string, newBalance: string): Promise<void> {
    await collections.wallets().doc(walletId).update({
      balance: newBalance,
      updatedAt: new Date().toISOString()
    });
  }

  async topUpWallet(userId: string, amount: number, reference?: string, description?: string): Promise<WalletTransaction> {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    const balanceBefore = parseFloat(wallet.balance || '0');
    const balanceAfter = balanceBefore + amount;
    
    await this.updateWalletBalance(wallet.id, balanceAfter.toFixed(2));
    
    const txId = crypto.randomUUID();
    const transaction: any = {
      id: txId,
      walletId: wallet.id,
      type: 'deposit',
      amount: amount.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      reference: reference || `TOP-${Date.now()}`,
      description: description || 'Wallet top-up',
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    
    await collections.walletTransactions().doc(txId).set(transaction);
    return transaction as WalletTransaction;
  }

  async getWalletTransactions(userId: string, limit: number = 50): Promise<WalletTransaction[]> {
    const wallet = await this.getWallet(userId);
    if (!wallet) return [];
    
    const snapshot = await collections.walletTransactions()
      .where('walletId', '==', wallet.id)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WalletTransaction));
  }

  async deductFromWallet(userId: string, amount: number, type: string, reference?: string, description?: string): Promise<WalletTransaction | null> {
    const wallet = await this.getWallet(userId);
    if (!wallet) return null;
    
    const balanceBefore = parseFloat(wallet.balance || '0');
    if (balanceBefore < amount) return null;
    
    const balanceAfter = balanceBefore - amount;
    
    await this.updateWalletBalance(wallet.id, balanceAfter.toFixed(2));
    
    const txId = crypto.randomUUID();
    const transaction: any = {
      id: txId,
      walletId: wallet.id,
      type,
      amount: (-amount).toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      reference: reference || `TXN-${Date.now()}`,
      description: description || 'Wallet deduction',
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    
    await collections.walletTransactions().doc(txId).set(transaction);
    return transaction as WalletTransaction;
  }

  // ===== Booking Methods =====

  async createBooking(booking: any): Promise<Booking> {
    const id = crypto.randomUUID();
    const newBooking = {
      ...booking,
      id,
      status: 'requested',
      createdAt: new Date().toISOString()
    };
    await collections.bookings().doc(id).set(newBooking);
    return newBooking as Booking;
  }

  async getBookingById(bookingId: string): Promise<Booking | undefined> {
    const doc = await collections.bookings().doc(bookingId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Booking : undefined;
  }

  async getBookingsByUserId(userId: string): Promise<Booking[]> {
    const snapshot = await collections.bookings()
      .where('userId', '==', userId)
      .get();
    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
    return bookings.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
  }

  async getBookingsByVendorId(vendorId: string): Promise<Booking[]> {
    const snapshot = await collections.bookings()
      .where('vendorId', '==', vendorId)
      .get();
    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
    return bookings.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
  }

  async updateBookingStatus(bookingId: string, status: string): Promise<void> {
    const updates: any = { status };
    if (status === 'confirmed') updates.confirmedAt = new Date().toISOString();
    if (status === 'completed') updates.completedAt = new Date().toISOString();
    await collections.bookings().doc(bookingId).update(updates);
  }

  async getBookingDetails(bookingId: string): Promise<{
    booking: Booking | undefined;
    milestones: BookingMilestone[];
    escrow: EscrowAccount | undefined;
    contract: Contract | undefined;
  }> {
    const booking = await this.getBookingById(bookingId);
    const milestones = await this.getMilestonesByBookingId(bookingId);
    const escrow = await this.getEscrowByBookingId(bookingId);
    const contract = await this.getContractByBookingId(bookingId);
    return { booking, milestones, escrow, contract };
  }

  // ===== Milestone Methods =====

  async createMilestone(milestone: any): Promise<BookingMilestone> {
    const id = crypto.randomUUID();
    const newMilestone = {
      ...milestone,
      id,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await collections.bookingMilestones().doc(id).set(newMilestone);
    return newMilestone as BookingMilestone;
  }

  async getMilestonesByBookingId(bookingId: string): Promise<BookingMilestone[]> {
    const snapshot = await collections.bookingMilestones()
      .where('bookingId', '==', bookingId)
      .get();
    const milestones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookingMilestone));
    return milestones.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getMilestoneById(milestoneId: string): Promise<BookingMilestone | undefined> {
    const doc = await collections.bookingMilestones().doc(milestoneId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as BookingMilestone : undefined;
  }

  async updateMilestoneStatus(milestoneId: string, status: string): Promise<void> {
    const updates: any = { status };
    if (status === 'completed') updates.completedAt = new Date().toISOString();
    if (status === 'released') updates.releasedAt = new Date().toISOString();
    await collections.bookingMilestones().doc(milestoneId).update(updates);
  }

  // ===== Escrow Methods =====

  async createEscrowAccount(escrow: any): Promise<EscrowAccount> {
    const id = crypto.randomUUID();
    const newEscrow = {
      ...escrow,
      id,
      fundedAmount: '0',
      releasedAmount: '0',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await collections.escrowAccounts().doc(id).set(newEscrow);
    return newEscrow as EscrowAccount;
  }

  async getEscrowByBookingId(bookingId: string): Promise<EscrowAccount | undefined> {
    const snapshot = await collections.escrowAccounts()
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as EscrowAccount;
  }

  async getEscrowById(escrowId: string): Promise<EscrowAccount | undefined> {
    const doc = await collections.escrowAccounts().doc(escrowId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as EscrowAccount : undefined;
  }

  async fundEscrow(bookingId: string, amount: number, userId: string): Promise<EscrowAccount | null> {
    let escrow = await this.getEscrowByBookingId(bookingId);
    if (!escrow) {
      const booking = await this.getBookingById(bookingId);
      if (!booking) return null;
      escrow = await this.createEscrowAccount({
        bookingId,
        totalAmount: booking.totalAmount
      });
    }

    const walletTx = await this.deductFromWallet(
      userId,
      amount,
      'escrow_fund',
      `ESC-${bookingId.substring(0, 8)}`,
      `Escrow funding for booking ${bookingId}`
    );
    
    if (!walletTx) return null;

    const fundedAmount = parseFloat(escrow.fundedAmount || '0') + amount;
    const totalAmount = parseFloat(escrow.totalAmount || '0');
    const newStatus = fundedAmount >= totalAmount ? 'funded' : 'partial';

    await collections.escrowAccounts().doc(escrow.id).update({
      fundedAmount: fundedAmount.toFixed(2),
      status: newStatus,
      fundedAt: new Date().toISOString()
    });

    await this.createEscrowEvent({
      escrowId: escrow.id,
      type: 'funded',
      amount: amount.toFixed(2),
      performedBy: userId,
      description: `Funded escrow with ${amount}`
    });

    return await this.getEscrowById(escrow.id) || null;
  }

  async releaseEscrowMilestone(escrowId: string, milestoneId: string, vendorId: string, adminId?: string): Promise<EscrowEvent | null> {
    const escrow = await this.getEscrowById(escrowId);
    if (!escrow) return null;

    const milestone = await this.getMilestoneById(milestoneId);
    if (!milestone) return null;

    const amount = parseFloat(milestone.amount || '0');
    if (amount <= 0) return null;

    const vendorWallet = await this.getWallet(vendorId);
    if (!vendorWallet) {
      await this.createWallet(vendorId);
    }

    await this.topUpWallet(
      vendorId,
      amount,
      `MLS-${milestoneId.substring(0, 8)}`,
      `Milestone release: ${milestone.title}`
    );

    const releasedAmount = parseFloat(escrow.releasedAmount || '0') + amount;
    const totalAmount = parseFloat(escrow.totalAmount || '0');
    const newStatus = releasedAmount >= totalAmount ? 'released' : escrow.status;

    await collections.escrowAccounts().doc(escrowId).update({
      releasedAmount: releasedAmount.toFixed(2),
      status: newStatus,
      ...(newStatus === 'released' ? { releasedAt: new Date().toISOString() } : {})
    });

    await this.updateMilestoneStatus(milestoneId, 'released');

    const event = await this.createEscrowEvent({
      escrowId,
      type: 'milestone_released',
      amount: amount.toFixed(2),
      milestoneId,
      performedBy: adminId || vendorId,
      description: `Released milestone: ${milestone.title}`
    });

    return event;
  }

  async createEscrowEvent(event: any): Promise<EscrowEvent> {
    const id = crypto.randomUUID();
    const newEvent = {
      ...event,
      id,
      createdAt: new Date().toISOString()
    };
    await collections.escrowEvents().doc(id).set(newEvent);
    return newEvent as EscrowEvent;
  }

  async getEscrowEvents(escrowId: string): Promise<EscrowEvent[]> {
    const snapshot = await collections.escrowEvents()
      .where('escrowId', '==', escrowId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EscrowEvent));
  }

  // ===== Contract Methods =====

  async createContract(contract: any): Promise<Contract> {
    const id = crypto.randomUUID();
    const newContract = {
      ...contract,
      id,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await collections.contracts().doc(id).set(newContract);
    return newContract as Contract;
  }

  async getContractByBookingId(bookingId: string): Promise<Contract | undefined> {
    const snapshot = await collections.contracts()
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Contract;
  }

  async getContractById(contractId: string): Promise<Contract | undefined> {
    const doc = await collections.contracts().doc(contractId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Contract : undefined;
  }

  async signContract(bookingId: string, signerType: 'user' | 'vendor'): Promise<Contract | null> {
    const contract = await this.getContractByBookingId(bookingId);
    if (!contract) return null;

    const updates: any = {};
    if (signerType === 'user') {
      updates.userSignedAt = new Date().toISOString();
    } else {
      updates.vendorSignedAt = new Date().toISOString();
    }

    const newContract = await this.getContractByBookingId(bookingId);
    const vendorSigned = signerType === 'vendor' || newContract?.vendorSignedAt;
    const userSigned = signerType === 'user' || newContract?.userSignedAt;

    if (vendorSigned && userSigned) {
      updates.status = 'fully_signed';
    } else if (vendorSigned) {
      updates.status = 'vendor_signed';
    }

    await collections.contracts().doc(contract.id).update(updates);
    return await this.getContractById(contract.id) || null;
  }

  // ===== Dispute Methods =====

  async createDispute(dispute: any): Promise<Dispute> {
    const id = crypto.randomUUID();
    const newDispute = {
      ...dispute,
      id,
      status: 'open',
      createdAt: new Date().toISOString()
    };
    await collections.disputes().doc(id).set(newDispute);

    await this.updateBookingStatus(dispute.bookingId, 'disputed');

    return newDispute as Dispute;
  }

  async getDisputeByBookingId(bookingId: string): Promise<Dispute | undefined> {
    const snapshot = await collections.disputes()
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Dispute;
  }

  async getDisputeById(disputeId: string): Promise<Dispute | undefined> {
    const doc = await collections.disputes().doc(disputeId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Dispute : undefined;
  }

  async getAllDisputes(): Promise<Dispute[]> {
    const snapshot = await collections.disputes()
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => ({ id: doc.id, ...doc.data() } as Dispute));
  }

  async resolveDispute(disputeId: string, resolution: string, resolutionNotes: string, resolvedBy: string): Promise<Dispute | null> {
    const dispute = await this.getDisputeById(disputeId);
    if (!dispute) return null;

    await collections.disputes().doc(disputeId).update({
      status: 'resolved',
      resolution,
      resolutionNotes,
      resolvedBy,
      resolvedAt: new Date().toISOString()
    });

    const booking = await this.getBookingById(dispute.bookingId);
    if (booking) {
      if (resolution === 'user_favor') {
        const escrow = await this.getEscrowByBookingId(dispute.bookingId);
        if (escrow) {
          const remainingFunds = parseFloat(escrow.fundedAmount || '0') - parseFloat(escrow.releasedAmount || '0');
          if (remainingFunds > 0) {
            await this.topUpWallet(
              booking.userId,
              remainingFunds,
              `REF-${disputeId.substring(0, 8)}`,
              `Dispute refund for booking ${booking.id}`
            );
            await collections.escrowAccounts().doc(escrow.id).update({
              status: 'refunded',
              releasedAmount: escrow.fundedAmount
            });
          }
        }
        await this.updateBookingStatus(dispute.bookingId, 'cancelled');
      } else if (resolution === 'vendor_favor') {
        const escrow = await this.getEscrowByBookingId(dispute.bookingId);
        if (escrow) {
          const remainingFunds = parseFloat(escrow.fundedAmount || '0') - parseFloat(escrow.releasedAmount || '0');
          if (remainingFunds > 0) {
            await this.topUpWallet(
              booking.vendorId,
              remainingFunds,
              `REL-${disputeId.substring(0, 8)}`,
              `Dispute resolution payout for booking ${booking.id}`
            );
            await collections.escrowAccounts().doc(escrow.id).update({
              status: 'released',
              releasedAmount: escrow.fundedAmount,
              releasedAt: new Date().toISOString()
            });
          }
        }
        await this.updateBookingStatus(dispute.bookingId, 'completed');
      } else if (resolution === 'split') {
        const escrow = await this.getEscrowByBookingId(dispute.bookingId);
        if (escrow) {
          const remainingFunds = parseFloat(escrow.fundedAmount || '0') - parseFloat(escrow.releasedAmount || '0');
          if (remainingFunds > 0) {
            const userShare = remainingFunds / 2;
            const vendorShare = remainingFunds - userShare;
            
            await this.topUpWallet(
              booking.userId,
              userShare,
              `SPL-U-${disputeId.substring(0, 8)}`,
              `Dispute split refund for booking ${booking.id}`
            );
            
            await this.topUpWallet(
              booking.vendorId,
              vendorShare,
              `SPL-V-${disputeId.substring(0, 8)}`,
              `Dispute split payout for booking ${booking.id}`
            );
            
            await collections.escrowAccounts().doc(escrow.id).update({
              status: 'split',
              releasedAmount: escrow.fundedAmount,
              releasedAt: new Date().toISOString()
            });
          }
        }
        await this.updateBookingStatus(dispute.bookingId, 'cancelled');
      }
    }

    return await this.getDisputeById(disputeId) || null;
  }

  // ===== Booking Messages Methods =====

  async createBookingMessage(message: any): Promise<BookingMessage> {
    const id = crypto.randomUUID();
    const newMessage = {
      ...message,
      id,
      createdAt: new Date().toISOString()
    };
    await collections.bookingMessages().doc(id).set(newMessage);
    return newMessage as BookingMessage;
  }

  async getBookingMessages(bookingId: string, limit: number = 100): Promise<BookingMessage[]> {
    const snapshot = await collections.bookingMessages()
      .where('bookingId', '==', bookingId)
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookingMessage));
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await collections.bookingMessages().doc(messageId).update({
      readAt: new Date().toISOString()
    });
  }

  // ===== Saved Events Methods =====

  async saveEvent(userId: string, eventId: string): Promise<void> {
    const docId = `${userId}_${eventId}`;
    await collections.savedEvents().doc(docId).set({
      id: crypto.randomUUID(),
      userId,
      eventId,
      savedAt: new Date().toISOString()
    });
  }

  async unsaveEvent(userId: string, eventId: string): Promise<void> {
    const docId = `${userId}_${eventId}`;
    await collections.savedEvents().doc(docId).delete();
  }

  async getSavedEvents(userId: string): Promise<string[]> {
    const snapshot = await collections.savedEvents()
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => doc.data().eventId);
  }

  async isEventSaved(userId: string, eventId: string): Promise<boolean> {
    const docId = `${userId}_${eventId}`;
    const doc = await collections.savedEvents().doc(docId).get();
    return doc.exists;
  }

  // ===== Saved Jobs Methods =====

  async saveJob(userId: string, jobId: string): Promise<void> {
    const docId = `${userId}_${jobId}`;
    await collections.savedJobs().doc(docId).set({
      id: crypto.randomUUID(),
      userId,
      jobId,
      savedAt: new Date().toISOString()
    });
  }

  async unsaveJob(userId: string, jobId: string): Promise<void> {
    const docId = `${userId}_${jobId}`;
    await collections.savedJobs().doc(docId).delete();
  }

  async getSavedJobIds(userId: string): Promise<string[]> {
    const snapshot = await collections.savedJobs()
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => doc.data().jobId);
  }

  async getSavedJobs(userId: string): Promise<any[]> {
    const savedJobIds = await this.getSavedJobIds(userId);
    if (savedJobIds.length === 0) return [];
    
    const jobs = [];
    for (const jobId of savedJobIds) {
      const jobDoc = await collections.jobs().doc(jobId).get();
      if (jobDoc.exists) {
        jobs.push({ id: jobDoc.id, ...jobDoc.data() });
      }
    }
    return jobs;
  }

  async isJobSaved(userId: string, jobId: string): Promise<boolean> {
    const docId = `${userId}_${jobId}`;
    const doc = await collections.savedJobs().doc(docId).get();
    return doc.exists;
  }

  // ===== Applied Jobs Methods =====

  async applyToJob(userId: string, jobId: string): Promise<any> {
    const docId = `${userId}_${jobId}`;
    const existingDoc = await collections.appliedJobs().doc(docId).get();
    if (existingDoc.exists) {
      return { id: docId, ...existingDoc.data() };
    }
    
    const application = {
      id: crypto.randomUUID(),
      userId,
      jobId,
      status: 'applied',
      appliedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await collections.appliedJobs().doc(docId).set(application);
    return application;
  }

  async getAppliedJobIds(userId: string): Promise<string[]> {
    const snapshot = await collections.appliedJobs()
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => doc.data().jobId);
  }

  async getAppliedJobs(userId: string): Promise<any[]> {
    const snapshot = await collections.appliedJobs()
      .where('userId', '==', userId)
      .get();
    
    const applications: any[] = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    const jobs = [];
    
    for (const app of applications) {
      const jobDoc = await collections.jobs().doc(app.jobId).get();
      if (jobDoc.exists) {
        jobs.push({ 
          ...jobDoc.data(), 
          id: jobDoc.id, 
          applicationStatus: app.status,
          appliedAt: app.appliedAt,
          applicationId: app.id
        });
      }
    }
    return jobs;
  }

  async updateApplicationStatus(userId: string, jobId: string, status: string): Promise<void> {
    const docId = `${userId}_${jobId}`;
    await collections.appliedJobs().doc(docId).update({
      status,
      updatedAt: new Date().toISOString()
    });
  }

  async getJobApplication(userId: string, jobId: string): Promise<any | undefined> {
    const docId = `${userId}_${jobId}`;
    const doc = await collections.appliedJobs().doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : undefined;
  }

  // ===== Generated Jobs Methods =====

  async createGeneratedJob(userId: string, jobData: any): Promise<any> {
    const id = crypto.randomUUID();
    const generatedJob = {
      id,
      userId,
      jobData,
      source: 'ai',
      createdAt: new Date().toISOString()
    };
    await collections.generatedJobs().doc(id).set(generatedJob);
    return generatedJob;
  }

  async getGeneratedJobs(userId: string): Promise<any[]> {
    const snapshot = await collections.generatedJobs()
      .where('userId', '==', userId)
      .get();
    
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data.jobData,
          generatedAt: data.createdAt,
          source: 'AI Generated'
        };
      })
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  // ===== Notification Methods =====

  async createNotification(notification: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    channel?: string;
  }): Promise<Notification> {
    const id = crypto.randomUUID();
    const newNotification = {
      ...notification,
      id,
      data: notification.data || {},
      channel: notification.channel || 'in_app',
      isRead: false,
      createdAt: new Date().toISOString(),
      readAt: null
    };
    await collections.notifications().doc(id).set(newNotification);
    return newNotification as Notification;
  }

  async getNotificationsByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const snapshot = await collections.notifications()
      .where('userId', '==', userId)
      .get();
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getNotificationById(notificationId: string): Promise<Notification | undefined> {
    const doc = await collections.notifications().doc(notificationId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Notification : undefined;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const snapshot = await collections.notifications()
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();
    return snapshot.docs.filter(doc => !doc.data()._isPlaceholder).length;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await collections.notifications().doc(notificationId).update({
      isRead: true,
      readAt: new Date().toISOString()
    });
  }

  async markAllNotificationsAsRead(userId: string): Promise<number> {
    const snapshot = await collections.notifications()
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();
    
    const batch = db.batch();
    let count = 0;
    
    snapshot.docs.forEach(doc => {
      if (!doc.data()._isPlaceholder) {
        batch.update(doc.ref, {
          isRead: true,
          readAt: new Date().toISOString()
        });
        count++;
      }
    });
    
    await batch.commit();
    return count;
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await collections.notifications().doc(notificationId).delete();
  }

  // ===== Notification Template Methods =====

  async createNotificationTemplate(template: {
    name: string;
    type: string;
    subject: string;
    bodyTemplate: string;
    channels?: string[];
    isActive?: boolean;
  }): Promise<NotificationTemplate> {
    const id = crypto.randomUUID();
    const newTemplate = {
      ...template,
      id,
      channels: template.channels || ['in_app'],
      isActive: template.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await collections.notificationTemplates().doc(id).set(newTemplate);
    return newTemplate as NotificationTemplate;
  }

  async getAllNotificationTemplates(): Promise<NotificationTemplate[]> {
    const snapshot = await collections.notificationTemplates().get();
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => ({ id: doc.id, ...doc.data() } as NotificationTemplate));
  }

  async getNotificationTemplateById(templateId: string): Promise<NotificationTemplate | undefined> {
    const doc = await collections.notificationTemplates().doc(templateId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as NotificationTemplate : undefined;
  }

  async getNotificationTemplateByName(name: string): Promise<NotificationTemplate | undefined> {
    const snapshot = await collections.notificationTemplates()
      .where('name', '==', name)
      .limit(1)
      .get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as NotificationTemplate;
  }

  async updateNotificationTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate | undefined> {
    const templateRef = collections.notificationTemplates().doc(templateId);
    const doc = await templateRef.get();
    if (!doc.exists) return undefined;
    
    await templateRef.update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    const updated = await templateRef.get();
    return { id: updated.id, ...updated.data() } as NotificationTemplate;
  }

  async deleteNotificationTemplate(templateId: string): Promise<boolean> {
    const templateRef = collections.notificationTemplates().doc(templateId);
    const doc = await templateRef.get();
    if (!doc.exists) return false;
    
    await templateRef.delete();
    return true;
  }

  // ===== SMTP Settings Methods =====

  async getSmtpSettings(): Promise<SmtpSettings | undefined> {
    const snapshot = await collections.smtpSettings().limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    if (doc.data()._isPlaceholder) return undefined;
    return { id: doc.id, ...doc.data() } as SmtpSettings;
  }

  async updateSmtpSettings(settings: {
    host: string;
    port: number;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
    encryption?: string;
    isActive?: boolean;
  }): Promise<SmtpSettings> {
    const existing = await this.getSmtpSettings();
    const id = existing?.id || 'smtp-config';
    
    const smtpData = {
      ...settings,
      id,
      encryption: settings.encryption || 'tls',
      isActive: settings.isActive !== false,
      updatedAt: new Date().toISOString()
    };
    
    await collections.smtpSettings().doc(id).set(smtpData, { merge: true });
    return smtpData as SmtpSettings;
  }

  // ===== Push Subscription Methods =====

  async subscribeToPush(subscription: {
    userId: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }): Promise<PushSubscription> {
    const existingSnapshot = await collections.pushSubscriptions()
      .where('userId', '==', subscription.userId)
      .where('endpoint', '==', subscription.endpoint)
      .limit(1)
      .get();
    
    if (!existingSnapshot.empty) {
      const doc = existingSnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as PushSubscription;
    }
    
    const id = crypto.randomUUID();
    const newSubscription = {
      ...subscription,
      id,
      createdAt: new Date().toISOString()
    };
    await collections.pushSubscriptions().doc(id).set(newSubscription);
    return newSubscription as PushSubscription;
  }

  async unsubscribeFromPush(userId: string, endpoint: string): Promise<boolean> {
    const snapshot = await collections.pushSubscriptions()
      .where('userId', '==', userId)
      .where('endpoint', '==', endpoint)
      .get();
    
    if (snapshot.empty) return false;
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return true;
  }

  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    const snapshot = await collections.pushSubscriptions()
      .where('userId', '==', userId)
      .get();
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => ({ id: doc.id, ...doc.data() } as PushSubscription));
  }

  // ===== Send Notification Helper =====

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
    let { title, message, channels } = options;
    const { userId, type, data, templateName, variables } = options;

    if (templateName) {
      const template = await this.getNotificationTemplateByName(templateName);
      if (template && template.isActive) {
        title = this.substituteVariables(template.subject, variables || {});
        message = this.substituteVariables(template.bodyTemplate, variables || {});
        channels = template.channels as string[] || ['in_app'];
      }
    }

    channels = channels || ['in_app'];

    const notification = await this.createNotification({
      userId,
      type,
      title,
      message,
      data,
      channel: channels.join(',')
    });

    if (channels.includes('email')) {
      await this.sendEmailNotification(userId, title, message);
    }

    return notification;
  }

  private substituteVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  private async sendEmailNotification(userId: string, subject: string, body: string): Promise<boolean> {
    try {
      const smtpSettings = await this.getSmtpSettings();
      if (!smtpSettings || !smtpSettings.isActive) {
        console.log('SMTP not configured or inactive, skipping email notification');
        return false;
      }

      const profile = await this.getUserProfile(userId);
      if (!profile?.email) {
        console.log(`No email found for user ${userId}, skipping email notification`);
        return false;
      }

      console.log(`[Email] Would send to ${profile.email}: ${subject}`);
      return true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return false;
    }
  }
}

export const firestoreStorage = new FirestoreStorage();
