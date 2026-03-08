import { type User, type InsertUser, type Subscription, type Credits, type Plan, type CreditLog, type CloakedRoute, type TrafficAlert, type DashboardTrafficCard, type UserProfile, type VendorApplication, type Event, type VendorService, type AdminSetting, type Payment, type Notification, type NotificationTemplate, type SabiGuardChat, type SabiGuardMessage, type MoatData, type Booking, type CrowdTranslation, type TrainingTerm, type InsertTrainingTerm } from "../shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        displayName?: string;
      };
      userId?: string;
      booking?: Booking;
      isAdmin?: boolean;
    }
  }
}

export interface IStorage {
  // ... (previous methods)
  // Crowd Translations
  submitTranslation(data: any): Promise<CrowdTranslation>;
  getRandomTranslationForVerification(excludeUserId: string): Promise<CrowdTranslation | null>;
  voteTranslation(translationId: string, vote: boolean): Promise<void>;
  getVerifiedTranslations(minVotes: number): Promise<CrowdTranslation[]>;
  getCrowdTranslationStats(): Promise<{ total: number, verified: number, totalVotes: number, byLanguage: Record<string, number> }>;
  getAllCrowdTranslations(): Promise<CrowdTranslation[]>;

  // Training Terms
  getTrainingTerms(): Promise<TrainingTerm[]>;
  createTrainingTerm(data: InsertTrainingTerm): Promise<TrainingTerm>;
  deleteTrainingTerm(id: string): Promise<void>;

  // SabiGuard Chat
  getSabiGuardChats(userId: string): Promise<SabiGuardChat[]>;
  getSabiGuardMessages(chatId: string): Promise<SabiGuardMessage[]>;
  createSabiGuardChat(userId: string, title: string): Promise<SabiGuardChat>;
  addSabiGuardMessage(chatId: string, role: string, content: string): Promise<SabiGuardMessage>;
  deleteSabiGuardChat(chatId: string): Promise<void>;
  updateChatStorageUsed(userId: string, bytes: number): Promise<void>;
  
  // MOAT Data
  getMoatData(category?: string): Promise<MoatData[]>;
  createMoatData(data: any): Promise<MoatData>;
  deleteMoatData(id: string): Promise<void>;

  // Vendor Service Approval
  approveVendorService(serviceId: string): Promise<void>;
  rejectVendorService(serviceId: string): Promise<void>;
  getAllVendorServices(): Promise<VendorService[]>;
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
  createPlan(plan: any): Promise<Plan>;
  getPlansByType(type: 'free' | 'basic' | 'pro' | 'enterprise', userType: 'user' | 'vendor'): Promise<Plan[]>;

  // Cloaked Routes
  getUserRoutes(userId: string): Promise<CloakedRoute[]>;
  getRoute(routeId: string): Promise<CloakedRoute | undefined>;
  createRoute(route: any): Promise<CloakedRoute>;
  updateRouteStatus(routeId: string, status: string): Promise<void>;
  deleteRoute(routeId: string): Promise<void>;

  // Traffic Alerts
  getRouteAlerts(routeId: string, limit?: number): Promise<TrafficAlert[]>;
  createAlert(alert: any): Promise<TrafficAlert>;
  acknowledgeAlert(alertId: string): Promise<void>;

  // Email Verification & Vendor
  updateEmailVerificationStatus(userId: string, status: string, document?: string): Promise<void>;
  setEmailVerificationCode(userId: string, code: string, expires: Date): Promise<void>;
  verifyEmailCode(userId: string, code: string): Promise<boolean>;
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | undefined>;
  submitVendorApplication(userId: string, app: any): Promise<VendorApplication>;
  getVendorApplication(userId: string): Promise<VendorApplication | undefined>;
  approveVendorApplication(userId: string): Promise<void>;
  rejectVendorApplication(userId: string): Promise<void>;
  switchVendorMode(userId: string, vendorMode: boolean): Promise<void>;

  // Dashboard Traffic
  getDashboardTraffic(userId: string): Promise<DashboardTrafficCard | undefined>;
  updateDashboardTraffic(userId: string, location: string, status: string, description: string): Promise<void>;
  refreshDashboardTraffic?(userId: string): Promise<void>;

  // Events
  getEvents(): Promise<Event[]>;
  createEvent(event: any): Promise<Event>;
  updateEvent(eventId: string, event: any): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  registerForEvent(eventId: string, userId: string): Promise<void>;

  // Vendor Services
  getVendorServices(filters?: { type?: string, city?: string, specialization?: string, lat?: number, lng?: number }): Promise<VendorService[]>;
  getVendorServiceById(serviceId: string): Promise<VendorService | undefined>;
  createVendorService(service: any): Promise<VendorService>;
  updateVendorService(serviceId: string, service: any): Promise<void>;
  deleteVendorService(serviceId: string): Promise<void>;

