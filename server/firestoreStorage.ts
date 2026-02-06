import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { type User, type InsertUser, type Subscription, type Credits, type Plan, type CreditLog, type CloakedRoute, type TrafficAlert, type DashboardTrafficCard, type UserProfile, type VendorApplication, type Event, type VendorService, type AdminSetting, type Payment, type Coupon, type Wallet, type WalletTransaction, type Booking, type BookingMilestone, type EscrowAccount, type EscrowEvent, type Contract, type Dispute, type BookingMessage, type Notification, type NotificationTemplate, type SmtpSettings, type PushSubscription, type SabiGuardChat, type SabiGuardMessage, type MoatData } from "@shared/schema";
import { type IStorage } from "./types";

export const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || 'legal-13d13';

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
    
    // Check both collections for admin status
    console.log(`[getFirestoreUserFlags] Checking UID: ${userId} in AppID: ${FIREBASE_APP_ID}`);
    const [profileDoc, userDoc] = await Promise.all([
      admin.firestore()
        .collection('artifacts')
        .doc(FIREBASE_APP_ID)
        .collection('profiles')
        .doc(userId)
        .get(),
      admin.firestore()
        .collection('artifacts')
        .doc(FIREBASE_APP_ID)
        .collection('users')
        .doc(userId)
        .get()
    ]);
    
    console.log(`[verifyAdminToken] Docs exist for ${userId}: profile=${profileDoc.exists}, user=${userDoc.exists}`);
    
    if (!profileDoc.exists && !userDoc.exists) {
      console.log(`Admin auth: No profile or user found for ${userId}`);
      return { valid: false, userId, isAdmin: false, error: 'no_profile' };
    }
    
    const profileData = profileDoc.exists ? profileDoc.data() : {};
    const userData = userDoc.exists ? userDoc.data() : {};
    
    const isAdmin = profileData?.isAdmin === true || 
                    userData?.isAdmin === true || 
                    userData?.role === 'admin';
                    
    console.log(`[verifyAdminToken] Admin check for ${userId}:`, { 
      profileIsAdmin: profileData?.isAdmin,
      userIsAdmin: userData?.isAdmin,
      userRole: userData?.role,
      finalIsAdmin: isAdmin
    });
    
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

export async function getFirestoreUserFlags(userId: string): Promise<{ isAdmin: boolean, isVendor: boolean }> {
  try {
    const [profileDoc, userDoc] = await Promise.all([
      admin.firestore()
        .collection('artifacts')
        .doc(FIREBASE_APP_ID)
        .collection('profiles')
        .doc(userId)
        .get(),
      admin.firestore()
        .collection('artifacts')
        .doc(FIREBASE_APP_ID)
        .collection('users')
        .doc(userId)
        .get()
    ]);
    
    if (!profileDoc.exists && !userDoc.exists) {
      console.log(`[getFirestoreUserFlags] No docs found for ${userId}`);
      return { isAdmin: false, isVendor: false };
    }
    
    const profileData = profileDoc.exists ? profileDoc.data() : {};
    const userData = userDoc.exists ? userDoc.data() : {};
    
    const isAdmin = profileData?.isAdmin === true || 
                    userData?.isAdmin === true || 
                    userData?.role === 'admin';
                    
    const isVendor = profileData?.isVendor === true || 
                     userData?.isVendor === true || 
                     userData?.role === 'vendor' ||
                     userData?.role === 'provider';
                     
    console.log(`[getFirestoreUserFlags] Result for ${userId}:`, { 
      isAdmin, 
      isVendor,
      profileExists: profileDoc.exists,
      userExists: userDoc.exists,
      profileData: profileDoc.exists ? profileDoc.data() : 'none',
      userData: userDoc.exists ? userDoc.data() : 'none'
    });
    return { isAdmin, isVendor };
  } catch (error) {
    console.error('Error checking user flags in Firestore:', error);
    return { isAdmin: false, isVendor: false };
  }
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const flags = await getFirestoreUserFlags(userId);
  return flags.isAdmin;
}

function initializeFirebase() {
  if (admin.apps && admin.apps.length > 0) {
    return admin.app();
  }
  
  let serviceAccount;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON');
    }
  }
  
  // Fallback to local file if env var is not set or invalid
  if (!serviceAccount) {
    try {
      const filePath = path.join(process.cwd(), 'legal-13d13-firebase-adminsdk-fbsvc-e736182a52.json');
      if (fs.existsSync(filePath)) {
        serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log('Initialized Firebase using local service account file');
      }
    } catch (e) {
      console.error('Failed to load local service account file:', e);
    }
  }

  if (!serviceAccount) {
    console.warn('Firebase service account not found in environment or local file. Auth verification will fail.');
    return null;
  }
  
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'legal-13d13',
  });
}

const app = initializeFirebase();
const db = app ? admin.firestore() : null;

const getColl = (name: string) => {
  if (!db) throw new Error("Firestore not initialized");
  return db.collection('artifacts').doc(FIREBASE_APP_ID).collection(name);
};