  // Admin Settings
  getAdminSettings(category?: string): Promise<AdminSetting[]>;
  getAdminSetting(key: string): Promise<AdminSetting | undefined>;
  setAdminSetting(key: string, value: string, category: string, isSecret?: boolean): Promise<void>;

  // Payments
  getPayments(userId?: string): Promise<Payment[]>;
  getPayment(paymentId: string): Promise<Payment | undefined>;
  createPayment(payment: any): Promise<Payment>;
  updatePaymentStatus(paymentId: string, status: string, providerRef?: string): Promise<void>;

  // Admin User Management
  getAllUsers(): Promise<UserProfile[]>;
  getAllVendors(): Promise<UserProfile[]>;
  getAllVendorApplications(): Promise<VendorApplication[]>;
  setUserAsAdmin(userId: string): Promise<boolean>;
  toggleUserAdmin(userId: string, isAdmin: boolean): Promise<boolean>;
  toggleUserVendor(userId: string, isVendor: boolean): Promise<boolean>;
  deleteUser(userId: string): Promise<boolean>;
  getImpersonationToken(userId: string): Promise<string>;

  // Jobs
  getJobs(limit?: number): Promise<any[]>;
  createJob(job: any): Promise<any>;
  updateJob(jobId: string, updates: any): Promise<void>;
  deleteJob(jobId: string): Promise<void>;

  // Vendor Analytics
  getVendorStats(vendorId: string): Promise<any>;
  getVendorLeads(vendorId: string): Promise<any[]>;
  getVendorBookings(vendorId: string): Promise<any[]>;
  createVendorLead(lead: any): Promise<any>;
  createVendorBooking(booking: any): Promise<any>;

  // Credits (extended)
  setUserCredits(userId: string, totalCredits: number): Promise<void>;
  addCredits(userId: string, amount: number, reason: string): Promise<void>;

  // Escrow & Disputes
  getDisputes(): Promise<any[]>;
  getDisputeById(id: string): Promise<any | undefined>;
  createDispute(dispute: any): Promise<any>;
  updateDisputeStatus(id: string, status: string, resolution?: string, notes?: string, resolvedBy?: string): Promise<void>;
  joinDispute(id: string, adminId: string): Promise<any | undefined>;
  getBookingById(id: string): Promise<any | undefined>;
  updateBookingStatus(id: string, status: string): Promise<void>;
  getEscrowByBookingId(bookingId: string): Promise<any | undefined>;
  updateEscrowStatus(id: string, status: string, releasedAmount?: string): Promise<void>;
  getWalletByUserId(userId: string): Promise<any | undefined>;
  topUpWallet(userId: string, amount: number, reference: string, description: string): Promise<void>;
  deductFromWallet(userId: string, amount: number, type: string, reference: string, description: string): Promise<void>;
  createBookingMessage(message: any): Promise<any>;

  // Notifications
  createNotification(notification: any): Promise<Notification>;
  getNotificationsByUserId(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  sendNotification(options: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    templateName?: string;
    variables?: Record<string, string>;
    channels?: string[];
  }): Promise<Notification>;
  getNotificationTemplateByName(name: string): Promise<NotificationTemplate | undefined>;

  // Forum
  getForumPost(postId: string): Promise<any | undefined>;
  getForumPosts(): Promise<any[]>;
  createForumPost(post: any): Promise<any>;
  updateForumPost(postId: string, updates: any): Promise<void>;
  deleteForumPost(postId: string): Promise<void>;
  addForumComment(postId: string, comment: any): Promise<void>;
  deleteForumComment(postId: string, commentId: string): Promise<void>;
  voteForumPost(postId: string, userId: string, type: 'up' | 'down'): Promise<void>;
  voteForumComment(postId: string, commentId: string, userId: string): Promise<void>;

  // FAQs
  getFaqs(): Promise<any[]>;
  createFaq(faq: any): Promise<any>;
  updateFaq(id: string, faq: any): Promise<void>;
  deleteFaq(id: string): Promise<void>;

  // Testimonials
  getTestimonials(): Promise<any[]>;
  createTestimonial(testimonial: any): Promise<any>;
  updateTestimonial(id: string, testimonial: any): Promise<void>;
  deleteTestimonial(id: string): Promise<void>;

  // Surveys
  createSurvey(survey: any): Promise<any>;
  getSurveys(): Promise<any[]>;
  getSurveysByFeature(feature: string): Promise<any[]>;

  // Generated Jobs
  getGeneratedJobs(userId?: string): Promise<any[]>;
  createGeneratedJob(userId: string, jobData: any): Promise<any>;
  deleteGeneratedJob(id: string): Promise<void>;
  cleanupOldGeneratedJobs(hours: number): Promise<number>;
}