const collections = {
  users: () => getColl('users'),
  profiles: () => getColl('profiles'),
  subscriptions: () => getColl('subscriptions'),
  credits: () => getColl('credits'),
  creditLogs: () => getColl('creditLogs'),
  plans: () => getColl('plans'),
  creditPackages: () => getColl('creditPackages'),
  paymentMethods: () => getColl('paymentMethods'),
  routes: () => getColl('routes'),
  alerts: () => getColl('alerts'),
  vendorApplications: () => getColl('vendorApplications'),
  dashboardTraffic: () => getColl('dashboardTraffic'),
  events: () => getColl('events'),
  vendorServices: () => getColl('vendorServices'),
  sabiguardChats: () => getColl('sabiguardChats'),
  sabiguardMessages: () => getColl('sabiguardMessages'),
  moatData: () => getColl('moatData'),
  adminSettings: () => getColl('adminSettings'),
  payments: () => getColl('payments'),
  jobs: () => getColl('jobs'),
  vendorLeads: () => getColl('vendorLeads'),
  vendorBookings: () => getColl('vendorBookings'),
  coupons: () => getColl('coupons'),
  wallets: () => getColl('wallets'),
  walletTransactions: () => getColl('walletTransactions'),
  bookings: () => getColl('bookings'),
  bookingMilestones: () => getColl('bookingMilestones'),
  escrowAccounts: () => getColl('escrowAccounts'),
  escrowEvents: () => getColl('escrowEvents'),
  contracts: () => getColl('contracts'),
  disputes: () => getColl('disputes'),
  bookingMessages: () => getColl('bookingMessages'),
  savedEvents: () => getColl('savedEvents'),
  savedJobs: () => getColl('savedJobs'),
  appliedJobs: () => getColl('appliedJobs'),
  generatedJobs: () => getColl('generatedJobs'),
  notifications: () => getColl('notifications'),
  notificationTemplates: () => getColl('notificationTemplates'),
  smtpSettings: () => getColl('smtpSettings'),
  pushSubscriptions: () => getColl('pushSubscriptions'),
  faqs: () => getColl('faqs'),
  testimonials: () => getColl('testimonials'),
  surveys: () => getColl('surveys'),
  forumPosts: () => {
    if (!db) throw new Error("Firestore not initialized");
    return db.collection('artifacts').doc(FIREBASE_APP_ID).collection('public').doc('data').collection('forum_posts');
  },
};

export class FirestoreStorage implements IStorage {
  
  constructor() {
    this.initializeDefaults();
  }

  private toMs(x: any): number {
    if (x == null) return 0;
    if (typeof x === 'string') {
      const t = Date.parse(x);
      return isNaN(t) ? 0 : t;
    }
    if (x instanceof Date) return x.getTime();
    const maybeDate = typeof x?.toDate === 'function' ? x.toDate() : null;
    if (maybeDate instanceof Date) return maybeDate.getTime();
    if (typeof x === 'number') return x;
    return 0;
  }

  private async initializeDefaults(): Promise<void> {
    if (!db) {
      console.warn('Firestore is not initialized. Skipping default initialization.');
      return;
    }
    // Plans initialization moved down
    
    const notificationTemplatesSnapshot = await collections.notificationTemplates().get();
    if (notificationTemplatesSnapshot.empty) {
      const defaultTemplates = [
        {
          id: 'booking_request',
          name: 'New Booking Request',
          subject: 'New Booking Request: {{serviceName}}',
          bodyTemplate: 'You have a new booking request for {{serviceName}} from {{clientName}}.',
          channels: ['in_app', 'email'],
          isActive: true
        },
        {
          id: 'booking_confirmed',
          name: 'Booking Confirmed',
          subject: 'Booking Confirmed: {{serviceName}}',
          bodyTemplate: 'Your booking for {{serviceName}} has been confirmed by {{vendorName}}.',
          channels: ['in_app', 'email'],
          isActive: true
        },
        {
          id: 'escrow_funded',
          name: 'Funds Escrowed',
          subject: 'Payment Received in Escrow: {{bookingId}}',
          bodyTemplate: 'Funds for your booking {{bookingId}} have been securely deposited in escrow.',
          channels: ['in_app'],
          isActive: true
        },
        {
          id: 'milestone_completed',
          name: 'Milestone Completed',
          subject: 'Milestone Completed: {{milestoneTitle}}',
          bodyTemplate: 'Vendor has marked milestone "{{milestoneTitle}}" as completed. Please review and release funds.',
          channels: ['in_app', 'email'],
          isActive: true
        },
        {
          id: 'dispute_opened',
          name: 'Dispute Opened',
          subject: 'Dispute Opened: {{bookingId}}',
          bodyTemplate: 'A dispute has been opened for booking {{bookingId}}. Our team will review it shortly.',
          channels: ['in_app', 'email'],
          isActive: true
        },
        {
          id: 'kyc_verified',
          name: 'KYC Verified',
          subject: 'Identity Verification Successful',
          bodyTemplate: 'Congratulations! Your identity verification has been successful. You now have full access to the platform.',
          channels: ['in_app', 'email'],
          isActive: true
        },
        {
          id: 'kyc_rejected',
          name: 'KYC Rejected',
          subject: 'Identity Verification Failed',
          bodyTemplate: 'Unfortunately, your identity verification was rejected. Reason: {{reason}}. Please try again with valid documents.',
          channels: ['in_app', 'email'],
          isActive: true
        },
        {
          id: 'admin_post_removed',
          name: 'Post Removed by Moderator',
          subject: 'Post Removed',
          bodyTemplate: 'Your post "{{content}}" has been removed for violating community guidelines following a review.',
          channels: ['in_app', 'email'],
          isActive: true
        }
      ];
      
      const templateBatch = db.batch();
      defaultTemplates.forEach(t => {
        templateBatch.set(collections.notificationTemplates().doc(t.id), {
          ...t,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      await templateBatch.commit();
    }

    // Initialize empty placeholder documents to make collections visible in Firestore Console
    if (db) {
      await this.ensureCollectionExists('users', '_placeholder');
      await this.ensureCollectionExists('profiles', '_placeholder');
      await this.ensureCollectionExists('events', '_placeholder');
      await this.ensureCollectionExists('jobs', '_placeholder');
      await this.ensureCollectionExists('vendorServices', '_placeholder');
      await this.ensureCollectionExists('vendorApplications', '_placeholder');
      await this.ensureCollectionExists('vendorLeads', '_placeholder');
      await this.ensureCollectionExists('vendorBookings', '_placeholder');
      await this.ensureCollectionExists('subscriptions', '_placeholder');
      await this.ensureCollectionExists('sabiguardChats', '_placeholder');
      await this.ensureCollectionExists('sabiguardMessages', '_placeholder');
      await this.ensureCollectionExists('moatData', '_placeholder');
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
      await this.ensureCollectionExists('paymentMethods', '_placeholder');
      await this.ensureCollectionExists('plans', '_placeholder');
    }

    const plansSnapshot = await collections.plans().get();
    const existingPlans = plansSnapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {} as Record<string, any>);

    const defaultPlans = [
      // User Plans
      { id: 'free-user', name: 'Free', description: 'Basic features for individuals', price: 0, type: 'free', userType: 'user', dailyCredits: 5, billingCycle: 'monthly', features: ['Basic Search', 'Community Access', '5 AI Credits/mo'], active: true },
      { id: 'basic-user', name: 'Basic', description: 'Standard features for regular users', price: 2000, type: 'basic', userType: 'user', dailyCredits: 20, billingCycle: 'monthly', features: ['Standard Search', 'Standard Support', '20 AI Credits/mo'], active: true },
      { id: 'pro-user', name: 'Pro', description: 'Advanced features for professionals', price: 5000, type: 'pro', userType: 'user', dailyCredits: 50, billingCycle: 'monthly', features: ['Advanced Search', 'Priority Support', '50 AI Credits/mo', 'No Ads'], active: true },
      
      // Vendor Plans
      { id: 'free-vendor', name: 'Vendor Starter', description: 'Start your vendor journey', price: 0, type: 'free', userType: 'vendor', dailyCredits: 10, billingCycle: 'monthly', features: ['Profile Listing', 'Basic Leads', '10 AI Credits/mo'], active: true },
      { id: 'pro-vendor', name: 'Vendor Pro', description: 'Full features for professional vendors', price: 15000, type: 'pro', userType: 'vendor', dailyCredits: 200, billingCycle: 'monthly', features: ['Priority Leads', 'Featured Profile', '200 AI Credits/mo', 'Escrow Access'], active: true },
    ];

    const planBatch = db.batch();
    let plansUpdated = 0;

    for (const p of defaultPlans) {
      const existing = existingPlans[p.id];
      if (!existing || existing.type !== p.type || existing.userType !== p.userType) {
        console.log(`[Firestore] Updating/Adding plan: ${p.id}`);
        planBatch.set(collections.plans().doc(p.id), { 
          ...p, 
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        plansUpdated++;
      }
    }

    if (plansUpdated > 0) {
      await planBatch.commit();
      console.log(`[Firestore] Successfully updated ${plansUpdated} plans`);
    }

    const paymentMethodsSnapshot = await collections.paymentMethods().get();
    const existingMethods = paymentMethodsSnapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {} as Record<string, any>);

    const defaultMethods = [
      { id: 'paystack', name: 'Paystack', description: 'Pay with card, bank transfer, or USSD', active: true, icon: 'credit-card', type: 'paystack' },
      { id: 'flutterwave', name: 'Flutterwave', description: 'Pay with card, bank transfer, or mobile money', active: true, icon: 'zap', type: 'flutterwave' },
      { id: 'wallet', name: 'Wallet', description: 'Pay using your DigiZen wallet balance', active: true, icon: 'wallet', type: 'wallet' }
    ];

    if (!db) throw new Error("Firestore not initialized");
    const batch = db.batch();
    let updatedCount = 0;

    for (const m of defaultMethods) {
      const existing = existingMethods[m.id];
      if (!existing || existing.type !== m.type || existing.icon !== m.icon) {
        console.log(`[Firestore] Updating/Adding payment method: ${m.id}`);
        batch.set(collections.paymentMethods().doc(m.id), { 
          ...m, 
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`[Firestore] Successfully updated ${updatedCount} payment methods`);
    }
  }

  private async ensureCollectionExists(collectionName: string, placeholderId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized");
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

  // Credit Packages
  async getCreditPackages(): Promise<any[]> {
    const snapshot = await collections.creditPackages().get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createCreditPackage(packageData: any): Promise<any> {
    const docRef = await collections.creditPackages().add({
      ...packageData,
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, ...packageData };
  }

  async updateCreditPackage(packageId: string, updates: any): Promise<any> {
    const packageRef = collections.creditPackages().doc(packageId);
    await packageRef.update(updates);
    const doc = await packageRef.get();
    return { id: doc.id, ...doc.data() };
  }

  async deleteCreditPackage(packageId: string): Promise<boolean> {
    const packageRef = collections.creditPackages().doc(packageId);
    const doc = await packageRef.get();
    if (!doc.exists) return false;
    
    await packageRef.delete();
    return true;
  }

  // Payment Methods
  async getPaymentMethods(): Promise<any[]> {
    const snapshot = await collections.paymentMethods().get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getActivePaymentMethods(): Promise<any[]> {
    const snapshot = await collections.paymentMethods().where('active', '==', true).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createPaymentMethod(methodData: any): Promise<any> {
    const docRef = await collections.paymentMethods().add({
      ...methodData,
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, ...methodData };
  }

  async updatePaymentMethod(methodId: string, updates: any): Promise<any> {
    const methodRef = collections.paymentMethods().doc(methodId);
    await methodRef.update(updates);
    const doc = await methodRef.get();
    return { id: doc.id, ...doc.data() };
  }

  async deletePaymentMethod(methodId: string): Promise<boolean> {
    const methodRef = collections.paymentMethods().doc(methodId);
    const doc = await methodRef.get();
    if (!doc.exists) return false;
    
    await methodRef.delete();
    return true;
  }

  async toggleUserAdmin(userId: string, isAdmin: boolean): Promise<boolean> {
    try {
      await collections.profiles().doc(userId).set({ isAdmin }, { merge: true });
      return true;
    } catch (error) {
      console.error('Failed to toggle user admin:', error);
      return false;
    }
  }

  async toggleUserVendor(userId: string, isVendor: boolean): Promise<boolean> {
    try {
      await collections.profiles().doc(userId).set({ isVendor }, { merge: true });
      return true;
    } catch (error) {
      console.error('Failed to toggle user vendor:', error);
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
    if (!db) return undefined;
    
    // Check new profiles collection first
    const profileDoc = await collections.profiles().doc(userId).get();
    
    // Also check old users collection for legacy data
    const userDoc = await collections.users().doc(userId).get();
    
    if (!profileDoc.exists && !userDoc.exists) {
      console.log(`[FirestoreStorage] No profile or user found for ${userId}`);
      return undefined;
    }
    
    // Merge data from both sources (profile takes priority, but include legacy fields)
    const profileData = profileDoc.exists ? profileDoc.data() : {};
    const userData = userDoc.exists ? userDoc.data() : {};
    
    const isAdmin = profileData?.isAdmin === true || userData?.isAdmin === true || userData?.role === 'admin';
    const isVendor = profileData?.isVendor === true || userData?.isVendor === true || userData?.role === 'vendor' || userData?.role === 'provider';

    // Map old format fields to new format
    const merged = {
      userId,
      displayName: profileData?.displayName || userData?.name || userData?.username || null,
      email: profileData?.email || userData?.email || null,
      city: profileData?.city || userData?.city || null,
      state: profileData?.state || userData?.state || null,
      isVendor,
      isAdmin,
      kycStatus: profileData?.kycStatus || (userData?.isVerified ? 'verified' : 'pending'),
      kycDocument: profileData?.kycDocument || null,
      kycSubmittedAt: profileData?.kycSubmittedAt || null,
      kycVerifiedAt: profileData?.kycVerifiedAt || null,
      vendorMode: profileData?.vendorMode ?? false,
      chatStorageLimit: profileData?.chatStorageLimit || 524288,
      chatStorageUsed: profileData?.chatStorageUsed || 0,
      createdAt: profileData?.createdAt || userData?.joinedAt || new Date(),
    };
    
    console.log(`[FirestoreStorage] Merged profile for ${userId}:`, { 
      isAdmin: merged.isAdmin, 
      isVendor: merged.isVendor,
      vendorMode: merged.vendorMode 
    });
    
    return merged as UserProfile;
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | undefined> {
    const profileRef = collections.profiles().doc(userId);
    const doc = await profileRef.get();
    
    // Ensure we don't overwrite email and id if they are sensitive
    const { email, userId: uid, ...allowedUpdates } = updates as any;
    
    if (!doc.exists) {
      // If it doesn't exist, create it with set
      const newProfile = { ...allowedUpdates, userId };
      await profileRef.set(newProfile);
      return newProfile as UserProfile;
    }
    
    await profileRef.update(allowedUpdates);
    const updatedDoc = await profileRef.get();
    return updatedDoc.data() as UserProfile;
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

  async getVendorServices(filters?: { type?: string, city?: string, specialization?: string, lat?: number, lng?: number }): Promise<VendorService[]> {
    let query: any = collections.vendorServices();
    
    if (filters) {
      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }
      // If specialization is provided, use it
      if (filters.specialization) {
        query = query.where('specialization', '==', filters.specialization);
      }
    }

    const snapshot = await query.get();
    let services = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as VendorService));

    // Client-side filtering and distance sorting
    if (filters?.lat && filters?.lng) {
      const R = 6371; // Earth's radius in km
      services = services.map((s: VendorService) => {
        const sLat = parseFloat(s.latitude || '0');
        const sLng = parseFloat(s.longitude || '0');
        
        if (sLat === 0 && sLng === 0) return { ...s, distance: 9999 };

        const dLat = (sLat - filters.lat!) * Math.PI / 180;
        const dLon = (sLng - filters.lng!) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(filters.lat! * Math.PI / 180) * Math.cos(sLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        return { ...s, distance };
      });

      // Sort by distance primarily
      services.sort((a: any, b: any) => a.distance - b.distance);
    } else if (filters?.city && filters.city.toLowerCase() !== 'nigeria') {
      const cityLower = filters.city.toLowerCase();
      services = services.filter((s: VendorService) => 
        s.location?.toLowerCase().includes(cityLower) || 
        (s as any).city?.toLowerCase() === cityLower
      );

      // Sort by "closeness" - if it matches the city exactly, put it first
      services.sort((a: VendorService, b: VendorService) => {
        const aExact = a.location?.toLowerCase() === cityLower;
        const bExact = b.location?.toLowerCase() === cityLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });
    }

    return services;
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
      .sort((a, b) => this.toMs(b.createdAt) - this.toMs(a.createdAt));
  }

  async createPayment(payment: any): Promise<Payment> {
    const id = crypto.randomUUID();
    const newPayment = { 
      ...payment, 
      id, 
      status: payment.status || 'pending',
      createdAt: new Date() 
    };
    await collections.payments().doc(id).set(newPayment);
    return newPayment as Payment;
  }

  async getPaymentById(paymentId: string): Promise<Payment | null> {
    const doc = await collections.payments().doc(paymentId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Payment : null;
  }

  async updatePaymentStatus(paymentId: string, status: string, providerRef?: string): Promise<void> {
    const update: any = { status };
    if (providerRef) update.providerRef = providerRef;
    await collections.payments().doc(paymentId).update(update);
  }

  async updatePayment(paymentId: string, updates: any): Promise<void> {
    await collections.payments().doc(paymentId).update(updates);
  }

  async getAllUsers(): Promise<UserProfile[]> {
    const snapshot = await collections.profiles().get();
    return snapshot.docs.map(doc => doc.data() as UserProfile);
  }

  async getAllVendors(): Promise<UserProfile[]> {
    const snapshot = await collections.profiles().where('isVendor', '==', true).get();
    return snapshot.docs.map(doc => doc.data() as UserProfile);
  }

  async getImpersonationToken(userId: string): Promise<string> {
    return await admin.auth().createCustomToken(userId);
  }

  async getAllVendorApplications(): Promise<VendorApplication[]> {
    const snapshot = await collections.vendorApplications().get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as VendorApplication));
  }

  async getJobs(limit: number = 50): Promise<any[]> {
    let query: any = collections.jobs();
    query = query.orderBy('postedAt', 'desc').limit(limit);
    const snapshot = await query.get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  }

  async createJob(job: any): Promise<any> {
    const id = crypto.randomUUID();
    const newJob = { ...job, id, postedAt: new Date().toISOString() };
    await collections.jobs().doc(id).set(newJob);
    return newJob;
  }

  async updateJob(jobId: string, updates: any): Promise<void> {
    await collections.jobs().doc(jobId).update(updates);
  }

  async deleteJob(jobId: string): Promise<void> {
    await collections.jobs().doc(jobId).delete();
  }

  async getVendorLeads(vendorId: string): Promise<any[]> {
    const snapshot = await collections.vendorLeads().where('vendorId', '==', vendorId).get();
    return snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => this.toMs(b.createdAt) - this.toMs(a.createdAt));
  }

  async createVendorLead(lead: any): Promise<any> {
    const id = crypto.randomUUID();
    const newLead = { ...lead, id, createdAt: new Date().toISOString(), status: 'new' };
    await collections.vendorLeads().doc(id).set(newLead);
    return newLead;
  }

  async getVendorBookings(vendorId: string): Promise<any[]> {
    // Get bookings from the main bookings collection (escrow system)
    const snapshot = await collections.bookings().where('vendorId', '==', vendorId).get();
    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          customerName: data.customerName || data.buyerName || 'Unknown',
          service: data.serviceName || data.serviceType || 'Service',
          date: data.scheduledDate || data.createdAt,
          time: data.scheduledTime || '',
          status: data.status || 'pending',
          amount: parseFloat(data.amount || 0),
          ...data
        };
      })
      .sort((a: any, b: any) => this.toMs(b.createdAt) - this.toMs(a.createdAt));
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

  async getVendorStats(vendorId: string): Promise<{ totalLeads: number; totalBookings: number; totalEarnings: number; thisMonthLeads: number; thisMonthBookings: number; thisMonthEarnings: number }> {
    // Get all bookings for this vendor
    const allBookingsSnapshot = await collections.bookings().where('vendorId', '==', vendorId).get();
    
    // Calculate totals
    let totalBookings = 0;
    let totalEarnings = 0;
    let thisMonthBookings = 0;
    let thisMonthEarnings = 0;
    
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    allBookingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const amount = parseFloat(data.amount || 0);
      const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
      
      // Count all bookings
      totalBookings++;
      
      // Only count completed bookings for earnings
      if (data.status === 'completed' || data.status === 'released') {
        totalEarnings += amount;
      }
      
      // This month stats
      if (createdAt >= firstDayOfMonth) {
        thisMonthBookings++;
        if (data.status === 'completed' || data.status === 'released') {
          thisMonthEarnings += amount;
        }
      }
    });
    
    // Count leads (service inquiries) - these are stored separately
    const leadsSnapshot = await collections.vendorLeads().where('vendorId', '==', vendorId).get();
    let totalLeads = leadsSnapshot.size;
    let thisMonthLeads = 0;
    
    leadsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
      if (createdAt >= firstDayOfMonth) {
        thisMonthLeads++;
      }
    });

    return {
      totalLeads,
      totalBookings,
      totalEarnings,
      thisMonthLeads,
      thisMonthBookings,
      thisMonthEarnings
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

  async getWalletByUserId(userId: string): Promise<Wallet | undefined> {
    const snapshot = await collections.wallets().where('userId', '==', userId).limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Wallet;
  }

  async createWallet(userId: string, currency: string = 'NGN'): Promise<Wallet> {
    const existing = await this.getWalletByUserId(userId);
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

  async topUpWallet(userId: string, amount: number, reference: string, description: string): Promise<void> {
    const wallet = await this.getWalletByUserId(userId);
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
  }

  async addCredits(userId: string, amount: number, reason: string): Promise<void> {
    const credits = await this.getUserCredits(userId);
    const currentTotal = credits?.totalCredits || 0;
    const newTotal = currentTotal + amount;
    
    if (credits) {
      await collections.credits().doc(credits.id).update({
        totalCredits: newTotal,
        updatedAt: new Date().toISOString()
      });
    } else {
      const id = crypto.randomUUID();
      await collections.credits().doc(id).set({
        id,
        userId,
        totalCredits: newTotal,
        usedCredits: 0,
        updatedAt: new Date().toISOString()
      });
    }

    // Log the credit addition
    const logId = crypto.randomUUID();
    await collections.creditLogs().doc(logId).set({
      id: logId,
      userId,
      amount,
      feature: 'admin_add',
      description: reason,
      createdAt: new Date().toISOString()
    });
  }

  async getWalletTransactions(userId: string, limit: number = 50): Promise<WalletTransaction[]> {
    const wallet = await this.getWalletByUserId(userId);
    if (!wallet) return [];
    
    // Fetch without orderBy to avoid index requirement, then sort in memory
    const snapshot = await collections.walletTransactions()
      .where('walletId', '==', wallet.id)
      .get();
    
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as WalletTransaction))
      .sort((a, b) => this.toMs(b.createdAt) - this.toMs(a.createdAt))
      .slice(0, limit);
  }

  async createWalletTransaction(transaction: any): Promise<any> {
    const id = crypto.randomUUID();
    const newTransaction = {
      ...transaction,
      id,
      createdAt: new Date().toISOString()
    };
    await collections.walletTransactions().doc(id).set(newTransaction);
    return newTransaction;
  }

  async getWallets(): Promise<any[]> {
    const snapshot = await collections.wallets().get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  }

  async updateWallet(userId: string, updates: any): Promise<void> {
    const wallet = await this.getWalletByUserId(userId);
    if (wallet) {
      await collections.wallets().doc(wallet.id).update({
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } else {
      const id = crypto.randomUUID();
      await collections.wallets().doc(id).set({
        id,
        userId,
        balance: '0',
        currency: 'USD',
        ...updates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  async deductFromWallet(userId: string, amount: number, type: string, reference?: string, description?: string): Promise<any> {
    const wallet = await this.getWalletByUserId(userId);
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
    return transaction;
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
    return bookings.sort((a, b) => this.toMs(b.createdAt) - this.toMs(a.createdAt));
  }

  async getBookingsByVendorId(vendorId: string): Promise<Booking[]> {
    const snapshot = await collections.bookings()
      .where('vendorId', '==', vendorId)
      .get();
    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
    return bookings.sort((a, b) => this.toMs(b.createdAt) - this.toMs(a.createdAt));
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

  async updateEscrowStatus(id: string, status: string, releasedAmount?: string): Promise<void> {
    const updateData: any = { status };
    if (releasedAmount) updateData.releasedAmount = releasedAmount;
    if (status === 'released' || status === 'refunded') updateData.releasedAt = new Date().toISOString();
    
    await collections.escrowAccounts().doc(id).update(updateData);
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

    const vendorWallet = await this.getWalletByUserId(vendorId);
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
      adminJoined: false,
      createdAt: new Date().toISOString()
    };
    await collections.disputes().doc(id).set(newDispute);

    await this.updateBookingStatus(dispute.bookingId, 'disputed');

    // Add auto-message to chat
    await this.createBookingMessage({
      bookingId: dispute.bookingId,
      senderId: 'system',
      message: "A dispute has been opened. Please provide all necessary evidence (screenshots, documents, etc.) to enable the admin to settle the escrow fairly. Once an admin joins the chat, further communication between the user and vendor will be restricted.",
      isAdminMessage: true,
      attachments: []
    });

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

  async getDisputes(): Promise<Dispute[]> {
    const snapshot = await collections.disputes()
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => ({ id: doc.id, ...doc.data() } as Dispute));
  }

  async joinDispute(disputeId: string, adminId: string): Promise<Dispute | null> {
    const dispute = await this.getDisputeById(disputeId);
    if (!dispute) return null;

    await collections.disputes().doc(disputeId).update({
      adminJoined: true,
      status: 'under_review'
    });

    // Add admin joined message
    await this.createBookingMessage({
      bookingId: dispute.bookingId,
      senderId: adminId,
      message: "An administrator has joined this dispute. Chat between user and vendor is now restricted. Please wait for the admin's decision.",
      isAdminMessage: true,
      attachments: []
    });

    return await this.getDisputeById(disputeId) || null;
  }

  async updateDisputeStatus(id: string, status: string, resolution?: string, notes?: string, resolvedBy?: string): Promise<void> {
    const updateData: any = { status };
    if (resolution) updateData.resolution = resolution;
    if (notes) updateData.resolutionNotes = notes;
    if (resolvedBy) updateData.resolvedBy = resolvedBy;
    if (status === 'resolved') updateData.resolvedAt = new Date().toISOString();
    
    await collections.disputes().doc(id).update(updateData);
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
      .sort((a: any, b: any) => this.toMs(b.appliedAt) - this.toMs(a.appliedAt));
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
      .sort((a, b) => this.toMs(b.generatedAt) - this.toMs(a.generatedAt));
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
    const typed: Notification = {
      id,
      userId: newNotification.userId,
      type: newNotification.type,
      title: newNotification.title,
      message: newNotification.message,
      data: newNotification.data,
      channel: newNotification.channel,
      isRead: newNotification.isRead,
      createdAt: new Date(newNotification.createdAt),
      readAt: null
    };
    return typed;
  }

  async getNotificationsByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const snapshot = await collections.notifications()
      .where('userId', '==', userId)
      .get();
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
      .sort((a, b) => this.toMs(b.createdAt) - this.toMs(a.createdAt))
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
    
    if (!db) throw new Error("Firestore not initialized");
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
      createdAt: new Date(),
      updatedAt: new Date()
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
      updatedAt: new Date()
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
      updatedAt: new Date()
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
      createdAt: new Date()
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
    
    if (!db) throw new Error("Firestore not initialized");
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

  // ===== Forum Methods =====

  async getForumPost(postId: string): Promise<any | undefined> {
    const doc = await collections.forumPosts().doc(postId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : undefined;
  }

  async getForumPosts(): Promise<any[]> {
    const snapshot = await collections.forumPosts().orderBy('timestamp', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createForumPost(post: any): Promise<any> {
    const id = crypto.randomUUID();
    const item = {
      ...post,
      id,
      upvotes: 0,
      downvotes: 0,
      comments: [],
      upvotedBy: [],
      timestamp: new Date().toISOString()
    };
    await collections.forumPosts().doc(id).set(item);
    return item;
  }

  async updateForumPost(postId: string, updates: any): Promise<void> {
    await collections.forumPosts().doc(postId).update(updates);
  }

  async addForumComment(postId: string, comment: any): Promise<void> {
    await collections.forumPosts().doc(postId).update({
      comments: admin.firestore.FieldValue.arrayUnion({
        ...comment,
        id: crypto.randomUUID(),
        upvotes: 0,
        upvotedBy: [],
        timestamp: new Date().toISOString()
      })
    });
  }

  async deleteForumPost(postId: string): Promise<void> {
    await collections.forumPosts().doc(postId).delete();
  }

  async deleteForumComment(postId: string, commentId: string): Promise<void> {
    const post = await this.getForumPost(postId);
    if (!post || !post.comments) return;
    
    const newComments = post.comments.filter((c: any) => c.id !== commentId);
    await collections.forumPosts().doc(postId).update({ comments: newComments });
  }

  async voteForumPost(postId: string, userId: string, type: 'up' | 'down'): Promise<void> {
    const post = await this.getForumPost(postId);
    if (!post) return;
    
    if (post.upvotedBy?.includes(userId)) return;

    await collections.forumPosts().doc(postId).update({
      [type === 'up' ? 'upvotes' : 'downvotes']: admin.firestore.FieldValue.increment(1),
      upvotedBy: admin.firestore.FieldValue.arrayUnion(userId)
    });
  }

  async voteForumComment(postId: string, commentId: string, userId: string): Promise<void> {
    const post = await this.getForumPost(postId);
    if (!post || !post.comments) return;

    const comment = post.comments.find((c: any) => c.id === commentId);
    if (!comment || (comment.upvotedBy && comment.upvotedBy.includes(userId))) return;

    const newComments = post.comments.map((c: any) => 
      c.id === commentId 
        ? { ...c, upvotes: (c.upvotes || 0) + 1, upvotedBy: [...(c.upvotedBy || []), userId] }
        : c
    );

    await collections.forumPosts().doc(postId).update({ comments: newComments });
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

  // ===== SabiGuard Chat Methods =====

  async getSabiGuardChats(userId: string): Promise<SabiGuardChat[]> {
    const snapshot = await collections.sabiguardChats()
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();
    return snapshot.docs
      .filter(doc => doc.id !== '_placeholder')
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt instanceof admin.firestore.Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof admin.firestore.Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)
        } as SabiGuardChat;
      });
  }

  async getSabiGuardMessages(chatId: string): Promise<SabiGuardMessage[]> {
    const snapshot = await collections.sabiguardMessages()
      .where('chatId', '==', chatId)
      .orderBy('createdAt', 'asc')
      .get();
    return snapshot.docs
      .filter(doc => doc.id !== '_placeholder')
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt instanceof admin.firestore.Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)
        } as SabiGuardMessage;
      });
  }

  async createSabiGuardChat(userId: string, title: string): Promise<SabiGuardChat> {
    const id = crypto.randomUUID();
    const now = new Date();
    const chat: SabiGuardChat = {
      id,
      userId,
      title,
      createdAt: now,
      updatedAt: now
    };
    await collections.sabiguardChats().doc(id).set({
      ...chat,
      createdAt: admin.firestore.Timestamp.fromDate(now),
      updatedAt: admin.firestore.Timestamp.fromDate(now)
    });
    return chat;
  }

  async addSabiGuardMessage(chatId: string, role: string, content: string): Promise<SabiGuardMessage> {
    const id = crypto.randomUUID();
    const now = new Date();
    const message: SabiGuardMessage = {
      id,
      chatId,
      role,
      content,
      createdAt: now
    };
    await collections.sabiguardMessages().doc(id).set({
      ...message,
      createdAt: admin.firestore.Timestamp.fromDate(now)
    });
    
    // Update chat timestamp
    await collections.sabiguardChats().doc(chatId).update({
      updatedAt: admin.firestore.Timestamp.fromDate(now)
    });
    
    return message;
  }

  async deleteSabiGuardChat(chatId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized");
    // Delete all messages in the chat
    const messagesSnapshot = await collections.sabiguardMessages().where('chatId', '==', chatId).get();
    const batch = db.batch();
    messagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete the chat itself
    batch.delete(collections.sabiguardChats().doc(chatId));
    await batch.commit();
  }

  async updateChatStorageUsed(userId: string, bytes: number): Promise<void> {
    const profileRef = collections.profiles().doc(userId);
    const profile = await profileRef.get();
    if (profile.exists) {
      const currentUsed = (profile.data() as UserProfile).chatStorageUsed || 0;
      await profileRef.update({
        chatStorageUsed: currentUsed + bytes
      });
    }
  }

  // ===== MOAT Data Methods =====

  async getMoatData(category?: string): Promise<MoatData[]> {
    let query: any = collections.moatData();
    if (category) {
      query = query.where('category', '==', category);
    }
    const snapshot = await query.get();
    const results = snapshot.docs
      .filter((doc: any) => doc.id !== '_placeholder')
      .map((doc: any) => doc.data() as MoatData);
    
    results.sort((a: MoatData, b: MoatData) => this.toMs(b.createdAt) - this.toMs(a.createdAt));
    return results;
  }

  async createMoatData(data: any): Promise<MoatData> {
    const id = crypto.randomUUID();
    const item: MoatData = { 
      ...data, 
      id, 
      createdAt: new Date() 
    };
    await collections.moatData().doc(id).set({
      ...item,
      createdAt: admin.firestore.Timestamp.fromDate(item.createdAt as Date)
    });
    return item;
  }

  // ===== Vendor Service Approval Methods =====

  async getAllVendorServices(): Promise<VendorService[]> {
    const snapshot = await collections.vendorServices().get();
    return snapshot.docs
      .filter(doc => doc.id !== '_placeholder')
      .map(doc => doc.data() as VendorService);
  }

  async approveVendorService(serviceId: string): Promise<void> {
    await collections.vendorServices().doc(serviceId).update({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      verified: true
    });
  }

  async rejectVendorService(serviceId: string): Promise<void> {
    await collections.vendorServices().doc(serviceId).update({
      status: 'rejected',
      isActive: false
    });
  }

  async deleteMoatData(id: string): Promise<void> {
    await collections.moatData().doc(id).delete();
  }

  // ===== FAQ Methods =====

  async getFaqs(): Promise<any[]> {
    const snapshot = await collections.faqs().orderBy('order', 'asc').get();
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createFaq(faq: any): Promise<any> {
    const id = crypto.randomUUID();
    const item = {
      ...faq,
      id,
      isActive: faq.isActive ?? true,
      order: faq.order ?? 0,
      createdAt: new Date().toISOString()
    };
    await collections.faqs().doc(id).set(item);
    return item;
  }

  async updateFaq(id: string, faq: any): Promise<void> {
    await collections.faqs().doc(id).update({
      ...faq,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteFaq(id: string): Promise<void> {
    await collections.faqs().doc(id).delete();
  }

  // ===== Testimonial Methods =====

  async getTestimonials(): Promise<any[]> {
    const snapshot = await collections.testimonials().orderBy('createdAt', 'desc').get();
    return snapshot.docs
      .filter(doc => !doc.data()._isPlaceholder)
      .map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createTestimonial(testimonial: any): Promise<any> {
    const id = crypto.randomUUID();
    const item = {
      ...testimonial,
      id,
      isActive: testimonial.isActive ?? true,
      rating: testimonial.rating ?? 5,
      createdAt: new Date().toISOString()
    };
    await collections.testimonials().doc(id).set(item);
    return item;
  }

  async updateTestimonial(id: string, testimonial: any): Promise<void> {
    await collections.testimonials().doc(id).update({
      ...testimonial,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteTestimonial(id: string): Promise<void> {
    await collections.testimonials().doc(id).delete();
  }

  // Survey methods
  async createSurvey(survey: any): Promise<any> {
    const id = crypto.randomUUID();
    const newSurvey = {
      ...survey,
      id,
      createdAt: new Date()
    };
    await collections.surveys().doc(id).set(newSurvey);
    return newSurvey;
  }

  async getSurveys(): Promise<any[]> {
    const snapshot = await collections.surveys().get();
    return snapshot.docs
      .map(doc => doc.data())
      .filter(item => item.id !== 'placeholder')
      .sort((a, b) => this.toMs(b.createdAt) - this.toMs(a.createdAt));
  }

  async getSurveysByFeature(feature: string): Promise<any[]> {
    const snapshot = await collections.surveys().where('feature', '==', feature).get();
    return snapshot.docs
      .map(doc => doc.data())
      .sort((a, b) => this.toMs(b.createdAt) - this.toMs(a.createdAt));
  }
}

  // Duplicate Wallet methods removed to resolve build errors

export const firestoreStorage = new FirestoreStorage();
