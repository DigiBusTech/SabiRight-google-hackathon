import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { firestoreStorage as storage, verifyAdminToken, verifyUserToken } from "./firestoreStorage";
import PaystackService from "./paystackService";

const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  const result = await verifyAdminToken(token);
  
  if (!result.valid) {
    if (result.error === 'invalid_token') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (result.error === 'no_profile') {
      return res.status(401).json({ error: 'User profile not found' });
    }
    if (result.error === 'not_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
  
  (req as any).userId = result.userId;
  next();
};

const userAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  const result = await verifyUserToken(token);
  
  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  const pathUserId = req.params.userId;
  if (pathUserId && result.userId !== pathUserId) {
    return res.status(403).json({ error: 'Access denied: User ID mismatch' });
  }
  
  (req as any).userId = result.userId;
  next();
};

const bookingParticipantAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  const result = await verifyUserToken(token);
  
  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  const bookingId = req.params.id;
  if (!bookingId) {
    return res.status(400).json({ error: 'Booking ID required' });
  }
  
  const booking = await storage.getBookingById(bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  
  if (result.userId !== booking.userId && result.userId !== booking.vendorId) {
    return res.status(403).json({ error: 'Access denied: Not a booking participant' });
  }
  
  (req as any).userId = result.userId;
  (req as any).booking = booking;
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Plans
  app.get("/api/plans", async (req, res) => {
    const plans = await storage.getAllPlans();
    res.json(plans);
  });

  app.get("/api/plans/user-type/:userType", async (req, res) => {
    const { userType } = req.params;
    if (userType !== 'user' && userType !== 'vendor') {
      return res.status(400).json({ error: 'Invalid user type' });
    }
    const plans = await storage.getPlansByType('free', userType as 'user' | 'vendor');
    const proPlan = await storage.getPlansByType('pro', userType as 'user' | 'vendor');
    res.json([...plans, ...proPlan]);
  });

  // Credits
  app.get("/api/credits/:userId", async (req, res) => {
    const { userId } = req.params;
    const credits = await storage.getUserCredits(userId);
    if (!credits) {
      return res.status(404).json({ error: 'Credits not found' });
    }
    res.json(credits);
  });

  app.get("/api/credits/:userId/available", async (req, res) => {
    const { userId } = req.params;
    const credits = await storage.getUserCredits(userId);
    if (!credits) {
      return res.status(404).json({ error: 'Credits not found' });
    }
    
    // Refresh daily credits if needed
    const userPlan = await storage.getUserPlan(userId);
    if (userPlan?.dailyCredits) {
      await storage.refreshDailyCredits(userId, userPlan.dailyCredits);
    }
    
    const updatedCredits = await storage.getUserCredits(userId);
    const total = updatedCredits?.totalCredits || 0;
    const used = updatedCredits?.usedCredits || 0;
    const available = total - used;
    
    res.json({
      totalCredits: total,
      usedCredits: used,
      availableCredits: available,
      renewalDate: updatedCredits?.renewalDate
    });
  });

  app.post("/api/credits/:userId/deduct", async (req, res) => {
    const { userId } = req.params;
    const { amount, feature, description } = req.body;

    if (!amount || !feature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const success = await storage.deductCredits(userId, amount, feature, description);
    if (!success) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    const credits = await storage.getUserCredits(userId);
    const total = credits?.totalCredits || 0;
    const used = credits?.usedCredits || 0;
    res.json({
      success: true,
      remainingCredits: total - used,
      totalUsed: used
    });
  });

  app.post("/api/credits/:userId/refund", async (req, res) => {
    const { userId } = req.params;
    const { amount, feature } = req.body;

    if (!amount || !feature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await storage.refundCredits(userId, amount, feature);
    const credits = await storage.getUserCredits(userId);
    const total = credits?.totalCredits || 0;
    const used = credits?.usedCredits || 0;
    res.json({
      success: true,
      remainingCredits: total - used
    });
  });

  app.get("/api/credits/:userId/log", async (req, res) => {
    const { userId } = req.params;
    const logs = await storage.getCreditLog(userId);
    res.json(logs);
  });

  // Cloaked Routes
  app.get("/api/routes/:userId", async (req, res) => {
    const { userId } = req.params;
    const routes = await storage.getUserRoutes(userId);
    res.json(routes);
  });

  app.post("/api/routes", async (req, res) => {
    const { userId, routeName, startLocation, endLocation, startLat, startLng, endLat, endLng } = req.body;
    
    if (!userId || !routeName || !startLocation || !endLocation) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const route = await storage.createRoute({
      userId,
      routeName,
      startLocation,
      endLocation,
      startLat: parseFloat(startLat),
      startLng: parseFloat(startLng),
      endLat: parseFloat(endLat),
      endLng: parseFloat(endLng)
    });

    res.json(route);
  });

  app.patch("/api/routes/:routeId/status", async (req, res) => {
    const { routeId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    await storage.updateRouteStatus(routeId, status);
    res.json({ success: true, status });
  });

  app.delete("/api/routes/:routeId", async (req, res) => {
    const { routeId } = req.params;
    await storage.deleteRoute(routeId);
    res.json({ success: true });
  });

  // Traffic Alerts
  app.get("/api/alerts/:routeId", async (req, res) => {
    const { routeId } = req.params;
    const alerts = await storage.getRouteAlerts(routeId);
    res.json(alerts);
  });

  app.post("/api/alerts", async (req, res) => {
    const { routeId, userId, alertType, message, severity } = req.body;

    if (!routeId || !userId || !alertType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const alert = await storage.createAlert({
      routeId,
      userId,
      alertType,
      message,
      severity
    });

    res.json(alert);
  });

  app.patch("/api/alerts/:alertId/acknowledge", async (req, res) => {
    const { alertId } = req.params;
    await storage.acknowledgeAlert(alertId);
    res.json({ success: true });
  });

  // KYC & Vendor Endpoints
  app.post("/api/kyc/:userId/submit", async (req, res) => {
    const { userId } = req.params;
    const { kycDocument } = req.body;

    await storage.updateUserKYC(userId, 'pending', kycDocument);
    res.json({ success: true, status: 'pending' });
  });

  app.get("/api/profile/:userId", async (req, res) => {
    const { userId } = req.params;
    const profile = await storage.getUserProfile(userId);
    res.json(profile || {});
  });

  app.post("/api/profile/:userId", async (req, res) => {
    const { userId } = req.params;
    const { email, displayName } = req.body;
    
    const existingProfile = await storage.getUserProfile(userId);
    if (existingProfile && existingProfile.userId) {
      return res.json(existingProfile);
    }
    
    await storage.createUser({ id: userId, username: displayName || email || userId, password: '' } as any);
    await storage.updateUserProfile(userId, {
      userId,
      email: email || null,
      displayName: displayName || null,
      isVendor: false,
      kycStatus: 'pending',
      vendorMode: false,
      createdAt: new Date()
    });
    
    const newProfile = await storage.getUserProfile(userId);
    res.json(newProfile);
  });

  app.patch("/api/profile/:userId", async (req, res) => {
    const { userId } = req.params;
    await storage.updateUserProfile(userId, req.body);
    res.json({ success: true });
  });

  app.post("/api/vendor/apply", async (req, res) => {
    const { userId, businessName, serviceType, businessDocument, taxId } = req.body;
    
    if (!userId || !businessName || !serviceType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const application = await storage.submitVendorApplication(userId, {
      businessName,
      serviceType,
      businessDocument,
      taxId
    });

    res.json(application);
  });

  app.get("/api/vendor/application/:userId", async (req, res) => {
    const { userId } = req.params;
    const application = await storage.getVendorApplication(userId);
    res.json(application || {});
  });

  app.patch("/api/vendor/mode/:userId", adminAuth, async (req, res) => {
    const { userId } = req.params;
    const { vendorMode } = req.body;

    try {
      await storage.switchVendorMode(userId, vendorMode);
      res.json({ success: true, vendorMode });
    } catch (error: any) {
      if (error.message?.includes('Profile not found')) {
        return res.status(404).json({ error: 'User profile not found' });
      }
      throw error;
    }
  });

  app.patch("/api/vendor/self/mode", async (req, res) => {
    const { vendorMode } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.substring(7);
    const result = await verifyUserToken(token);
    if (!result.valid || !result.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = result.userId;
    const profile = await storage.getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    if (!profile.vendorMode) {
      return res.status(400).json({ error: 'Not an approved vendor' });
    }
    if (vendorMode === true) {
      return res.status(403).json({ error: 'Cannot self-approve as vendor. Contact admin.' });
    }

    try {
      await storage.switchVendorMode(userId, vendorMode);
      res.json({ success: true, vendorMode });
    } catch (error: any) {
      if (error.message?.includes('Profile not found')) {
        return res.status(404).json({ error: 'User profile not found' });
      }
      throw error;
    }
  });

  // Dashboard Traffic
  app.get("/api/dashboard/traffic/:userId", async (req, res) => {
    const { userId } = req.params;
    const traffic = await storage.getDashboardTraffic(userId);
    res.json(traffic || {});
  });

  app.post("/api/dashboard/traffic/:userId/refresh", async (req, res) => {
    const { userId } = req.params;
    const { location, status, description } = req.body;

    const credits = await storage.getUserCredits(userId);
    if (!credits) {
      return res.status(402).json({ error: 'No credits account' });
    }

    const totalCredits = credits.totalCredits || 0;
    const usedCredits = credits.usedCredits || 0;
    if (totalCredits - usedCredits < 1) {
      return res.status(402).json({ error: 'Insufficient credits for refresh' });
    }

    await storage.deductCredits(userId, 1, 'traffic_refresh', 'Daily traffic alert refresh');
    await storage.updateDashboardTraffic(userId, location, status, description);

    res.json({ success: true });
  });

  // Events
  app.get("/api/events", async (req, res) => {
    const events = await storage.getEvents();
    res.json(events);
  });

  app.post("/api/events", async (req, res) => {
    const { title, description, date, time, location, category, organizer, organizerId, maxAttendees } = req.body;
    
    if (!title || !date || !time || !location || !category || !organizer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const event = await storage.createEvent({
      title, description, date, time, location, category, organizer, organizerId, maxAttendees
    });
    res.json(event);
  });

  app.post("/api/events/:eventId/register", async (req, res) => {
    const { eventId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    await storage.registerForEvent(eventId, userId);
    res.json({ success: true });
  });

  app.delete("/api/events/:eventId", async (req, res) => {
    const { eventId } = req.params;
    await storage.deleteEvent(eventId);
    res.json({ success: true });
  });

  // Saved Events
  app.post("/api/events/:eventId/save", async (req, res) => {
    const { eventId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    await storage.saveEvent(userId, eventId);
    res.json({ success: true });
  });

  app.delete("/api/events/:eventId/save", async (req, res) => {
    const { eventId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    await storage.unsaveEvent(userId, eventId);
    res.json({ success: true });
  });

  app.get("/api/events/saved/:userId", async (req, res) => {
    const { userId } = req.params;
    const savedEventIds = await storage.getSavedEvents(userId);
    res.json(savedEventIds);
  });

  // Vendor Services
  app.get("/api/services", async (req, res) => {
    const services = await storage.getVendorServices();
    res.json(services);
  });

  app.post("/api/services", async (req, res) => {
    const { vendorId, name, type, specialization, description, location, latitude, longitude, contactPhone, contactEmail, priceRange } = req.body;
    
    if (!vendorId || !name || !type || !location) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const service = await storage.createVendorService({
      vendorId, name, type, specialization, description, location, latitude, longitude, contactPhone, contactEmail, priceRange
    });
    res.json(service);
  });

  app.patch("/api/services/:serviceId", async (req, res) => {
    const { serviceId } = req.params;
    await storage.updateVendorService(serviceId, req.body);
    res.json({ success: true });
  });

  app.delete("/api/services/:serviceId", async (req, res) => {
    const { serviceId } = req.params;
    await storage.deleteVendorService(serviceId);
    res.json({ success: true });
  });

  // Admin Settings - protected routes
  app.get("/api/admin/settings", adminAuth, async (req, res) => {
    const { category } = req.query;
    const settings = await storage.getAdminSettings(category as string | undefined);
    const filteredSettings = settings.map((s: any) => ({
      ...s,
      value: s.isSecret ? '••••••••' : s.value
    }));
    res.json(filteredSettings);
  });

  app.get("/api/admin/setting/:key", adminAuth, async (req, res) => {
    const { key } = req.params;
    const setting = await storage.getAdminSetting(key);
    res.json(setting || {});
  });

  app.post("/api/admin/settings", adminAuth, async (req, res) => {
    const { key, value, category, isSecret } = req.body;
    
    if (!key || !category) {
      return res.status(400).json({ error: 'Key and category required' });
    }

    await storage.setAdminSetting(key, value, category, isSecret);
    res.json({ success: true });
  });

  // Admin User Management - protected routes
  app.get("/api/admin/users", adminAuth, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/admin/vendor-applications", adminAuth, async (req, res) => {
    const applications = await storage.getAllVendorApplications();
    res.json(applications);
  });

  app.post("/api/admin/vendor/:userId/approve", adminAuth, async (req, res) => {
    const { userId } = req.params;
    await storage.approveVendorApplication(userId);
    res.json({ success: true });
  });

  app.post("/api/admin/vendor/:userId/reject", adminAuth, async (req, res) => {
    const { userId } = req.params;
    await storage.rejectVendorApplication(userId);
    res.json({ success: true });
  });

  // Admin: Update user profile
  app.patch("/api/admin/users/:userId", adminAuth, async (req, res) => {
    const { userId } = req.params;
    await storage.updateUserProfile(userId, req.body);
    res.json({ success: true });
  });

  // Admin: Update user credits
  app.patch("/api/admin/users/:userId/credits", adminAuth, async (req, res) => {
    const { userId } = req.params;
    const { totalCredits } = req.body;
    
    if (totalCredits === undefined || isNaN(parseInt(totalCredits))) {
      return res.status(400).json({ error: 'Valid totalCredits required' });
    }
    
    await storage.setUserCredits(userId, parseInt(totalCredits));
    res.json({ success: true });
  });

  // Debug: Show Firestore structure and create sample data
  app.get("/api/debug/firestore-status", async (req, res) => {
    try {
      const profiles = await storage.getAllUsers();
      const vendorApps = await storage.getAllVendorApplications();
      const plans = await storage.getAllPlans();
      const events = await storage.getEvents();
      const services = await storage.getVendorServices();
      const jobs = await storage.getJobs(10);
      
      res.json({
        message: "Firestore data location: artifacts > digital-citizen-v2 > [collection_name]",
        collections: {
          profiles: { count: profiles.length, path: "artifacts/digital-citizen-v2/profiles" },
          vendorApplications: { count: vendorApps.length, path: "artifacts/digital-citizen-v2/vendorApplications" },
          plans: { count: plans.length, path: "artifacts/digital-citizen-v2/plans" },
          events: { count: events.length, path: "artifacts/digital-citizen-v2/events" },
          vendorServices: { count: services.length, path: "artifacts/digital-citizen-v2/vendorServices" },
          jobs: { count: jobs.length, path: "artifacts/digital-citizen-v2/jobs" },
        },
        sampleProfiles: profiles.slice(0, 3),
        instructions: [
          "1. Go to Firebase Console > Firestore Database",
          "2. Click on 'artifacts' collection",
          "3. Click on 'digital-citizen-v2' document",
          "4. You will see subcollections: profiles, plans, credits, events, etc.",
          "5. Click on 'profiles' to see user data"
        ]
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Initialize sample data for testing
  app.post("/api/debug/init-sample-data", async (req, res) => {
    try {
      // Create sample event
      await storage.createEvent({
        title: "Civic Rights Workshop",
        description: "Learn about your rights as a Nigerian citizen",
        location: "Lagos, Victoria Island",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        capacity: 100,
        category: "workshop"
      });

      // Create sample job
      await storage.createJob({
        title: "Software Developer",
        company: "Tech Lagos",
        location: "Lagos",
        type: "Full-time",
        workMode: "Remote",
        salary: "N500,000 - N800,000",
        description: "Looking for an experienced developer",
        contact: "jobs@techlagos.com",
        source: "Sample Data",
        isAiFetched: false
      });

      res.json({ success: true, message: "Sample data created. Check Firestore Console." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Set user as admin (bootstrap endpoint - uses setup key)
  app.post("/api/admin/setup/:userId", async (req, res) => {
    const { userId } = req.params;
    const { setupKey } = req.body;
    
    // Use a setup key from environment for initial admin setup
    const validSetupKey = process.env.ADMIN_SETUP_KEY || 'sabiright-admin-setup-2024';
    
    if (setupKey !== validSetupKey) {
      return res.status(403).json({ error: 'Invalid setup key' });
    }
    
    const success = await storage.setUserAsAdmin(userId);
    if (success) {
      res.json({ success: true, message: 'User set as admin successfully' });
    } else {
      res.status(500).json({ error: 'Failed to set user as admin' });
    }
  });

  // Admin: Approve KYC
  app.post("/api/admin/kyc/:userId/approve", adminAuth, async (req, res) => {
    const { userId } = req.params;
    await storage.updateUserKYC(userId, 'verified');
    res.json({ success: true });
  });

  // Admin: Reject KYC
  app.post("/api/admin/kyc/:userId/reject", adminAuth, async (req, res) => {
    const { userId } = req.params;
    await storage.updateUserKYC(userId, 'rejected');
    res.json({ success: true });
  });

  // Admin: Assign plan to user
  app.post("/api/admin/users/:userId/plan", adminAuth, async (req, res) => {
    const { userId } = req.params;
    const { planId } = req.body;
    
    const plan = await storage.getPlanById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const existing = await storage.getUserPlan(userId);
    if (existing?.id) {
      await storage.updateSubscriptionStatus(existing.id, 'cancelled');
    }

    const subscription = await storage.createSubscription({
      userId,
      planId,
      status: 'active'
    });

    res.json({ success: true, subscription });
  });

  // Admin: Toggle user admin status
  app.post("/api/admin/users/:userId/toggle-admin", adminAuth, async (req, res) => {
    const { userId } = req.params;
    const { isAdmin } = req.body;
    
    const success = await storage.toggleUserAdmin(userId, isAdmin);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Admin: Delete user
  app.delete("/api/admin/users/:userId", adminAuth, async (req, res) => {
    const { userId } = req.params;
    
    const success = await storage.deleteUser(userId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // Admin: Get all plans
  app.get("/api/admin/plans", adminAuth, async (req, res) => {
    const plans = await storage.getAllPlans();
    res.json(plans);
  });

  // Admin: Create plan
  app.post("/api/admin/plans", adminAuth, async (req, res) => {
    const { name, type, userType, price, credits, features, description } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const plan = await storage.createPlan({
      name,
      type,
      userType: userType || 'user',
      price: price || 0,
      credits: credits || 10,
      features: features || [],
      description: description || ''
    });

    res.json(plan);
  });

  // Admin: Update plan
  app.put("/api/admin/plans/:planId", adminAuth, async (req, res) => {
    const { planId } = req.params;
    const updates = req.body;

    const plan = await storage.updatePlan(planId, updates);
    if (plan) {
      res.json(plan);
    } else {
      res.status(404).json({ error: 'Plan not found' });
    }
  });

  // Admin: Delete plan
  app.delete("/api/admin/plans/:planId", adminAuth, async (req, res) => {
    const { planId } = req.params;
    const success = await storage.deletePlan(planId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Plan not found' });
    }
  });

  // Credit Packages API
  app.get("/api/admin/credit-packages", adminAuth, async (req, res) => {
    const packages = await storage.getCreditPackages();
    res.json(packages);
  });

  app.post("/api/admin/credit-packages", adminAuth, async (req, res) => {
    const packageData = req.body;
    const newPackage = await storage.createCreditPackage(packageData);
    res.json(newPackage);
  });

  app.put("/api/admin/credit-packages/:packageId", adminAuth, async (req, res) => {
    const { packageId } = req.params;
    const updates = req.body;
    const updated = await storage.updateCreditPackage(packageId, updates);
    res.json(updated);
  });

  app.delete("/api/admin/credit-packages/:packageId", adminAuth, async (req, res) => {
    const { packageId } = req.params;
    const success = await storage.deleteCreditPackage(packageId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Package not found' });
    }
  });

  // Payment Methods API
  app.get("/api/admin/payment-methods", adminAuth, async (req, res) => {
    const methods = await storage.getPaymentMethods();
    res.json(methods);
  });

  app.post("/api/admin/payment-methods", adminAuth, async (req, res) => {
    const methodData = req.body;
    const newMethod = await storage.createPaymentMethod(methodData);
    res.json(newMethod);
  });

  app.put("/api/admin/payment-methods/:methodId", adminAuth, async (req, res) => {
    const { methodId } = req.params;
    const updates = req.body;
    const updated = await storage.updatePaymentMethod(methodId, updates);
    res.json(updated);
  });

  app.delete("/api/admin/payment-methods/:methodId", adminAuth, async (req, res) => {
    const { methodId } = req.params;
    const success = await storage.deletePaymentMethod(methodId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Payment method not found' });
    }
  });

  // Public endpoint for active payment methods (no auth required)
  app.get("/api/payment-methods", async (req, res) => {
    const methods = await storage.getActivePaymentMethods();
    res.json(methods);
  });

  // Public endpoint for credit packages (no auth required)
  app.get("/api/credit-packages", async (req, res) => {
    const packages = await storage.getCreditPackages();
    res.json(packages);
  });

  // Jobs APIs API
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getJobs(50);
      res.json(jobs);
    } catch (err) {
      res.json([]);
    }
  });

  app.post("/api/jobs", async (req, res) => {
    const { title, company, location, type, workMode, salary, description, contact, postedBy, source, isAiFetched } = req.body;
    
    if (!title || !location) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const job = await storage.createJob({
      title,
      company: company || 'Confidential',
      location,
      type: type || 'Full-time',
      workMode: workMode || 'Onsite',
      salary: salary || '',
      description: description || '',
      contact: contact || '',
      postedBy: postedBy || 'anonymous',
      source: source || 'User Posted',
      isAiFetched: isAiFetched || false
    });

    res.json(job);
  });

  // Save Job
  app.post("/api/jobs/:jobId/save", async (req, res) => {
    const { jobId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    await storage.saveJob(userId, jobId);
    res.json({ success: true });
  });

  // Unsave Job
  app.delete("/api/jobs/:jobId/save", async (req, res) => {
    const { jobId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    await storage.unsaveJob(userId, jobId);
    res.json({ success: true });
  });

  // Get Saved Jobs
  app.get("/api/jobs/saved/:userId", async (req, res) => {
    const { userId } = req.params;
    const jobs = await storage.getSavedJobs(userId);
    res.json(jobs);
  });

  // Get Saved Job IDs (for quick lookup)
  app.get("/api/jobs/saved-ids/:userId", async (req, res) => {
    const { userId } = req.params;
    const jobIds = await storage.getSavedJobIds(userId);
    res.json(jobIds);
  });

  // Apply to Job
  app.post("/api/jobs/:jobId/apply", async (req, res) => {
    const { jobId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const application = await storage.applyToJob(userId, jobId);
    res.json(application);
  });

  // Get Applied Jobs
  app.get("/api/jobs/applied/:userId", async (req, res) => {
    const { userId } = req.params;
    const jobs = await storage.getAppliedJobs(userId);
    res.json(jobs);
  });

  // Get Applied Job IDs (for quick lookup)
  app.get("/api/jobs/applied-ids/:userId", async (req, res) => {
    const { userId } = req.params;
    const jobIds = await storage.getAppliedJobIds(userId);
    res.json(jobIds);
  });

  // Update Application Status
  app.patch("/api/jobs/:jobId/application-status", async (req, res) => {
    const { jobId } = req.params;
    const { userId, status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ error: 'User ID and status required' });
    }

    const validStatuses = ['applied', 'reviewing', 'interviewing', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await storage.updateApplicationStatus(userId, jobId, status);
    res.json({ success: true, status });
  });

  // Get AI Generated Jobs for User
  app.get("/api/jobs/generated/:userId", async (req, res) => {
    const { userId } = req.params;
    const jobs = await storage.getGeneratedJobs(userId);
    res.json(jobs);
  });

  // AI Generation API
  app.post("/api/ai/generate", async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    const apiKeySetting = await storage.getAdminSetting('gemini_api_key');
    const apiKey = apiKeySetting?.value || process.env.GEMINI_API_KEY;
    
    console.log('[AI Generate] API key found:', !!apiKey, 'from setting:', !!apiKeySetting?.value);
    
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service not configured. Please set up Gemini API key in admin settings.' });
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[AI Generate] Gemini error:', response.status, errorBody);
        return res.status(response.status).json({ error: 'AI service error', details: errorBody });
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      res.json({ response: text });
    } catch (err) {
      console.error('AI generation error:', err);
      res.status(500).json({ error: 'AI generation failed' });
    }
  });

  // AI Job Search API
  app.post("/api/ai/jobs/search", async (req, res) => {
    const { userId, role, location, employmentType, workMode } = req.body;
    
    if (!userId || !role) {
      return res.status(400).json({ error: 'User ID and role required' });
    }

    const credits = await storage.getUserCredits(userId);
    if (!credits || ((credits.totalCredits || 0) - (credits.usedCredits || 0)) < 1) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    const apiKeySetting = await storage.getAdminSetting('gemini_api_key');
    const apiKey = apiKeySetting?.value || process.env.GEMINI_API_KEY;
    
    console.log('[AI Jobs] API key found:', !!apiKey, 'from setting:', !!apiKeySetting?.value);
    
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const aiPrompt = `
      Act as a Job Search API for Nigeria.
      Criteria: Role: ${role}, Location: ${location || 'Lagos'}${employmentType ? `, Employment: ${employmentType}` : ''}${workMode ? `, Work Mode: ${workMode}` : ''}.
      
      Task: List 3 highly realistic job opportunities matching these criteria.
      
      CRITICAL INSTRUCTIONS:
      1. The 'description' must be comprehensive (at least 100 words). Format using Markdown.
      2. The 'contact' field must be a URL or email.
      3. The 'source' field must be the name of an external job platform (e.g., LinkedIn).
      4. The 'type' must be either "Full-time" or "Part-time".
      5. The 'workMode' must be either "Remote", "Onsite", or "Hybrid".
      
      Output: Return ONLY a JSON Array of objects. No markdown blocks.
      Schema: [{"title": "...", "company": "...", "location": "...", "type": "Full-time", "workMode": "Remote", "salary": "...", "contact": "...", "description": "...", "source": "..."}]
    `;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiPrompt }] }]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[AI Jobs] Gemini error:', response.status, errorBody);
        return res.status(response.status).json({ error: 'AI service error', details: errorBody });
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      console.log('[AI Jobs] Response received, length:', text.length);
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[AI Jobs] Failed to parse JSON from response:', text.substring(0, 200));
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      const jobs = JSON.parse(jsonMatch[0]);
      const savedJobs = [];

      for (const job of jobs) {
        const savedJob = await storage.createJob({
          ...job,
          postedBy: userId,
          source: job.source || 'AI Generated',
          isAiFetched: true
        });
        savedJobs.push(savedJob);
      }

      await storage.deductCredits(userId, 1, 'job_search', `AI job search: ${role} in ${location}`);

      res.json({ jobs: savedJobs, creditsUsed: 1 });
    } catch (err) {
      console.error('[AI Jobs] Error:', err);
      res.status(500).json({ error: 'Job search failed' });
    }
  });

  // Vendor Analytics API
  app.get("/api/vendor/:vendorId/stats", async (req, res) => {
    const { vendorId } = req.params;
    const stats = await storage.getVendorStats(vendorId);
    res.json(stats);
  });

  app.get("/api/vendor/:vendorId/leads", async (req, res) => {
    const { vendorId } = req.params;
    const leads = await storage.getVendorLeads(vendorId);
    res.json(leads);
  });

  app.get("/api/vendor/:vendorId/bookings", async (req, res) => {
    const { vendorId } = req.params;
    const bookings = await storage.getVendorBookings(vendorId);
    res.json(bookings);
  });

  app.post("/api/vendor/leads", async (req, res) => {
    const { vendorId, customerId, customerName, customerPhone, customerEmail, serviceType, message } = req.body;
    
    if (!vendorId || !customerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const lead = await storage.createVendorLead({
      vendorId,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      serviceType,
      message
    });

    res.json(lead);
  });

  app.post("/api/vendor/bookings", async (req, res) => {
    const { vendorId, customerId, customerName, serviceType, scheduledDate, scheduledTime, amount, notes } = req.body;
    
    if (!vendorId || !customerName || !scheduledDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const booking = await storage.createVendorBooking({
      vendorId,
      customerId,
      customerName,
      serviceType,
      scheduledDate,
      scheduledTime,
      amount: parseFloat(amount) || 0,
      notes
    });

    res.json(booking);
  });

  app.patch("/api/vendor/bookings/:bookingId", async (req, res) => {
    const { bookingId } = req.params;
    await storage.updateVendorBooking(bookingId, req.body);
    res.json({ success: true });
  });

  // Payments
  app.get("/api/payments", async (req, res) => {
    const { userId } = req.query;
    const payments = await storage.getPayments(userId as string | undefined);
    res.json(payments);
  });

  app.post("/api/payments/initiate", async (req, res) => {
    try {
      const { userId, amount, currency, provider, type, description, metadata, email } = req.body;
      
      if (!userId || !amount || !provider || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create payment record
      const payment = await storage.createPayment({
        userId, amount, currency: currency || 'NGN', provider, type, description, metadata
      });

      // Payment initiation logic per provider
      let redirectUrl = '';
      let authorizationUrl = '';
      let accessCode = '';
      
      if (provider === 'paystack') {
        // Get Paystack settings
        const paystackPublicKey = await storage.getAdminSetting('paystack_public_key');
        const paystackSecretKey = await storage.getAdminSetting('paystack_secret_key');
        
        if (!paystackSecretKey?.value || !paystackPublicKey?.value) {
          return res.status(503).json({ error: 'Paystack not configured. Please set up API keys in admin settings.' });
        }

        // Initialize Paystack service
        const paystack = new PaystackService({
          secretKey: paystackSecretKey.value,
          publicKey: paystackPublicKey.value
        });

        // Initialize payment with Paystack
        const paystackResponse = await paystack.initializePayment({
          email: email || `user-${userId}@sabiright.com`,
          amount: Math.round(amount * 100), // Convert to kobo
          reference: payment.metadata?.reference || `PAY-${payment.id}`,
          currency: currency || 'NGN',
          callback_url: `${process.env.APP_URL || 'http://localhost:5000'}/api/payments/paystack/callback`,
          metadata: {
            paymentId: payment.id,
            userId,
            type,
            ...metadata
          }
        });

        if (paystackResponse.status) {
          authorizationUrl = paystackResponse.data.authorization_url;
          accessCode = paystackResponse.data.access_code;
          redirectUrl = authorizationUrl;
          
          // Update payment with Paystack reference
          await storage.updatePayment(payment.id, {
            providerRef: paystackResponse.data.reference,
            metadata: {
              ...payment.metadata,
              access_code: accessCode
            }
          });
        } else {
          return res.status(500).json({ error: 'Failed to initialize Paystack payment' });
        }
      } else if (provider === 'stripe') {
        redirectUrl = `/payment/stripe?paymentId=${payment.id}`;
      } else if (provider === 'flutterwave') {
        redirectUrl = `/payment/flutterwave?paymentId=${payment.id}`;
      }

      res.json({ 
        ...payment, 
        redirectUrl,
        authorizationUrl,
        accessCode
      });
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate payment' });
    }
  });

  app.post("/api/payments/:paymentId/confirm", async (req, res) => {
    const { paymentId } = req.params;
    const { status, providerRef } = req.body;

    await storage.updatePaymentStatus(paymentId, status, providerRef);
    res.json({ success: true });
  });

  // Paystack callback (user returns from payment)
  app.get("/api/payments/paystack/callback", async (req, res) => {
    try {
      const { reference, trxref } = req.query;
      const paymentReference = reference || trxref;

      if (!paymentReference) {
        return res.redirect(`/app/wallet?payment=failed&error=no_reference`);
      }

      // Get Paystack settings
      const paystackPublicKey = await storage.getAdminSetting('paystack_public_key');
      const paystackSecretKey = await storage.getAdminSetting('paystack_secret_key');
      
      if (!paystackSecretKey?.value || !paystackPublicKey?.value) {
        return res.redirect(`/app/wallet?payment=failed&error=not_configured`);
      }

      // Initialize Paystack service
      const paystack = new PaystackService({
        secretKey: paystackSecretKey.value,
        publicKey: paystackPublicKey.value
      });

      // Verify payment
      const verification = await paystack.verifyPayment(paymentReference as string);

      if (verification.status && verification.data.status === 'success') {
        const { paymentId, userId, type, credits, planId } = verification.data.metadata;

        // Update payment status
        await storage.updatePayment(paymentId, {
          status: 'completed',
          providerRef: verification.data.reference
        });

        // Process based on type
        const amount = verification.data.amount / 100; // Convert from kobo
        
        if (type === 'wallet_topup') {
          await storage.topUpWallet(userId, amount, verification.data.reference, 'Paystack payment');
        } else if (type === 'credit_purchase' && credits) {
          const currentCredits = await storage.getUserCredits(userId);
          await storage.setUserCredits(userId, currentCredits + parseInt(credits));
        } else if (type === 'subscription' && planId) {
          await storage.createSubscription(userId, planId);
        }

        return res.redirect(`/app/wallet?payment=success&reference=${paymentReference}`);
      } else {
        return res.redirect(`/app/wallet?payment=failed&reference=${paymentReference}`);
      }
    } catch (error: any) {
      console.error('Paystack callback error:', error);
      return res.redirect(`/app/wallet?payment=failed&error=${encodeURIComponent(error.message)}`);
    }
  });

  // Paystack webhook (Paystack notifies us of payment status)
  app.post("/api/payments/paystack/webhook", async (req, res) => {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      
      if (!signature) {
        return res.status(400).json({ error: 'No signature provided' });
      }

      // Get Paystack settings
      const paystackSecretKey = await storage.getAdminSetting('paystack_secret_key');
      
      if (!paystackSecretKey?.value) {
        return res.status(503).json({ error: 'Paystack not configured' });
      }

      // Initialize Paystack service
      const paystack = new PaystackService({
        secretKey: paystackSecretKey.value,
        publicKey: '' // Not needed for webhook verification
      });

      // Verify webhook signature
      const payload = JSON.stringify(req.body);
      const isValid = paystack.verifyWebhookSignature(payload, signature);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = req.body;

      // Handle different event types
      if (event.event === 'charge.success') {
        const { reference, status, amount, metadata } = event.data;
        const { paymentId, userId, type, credits, planId } = metadata;

        if (status === 'success') {
          // Update payment status
          await storage.updatePayment(paymentId, {
            status: 'completed',
            providerRef: reference
          });

          // Process based on type
          const amountInNaira = amount / 100; // Convert from kobo
          
          if (type === 'wallet_topup') {
            await storage.topUpWallet(userId, amountInNaira, reference, 'Paystack payment');
          } else if (type === 'credit_purchase' && credits) {
            const currentCredits = await storage.getUserCredits(userId);
            await storage.setUserCredits(userId, currentCredits + parseInt(credits));
          } else if (type === 'subscription' && planId) {
            await storage.createSubscription(userId, planId);
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Paystack webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify Paystack payment (manual verification from frontend)
  app.post("/api/payments/paystack/verify", async (req, res) => {
    try {
      const { reference } = req.body;

      if (!reference) {
        return res.status(400).json({ error: 'Reference required' });
      }

      // Get Paystack settings
      const paystackPublicKey = await storage.getAdminSetting('paystack_public_key');
      const paystackSecretKey = await storage.getAdminSetting('paystack_secret_key');
      
      if (!paystackSecretKey?.value || !paystackPublicKey?.value) {
        return res.status(503).json({ error: 'Paystack not configured' });
      }

      // Initialize Paystack service
      const paystack = new PaystackService({
        secretKey: paystackSecretKey.value,
        publicKey: paystackPublicKey.value
      });

      // Verify payment
      const verification = await paystack.verifyPayment(reference);

      res.json(verification);
    } catch (error: any) {
      console.error('Paystack verification error:', error);
      res.status(500).json({ error: error.message || 'Verification failed' });
    }
  });

  // Flutterwave webhook
  app.post("/api/payments/flutterwave/webhook", async (req, res) => {
    try {
      const secretHash = req.headers['verif-hash'] as string;
      
      // Get Flutterwave payment methods
      const paymentMethods = await storage.getPaymentMethods();
      const flutterwaveMethod = paymentMethods.find((m: any) => m.type === 'flutterwave' && m.active);
      
      if (!flutterwaveMethod?.secretKey) {
        return res.status(503).json({ error: 'Flutterwave not configured' });
      }

      // Verify webhook signature
      if (secretHash !== flutterwaveMethod.secretKey) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = req.body;

      // Handle successful payment
      if (event.event === 'charge.completed' && event.data.status === 'successful') {
        const { tx_ref, amount, customer, meta } = event.data;
        const { userId, type, credits, planId } = meta || {};

        if (userId) {
          // Find payment by reference
          const payments = await storage.getPayments();
          const payment = payments.find((p: any) => p.metadata?.reference === tx_ref);

          if (payment) {
            // Update payment status
            await storage.updatePayment(payment.id, {
              status: 'completed',
              providerRef: tx_ref
            });

            // Process based on type
            if (type === 'wallet_topup') {
              await storage.topUpWallet(userId, amount, tx_ref, 'Flutterwave payment');
            } else if (type === 'credit_purchase' && credits) {
              const currentCredits = await storage.getUserCredits(userId);
              await storage.setUserCredits(userId, currentCredits + parseInt(credits));
            } else if (type === 'subscription' && planId) {
              await storage.createSubscription(userId, planId);
            }
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Flutterwave webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify Flutterwave payment (manual verification from frontend)
  app.post("/api/payments/flutterwave/verify", userAuth, async (req, res) => {
    try {
      const { transaction_id, tx_ref } = req.body;

      if (!transaction_id && !tx_ref) {
        return res.status(400).json({ error: 'Transaction ID or reference required' });
      }

      // Get Flutterwave payment method
      const paymentMethods = await storage.getPaymentMethods();
      const flutterwaveMethod = paymentMethods.find((m: any) => m.type === 'flutterwave' && m.active);
      
      if (!flutterwaveMethod?.secretKey) {
        return res.status(503).json({ error: 'Flutterwave not configured' });
      }

      // Verify payment with Flutterwave API
      const response = await fetch(
        `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${flutterwaveMethod.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.status === 'success' && data.data.status === 'successful') {
        const { tx_ref, amount, customer, meta } = data.data;
        const { userId, type, credits, planId } = meta || {};

        if (userId) {
          // Find payment by reference
          const payments = await storage.getPayments();
          const payment = payments.find((p: any) => p.metadata?.reference === tx_ref);

          if (payment && payment.status !== 'completed') {
            // Update payment status
            await storage.updatePayment(payment.id, {
              status: 'completed',
              providerRef: tx_ref
            });

            // Process based on type
            if (type === 'wallet_topup') {
              await storage.topUpWallet(userId, amount, tx_ref, 'Flutterwave payment');
            } else if (type === 'credit_purchase' && credits) {
              const currentCredits = await storage.getUserCredits(userId);
              await storage.setUserCredits(userId, currentCredits + parseInt(credits));
            } else if (type === 'subscription' && planId) {
              await storage.createSubscription(userId, planId);
            }
          }
        }

        return res.json({ status: 'success', data: data.data });
      }

      res.json({ status: 'failed', message: 'Payment verification failed' });
    } catch (error: any) {
      console.error('Flutterwave verification error:', error);
      res.status(500).json({ error: error.message || 'Verification failed' });
    }
  });

  // Pay with wallet balance
  app.post("/api/payments/wallet-payment", userAuth, async (req, res) => {
    try {
      const { userId, amount, type, planId, credits } = req.body;
      
      if (!userId || !amount || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get wallet and check balance
      const wallet = await storage.getWallet(userId);
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const balance = parseFloat(wallet.balance);
      if (balance < amount) {
        return res.status(400).json({ error: 'Insufficient wallet balance' });
      }

      // Deduct from wallet
      await storage.deductFromWallet(
        userId,
        amount,
        type,
        `WALLET-PAY-${Date.now()}`,
        `Payment for ${type.replace('_', ' ')}`
      );

      // Process based on type
      if (type === 'credit_purchase' && credits) {
        // Add credits to user
        const currentCredits = await storage.getUserCredits(userId);
        await storage.setUserCredits(userId, currentCredits + credits);
      } else if (type === 'subscription' && planId) {
        // Activate subscription
        await storage.createSubscription(userId, planId);
      }

      res.json({ 
        success: true,
        message: 'Payment successful',
        newBalance: (balance - amount).toFixed(2)
      });
    } catch (error: any) {
      console.error('Wallet payment error:', error);
      res.status(500).json({ error: error.message || 'Payment failed' });
    }
  });

  // Admin: Approve manual payment
  app.post("/api/admin/payments/:paymentId/approve", adminAuth, async (req, res) => {
    try {
      const { paymentId } = req.params;
      
      // Get payment details
      const payment = await storage.getPaymentById(paymentId);
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      
      if (payment.status !== 'pending') {
        return res.status(400).json({ error: 'Payment is not pending' });
      }
      
      // Update payment status to completed
      await storage.updatePaymentStatus(paymentId, 'completed');
      
      // Credit user based on payment type
      if (payment.type === 'wallet_topup') {
        await storage.topUpWallet(
          payment.userId, 
          payment.amount, 
          payment.providerRef || paymentId,
          `Wallet top-up - ${payment.description || 'Manual approval'}`
        );
        
        // Send notification
        await storage.createNotification({
          userId: payment.userId,
          type: 'payment_approved',
          title: 'Payment Approved',
          message: `Your wallet top-up of ${payment.currency || 'NGN'} ${payment.amount.toLocaleString()} has been approved and credited to your wallet.`,
          data: { paymentId, amount: payment.amount, type: payment.type }
        });
      } else if (payment.type === 'credit_purchase' && payment.metadata?.credits) {
        const userCredits = await storage.getUserCredits(payment.userId);
        const currentTotal = userCredits?.totalCredits || 0;
        await storage.setUserCredits(payment.userId, currentTotal + payment.metadata.credits);
        
        // Send notification
        await storage.createNotification({
          userId: payment.userId,
          type: 'credits_added',
          title: 'Credits Added',
          message: `${payment.metadata.credits} credits have been added to your account. Your payment of ${payment.currency || 'NGN'} ${payment.amount.toLocaleString()} has been approved.`,
          data: { paymentId, credits: payment.metadata.credits, amount: payment.amount }
        });
      }
      
      res.json({ success: true, message: 'Payment approved and credited' });
    } catch (error) {
      console.error('Error approving payment:', error);
      res.status(500).json({ error: 'Failed to approve payment' });
    }
  });

  // Admin: Reject manual payment
  app.post("/api/admin/payments/:paymentId/reject", adminAuth, async (req, res) => {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      
      // Get payment details
      const payment = await storage.getPaymentById(paymentId);
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      
      if (payment.status !== 'pending') {
        return res.status(400).json({ error: 'Payment is not pending' });
      }
      
      // Update payment status to failed
      await storage.updatePaymentStatus(paymentId, 'failed');
      
      // Store rejection reason
      if (reason) {
        await storage.updatePayment(paymentId, { rejectionReason: reason });
      }
      
      // Send notification
      await storage.createNotification({
        userId: payment.userId,
        type: 'payment_rejected',
        title: 'Payment Rejected',
        message: `Your payment of ${payment.currency || 'NGN'} ${payment.amount.toLocaleString()} has been rejected. ${reason ? `Reason: ${reason}` : 'Please contact support for more information.'}`,
        data: { paymentId, amount: payment.amount, reason }
      });
      
      res.json({ success: true, message: 'Payment rejected' });
    } catch (error) {
      console.error('Error rejecting payment:', error);
      res.status(500).json({ error: 'Failed to reject payment' });
    }
  });

  // Flagged Posts Management
  app.get("/api/admin/flagged-posts", adminAuth, async (req, res) => {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || 'legal-13d13';
      
      const postsRef = db.collection('artifacts').doc(FIREBASE_APP_ID)
        .collection('public').doc('data').collection('forum_posts');
      
      const snapshot = await postsRef.where('shadowedForReview', '==', true).get();
      const flaggedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      res.json(flaggedPosts);
    } catch (error) {
      console.error('Error fetching flagged posts:', error);
      res.status(500).json({ error: 'Failed to fetch flagged posts' });
    }
  });

  app.post("/api/admin/flagged-posts/:postId/reinstate", adminAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const admin = require('firebase-admin');
      const db = admin.firestore();
      const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || 'legal-13d13';
      
      const postRef = db.collection('artifacts').doc(FIREBASE_APP_ID)
        .collection('public').doc('data').collection('forum_posts').doc(postId);
      
      await postRef.update({
        shadowedForReview: false,
        flagged: false,
        flagCount: 0,
        flaggedBy: [],
        reinstatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reinstatedBy: (req as any).userId
      });
      
      res.json({ success: true, message: 'Post reinstated successfully' });
    } catch (error) {
      console.error('Error reinstating post:', error);
      res.status(500).json({ error: 'Failed to reinstate post' });
    }
  });

  app.delete("/api/admin/flagged-posts/:postId", adminAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const admin = require('firebase-admin');
      const db = admin.firestore();
      const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || 'legal-13d13';
      
      const postRef = db.collection('artifacts').doc(FIREBASE_APP_ID)
        .collection('public').doc('data').collection('forum_posts').doc(postId);
      
      await postRef.delete();
      
      res.json({ success: true, message: 'Post deleted permanently' });
    } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).json({ error: 'Failed to delete post' });
    }
  });

  // Subscriptions
  app.get("/api/subscription/:userId", async (req, res) => {
    const { userId } = req.params;
    const subscription = await storage.getUserPlan(userId);
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription' });
    }
    res.json(subscription);
  });

  app.post("/api/subscription/upgrade", async (req, res) => {
    const { userId, planId } = req.body;
    
    if (!userId || !planId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const plan = await storage.getPlanById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Cancel existing subscription if any
    const existing = await storage.getUserPlan(userId);
    if (existing?.id) {
      await storage.updateSubscriptionStatus(existing.id, 'cancelled');
    }

    const subscription = await storage.createSubscription({
      userId,
      planId,
      status: 'active'
    });

    res.json({
      success: true,
      subscription,
      message: `Upgraded to ${plan.name} plan`
    });
  });

  // ===== Coupons API (Admin) =====
  
  app.get("/api/admin/coupons", adminAuth, async (req, res) => {
    const coupons = await storage.getAllCoupons();
    res.json(coupons);
  });

  app.post("/api/admin/coupons", adminAuth, async (req, res) => {
    const { code, discountType, discountValue, maxRedemptions, validFrom, validTo, isActive } = req.body;
    
    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ error: 'Code, discountType, and discountValue are required' });
    }
    
    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ error: 'discountType must be "percentage" or "fixed"' });
    }

    const existing = await storage.getCouponByCode(code);
    if (existing) {
      return res.status(409).json({ error: 'Coupon code already exists' });
    }

    const coupon = await storage.createCoupon({
      code,
      discountType,
      discountValue: discountValue.toString(),
      maxRedemptions: maxRedemptions || null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      isActive: isActive !== false
    });

    res.json(coupon);
  });

  app.patch("/api/admin/coupons/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    if (updates.discountValue !== undefined) {
      updates.discountValue = updates.discountValue.toString();
    }
    if (updates.validFrom) {
      updates.validFrom = new Date(updates.validFrom);
    }
    if (updates.validTo) {
      updates.validTo = new Date(updates.validTo);
    }

    const coupon = await storage.updateCoupon(id, updates);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json(coupon);
  });

  app.delete("/api/admin/coupons/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    const success = await storage.deleteCoupon(id);
    if (!success) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json({ success: true });
  });

  app.post("/api/coupons/validate", async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const result = await storage.validateCoupon(code);
    
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.error });
    }

    res.json({
      valid: true,
      coupon: {
        id: result.coupon!.id,
        code: result.coupon!.code,
        discountType: result.coupon!.discountType,
        discountValue: result.coupon!.discountValue
      }
    });
  });

  // ===== Wallet API =====
  
  app.get("/api/wallet/:userId", userAuth, async (req, res) => {
    const { userId } = req.params;
    const wallet = await storage.getWallet(userId);
    
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    res.json(wallet);
  });

  app.post("/api/wallet/:userId/create", userAuth, async (req, res) => {
    const { userId } = req.params;
    const { currency } = req.body;
    
    const wallet = await storage.createWallet(userId, currency || 'NGN');
    res.json(wallet);
  });

  app.post("/api/wallet/:userId/topup", userAuth, async (req, res) => {
    const { userId } = req.params;
    const { amount, reference, description } = req.body;
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    let wallet = await storage.getWallet(userId);
    if (!wallet) {
      wallet = await storage.createWallet(userId);
    }

    try {
      const transaction = await storage.topUpWallet(
        userId,
        parseFloat(amount),
        reference,
        description
      );
      
      const updatedWallet = await storage.getWallet(userId);
      res.json({
        success: true,
        transaction,
        wallet: updatedWallet
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/wallet/:userId/transactions", userAuth, async (req, res) => {
    const { userId } = req.params;
    const { limit } = req.query;
    
    const transactions = await storage.getWalletTransactions(
      userId,
      limit ? parseInt(limit as string) : 50
    );
    
    res.json(transactions);
  });

  // ===== Booking System API =====

  // Create a booking (user books vendor service)
  app.post("/api/bookings", async (req, res) => {
    const { serviceId, userId, vendorId, totalAmount, description, scheduledDate, milestones } = req.body;
    
    if (!serviceId || !userId || !vendorId || !totalAmount) {
      return res.status(400).json({ error: 'Missing required fields: serviceId, userId, vendorId, totalAmount' });
    }

    const booking = await storage.createBooking({
      serviceId,
      userId,
      vendorId,
      totalAmount: totalAmount.toString(),
      description,
      scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null
    });

    if (milestones && Array.isArray(milestones)) {
      let order = 1;
      for (const milestone of milestones) {
        const amount = (parseFloat(totalAmount) * (milestone.amountPercent / 100)).toFixed(2);
        await storage.createMilestone({
          bookingId: booking.id,
          title: milestone.title,
          description: milestone.description,
          amountPercent: milestone.amountPercent,
          amount,
          order: order++,
          dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString() : null
        });
      }
    }

    await storage.createEscrowAccount({
      bookingId: booking.id,
      totalAmount: totalAmount.toString()
    });

    res.json(booking);
  });

  // Get user's bookings
  app.get("/api/bookings/user/:userId", async (req, res) => {
    const { userId } = req.params;
    const bookings = await storage.getBookingsByUserId(userId);
    res.json(bookings);
  });

  // Get vendor's bookings
  app.get("/api/bookings/vendor/:vendorId", async (req, res) => {
    const { vendorId } = req.params;
    const bookings = await storage.getBookingsByVendorId(vendorId);
    res.json(bookings);
  });

  // Get booking details with milestones, escrow, contract
  app.get("/api/bookings/:id", async (req, res) => {
    const { id } = req.params;
    const details = await storage.getBookingDetails(id);
    
    if (!details.booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json(details);
  });

  // Update booking status (vendor confirms, completes)
  app.patch("/api/bookings/:id/status", bookingParticipantAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['requested', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
    }

    await storage.updateBookingStatus(id, status);
    const updated = await storage.getBookingById(id);
    res.json(updated);
  });

  // ===== Escrow Management =====

  // Fund escrow (deduct from user wallet)
  app.post("/api/bookings/:id/escrow/fund", bookingParticipantAuth, async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    const userId = (req as any).userId;
    const booking = (req as any).booking;
    
    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    if (booking.userId !== userId) {
      return res.status(403).json({ error: 'Only the booking user can fund the escrow' });
    }

    const escrow = await storage.fundEscrow(id, parseFloat(amount), userId);
    if (!escrow) {
      return res.status(400).json({ error: 'Failed to fund escrow. Check wallet balance.' });
    }

    res.json(escrow);
  });

  // Mark milestone as completed (vendor marks completion)
  app.post("/api/bookings/:id/milestones/:milestoneId/complete", bookingParticipantAuth, async (req, res) => {
    const { id, milestoneId } = req.params;
    const userId = (req as any).userId;
    const booking = (req as any).booking;

    if (booking.vendorId !== userId) {
      return res.status(403).json({ error: 'Only the vendor can mark milestones as completed' });
    }

    const milestone = await storage.getMilestoneById(milestoneId);
    if (!milestone || milestone.bookingId !== id) {
      return res.status(404).json({ error: 'Milestone not found for this booking' });
    }

    await storage.updateMilestoneStatus(milestoneId, 'completed');
    const updated = await storage.getMilestoneById(milestoneId);
    res.json(updated);
  });

  // Release milestone funds to vendor
  app.post("/api/bookings/:id/milestones/:milestoneId/release", bookingParticipantAuth, async (req, res) => {
    const { id, milestoneId } = req.params;
    const userId = (req as any).userId;
    const booking = (req as any).booking;
    
    if (booking.userId !== userId) {
      return res.status(403).json({ error: 'Only the booking user can release milestone funds' });
    }

    const escrow = await storage.getEscrowByBookingId(id);
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow account not found' });
    }

    const milestone = await storage.getMilestoneById(milestoneId);
    if (!milestone || milestone.bookingId !== id) {
      return res.status(404).json({ error: 'Milestone not found for this booking' });
    }

    if (milestone.status === 'released') {
      return res.status(400).json({ error: 'Milestone funds already released' });
    }

    const milestoneAmount = parseFloat(milestone.amount || '0');
    const fundedAmount = parseFloat(escrow.fundedAmount || '0');
    const releasedAmount = parseFloat(escrow.releasedAmount || '0');
    const availableInEscrow = fundedAmount - releasedAmount;

    if (milestoneAmount > availableInEscrow) {
      return res.status(400).json({ 
        error: 'Insufficient escrow balance', 
        required: milestoneAmount,
        available: availableInEscrow
      });
    }

    const event = await storage.releaseEscrowMilestone(
      escrow.id,
      milestoneId,
      booking.vendorId,
      userId
    );

    if (!event) {
      return res.status(400).json({ error: 'Failed to release milestone funds' });
    }

    const updatedMilestone = await storage.getMilestoneById(milestoneId);
    res.json({ milestone: updatedMilestone, event });
  });

  // ===== Contracts =====

  // Create contract with terms
  app.post("/api/bookings/:id/contract", bookingParticipantAuth, async (req, res) => {
    const { id } = req.params;
    const { title, terms } = req.body;
    
    if (!title || !terms) {
      return res.status(400).json({ error: 'title and terms are required' });
    }

    const existing = await storage.getContractByBookingId(id);
    if (existing) {
      return res.status(409).json({ error: 'Contract already exists for this booking' });
    }

    const contract = await storage.createContract({
      bookingId: id,
      title,
      terms
    });

    res.json(contract);
  });

  // Sign contract (user or vendor)
  app.post("/api/bookings/:id/contract/sign", bookingParticipantAuth, async (req, res) => {
    const { id } = req.params;
    const { signerType } = req.body;
    const userId = (req as any).userId;
    const booking = (req as any).booking;
    
    if (!signerType || !['user', 'vendor'].includes(signerType)) {
      return res.status(400).json({ error: 'signerType must be "user" or "vendor"' });
    }

    if (signerType === 'user' && userId !== booking.userId) {
      return res.status(403).json({ error: 'Only the booking user can sign as user' });
    }
    if (signerType === 'vendor' && userId !== booking.vendorId) {
      return res.status(403).json({ error: 'Only the vendor can sign as vendor' });
    }

    const contract = await storage.signContract(id, signerType);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found for this booking' });
    }

    res.json(contract);
  });

  // ===== Chat / Messages =====

  // Get booking chat messages
  app.get("/api/bookings/:id/messages", bookingParticipantAuth, async (req, res) => {
    const { id } = req.params;
    const { limit } = req.query;

    const messages = await storage.getBookingMessages(
      id,
      limit ? parseInt(limit as string) : 100
    );
    
    res.json(messages);
  });

  // Send message
  app.post("/api/bookings/:id/messages", bookingParticipantAuth, async (req, res) => {
    const { id } = req.params;
    const { message, attachments } = req.body;
    const senderId = (req as any).userId;
    
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const newMessage = await storage.createBookingMessage({
      bookingId: id,
      senderId,
      message,
      attachments: attachments || [],
      isAdminMessage: false
    });

    res.json(newMessage);
  });

  // ===== Disputes =====

  // Open dispute
  app.post("/api/bookings/:id/dispute", bookingParticipantAuth, async (req, res) => {
    const { id } = req.params;
    const { reason, description, evidence } = req.body;
    const openedBy = (req as any).userId;
    
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const existing = await storage.getDisputeByBookingId(id);
    if (existing && existing.status !== 'resolved' && existing.status !== 'closed') {
      return res.status(409).json({ error: 'Active dispute already exists for this booking' });
    }

    const dispute = await storage.createDispute({
      bookingId: id,
      openedBy,
      reason,
      description: description || '',
      evidence: evidence || []
    });

    res.json(dispute);
  });

  // Admin: List all disputes
  app.get("/api/admin/disputes", adminAuth, async (req, res) => {
    const disputes = await storage.getAllDisputes();
    res.json(disputes);
  });

  // Admin: Resolve dispute
  app.patch("/api/admin/disputes/:id/resolve", adminAuth, async (req, res) => {
    const { id } = req.params;
    const { resolution, resolutionNotes } = req.body;
    
    const validResolutions = ['user_favor', 'vendor_favor', 'split', 'cancelled'];
    if (!resolution || !validResolutions.includes(resolution)) {
      return res.status(400).json({ error: `Invalid resolution. Valid values: ${validResolutions.join(', ')}` });
    }

    const adminId = (req as any).userId;
    const dispute = await storage.resolveDispute(id, resolution, resolutionNotes || '', adminId);
    
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    res.json(dispute);
  });

  // ===== SabiGuard, SabiMove, SabiWork Service Endpoints =====

  // ===== SabiGuard, SabiMove, SabiWork Service Endpoints =====
  // These endpoints integrate with the credit system
  
  // SabiGuard - AI Legal Assistant
  app.post("/api/sabiguard/query", userAuth, async (req, res) => {
    try {
      const { userId, query } = req.body;
  
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }
  
      // Check and deduct credits
      const userCredits = await storage.getUserCredits(userId);
      const sabiguardCost = 5; // 5 credits per query
  
      if (!userCredits || userCredits.balance < sabiguardCost) {
        return res.status(400).json({ 
          error: "Insufficient credits", 
          required: sabiguardCost,
          available: userCredits?.balance || 0
        });
      }
  
      // Deduct credits
      await storage.deductCredits(userId, sabiguardCost, "SabiGuard query", null);
  
      // Call Gemini API (placeholder - implement actual API call)
      const response = {
        answer: "This is a placeholder response. Implement Gemini API integration here.",
        query,
        timestamp: new Date().toISOString()
      };
  
      // Send notification
      await storage.sendNotification({
        userId,
        type: "service_used",
        title: "SabiGuard Query Processed",
        message: `${sabiguardCost} credits deducted. Remaining: ${userCredits.balance - sabiguardCost}`,
        data: { service: "sabiguard", creditsDeducted: sabiguardCost }
      });
  
      res.json({ 
        success: true, 
        response,
        creditsRemaining: userCredits.balance - sabiguardCost
      });
    } catch (error: any) {
      console.error("[SabiGuard] Error processing query:", error);
      res.status(500).json({ error: error.message || "Failed to process query" });
    }
  });
  
  // Get SabiGuard query history
  app.get("/api/sabiguard/history/:userId", userAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const history = await storage.getCreditLog(userId, 50);
      const sabiguardHistory = history.filter(log => log.description?.includes("SabiGuard"));
      res.json(sabiguardHistory);
    } catch (error: any) {
      console.error("[SabiGuard] Error fetching history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch history" });
    }
  });
  
  // SabiMove - Route Planning with Traffic Alerts
  app.post("/api/sabimove/route", userAuth, async (req, res) => {
    try {
      const { userId, origin, destination, waypoints } = req.body;
  
      if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and destination are required" });
      }
  
      // Check and deduct credits
      const userCredits = await storage.getUserCredits(userId);
      const sabimoveCost = 3; // 3 credits per route
  
      if (!userCredits || userCredits.balance < sabimoveCost) {
        return res.status(400).json({ 
          error: "Insufficient credits",
          required: sabimoveCost,
          available: userCredits?.balance || 0
        });
      }
  
      // Deduct credits
      await storage.deductCredits(userId, sabimoveCost, "SabiMove route planning", null);
  
      // Create route (uses existing route storage)
      const route = await storage.createRoute({
        userId,
        origin,
        destination,
        waypoints: waypoints || [],
        status: "active",
        createdAt: new Date()
      });
  
      // Send notification
      await storage.sendNotification({
        userId,
        type: "service_used",
        title: "SabiMove Route Created",
        message: `${sabimoveCost} credits deducted. Remaining: ${userCredits.balance - sabimoveCost}`,
        data: { service: "sabimove", routeId: route.id, creditsDeducted: sabimoveCost }
      });
  
      res.json({ 
        success: true, 
        route,
        creditsRemaining: userCredits.balance - sabimoveCost
      });
    } catch (error: any) {
      console.error("[SabiMove] Error creating route:", error);
      res.status(500).json({ error: error.message || "Failed to create route" });
    }
  });
  
  // Get SabiMove route history
  app.get("/api/sabimove/history/:userId", userAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const routes = await storage.getUserRoutes(userId);
      res.json(routes);
    } catch (error: any) {
      console.error("[SabiMove] Error fetching history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch history" });
    }
  });
  
  // SabiWork - Job Matching and Recommendations
  app.post("/api/sabiwork/recommendations", userAuth, async (req, res) => {
    try {
      const { userId, skills, location, jobType } = req.body;
  
      // Check and deduct credits
      const userCredits = await storage.getUserCredits(userId);
      const sabiworkCost = 2; // 2 credits per recommendation request
  
      if (!userCredits || userCredits.balance < sabiworkCost) {
        return res.status(400).json({ 
          error: "Insufficient credits",
          required: sabiworkCost,
          available: userCredits?.balance || 0
        });
      }
  
      // Deduct credits
      await storage.deductCredits(userId, sabiworkCost, "SabiWork job recommendations", null);
  
      // Get job recommendations (uses existing vendor services)
      const allServices = await storage.getVendorServices();
      const recommendations = allServices.filter(service => 
        service.category === "jobs" || service.type === "job_posting"
      ).slice(0, 10);
  
      // Send notification
      await storage.sendNotification({
        userId,
        type: "service_used",
        title: "SabiWork Recommendations Generated",
        message: `${sabiworkCost} credits deducted. Remaining: ${userCredits.balance - sabiworkCost}`,
        data: { service: "sabiwork", count: recommendations.length, creditsDeducted: sabiworkCost }
      });
  
      res.json({ 
        success: true, 
        recommendations,
        creditsRemaining: userCredits.balance - sabiworkCost
      });
    } catch (error: any) {
      console.error("[SabiWork] Error generating recommendations:", error);
      res.status(500).json({ error: error.message || "Failed to generate recommendations" });
    }
  });
  
  // Apply for a job through SabiWork
  app.post("/api/sabiwork/apply", userAuth, async (req, res) => {
    try {
      const { userId, serviceId, coverLetter, resume } = req.body;
  
      if (!serviceId) {
        return res.status(400).json({ error: "Service ID is required" });
      }
  
      // Create a booking for the job application
      const service = await storage.getVendorServiceById(serviceId);
      if (!service) {
        return res.status(404).json({ error: "Job not found" });
      }
  
      const booking = await storage.createBooking({
        userId,
        vendorId: service.vendorId,
        serviceId,
        status: "pending",
        coverLetter,
        resume,
        createdAt: new Date()
      });
  
      // Send notification to both user and vendor
      await storage.sendNotification({
        userId,
        type: "job_application",
        title: "Job Application Submitted",
        message: `Your application for "${service.title}" has been submitted`,
        data: { bookingId: booking.id, serviceId }
      });
  
      await storage.sendNotification({
        userId: service.vendorId,
        type: "job_application",
        title: "New Job Application",
        message: `You have a new application for "${service.title}"`,
        data: { bookingId: booking.id, applicantId: userId }
      });
  
      res.json({ success: true, booking });
    } catch (error: any) {
      console.error("[SabiWork] Error submitting application:", error);
      res.status(500).json({ error: error.message || "Failed to submit application" });
    }
  });
  
  // Get SabiWork application history
  app.get("/api/sabiwork/history/:userId", userAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const history = await storage.getCreditLog(userId, 50);
      const sabiworkHistory = history.filter(log => log.description?.includes("SabiWork"));
      res.json(sabiworkHistory);
    } catch (error: any) {
      console.error("[SabiWork] Error fetching history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch history" });
    }
  });
  // ===== Notification API =====

  // Get user notifications
  app.get("/api/notifications/:userId", userAuth, async (req, res) => {
    const { userId } = req.params;
    const { limit } = req.query;
    
    const notifications = await storage.getNotificationsByUserId(
      userId,
      limit ? parseInt(limit as string) : 50
    );
    
    res.json(notifications);
  });

  // Get unread notification count
  app.get("/api/notifications/:userId/unread", userAuth, async (req, res) => {
    const { userId } = req.params;
    const count = await storage.getUnreadNotificationCount(userId);
    res.json({ count });
  });

  // Mark single notification as read
  app.post("/api/notifications/:userId/read/:notificationId", userAuth, async (req, res) => {
    const { userId, notificationId } = req.params;
    
    const notification = await storage.getNotificationById(notificationId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await storage.markNotificationAsRead(notificationId);
    res.json({ success: true });
  });

  // Mark all notifications as read
  app.post("/api/notifications/:userId/read-all", userAuth, async (req, res) => {
    const { userId } = req.params;
    const count = await storage.markAllNotificationsAsRead(userId);
    res.json({ success: true, markedCount: count });
  });

  // ===== Admin Notification Templates API =====

  // List all templates
  app.get("/api/admin/notifications/templates", adminAuth, async (req, res) => {
    const templates = await storage.getAllNotificationTemplates();
    res.json(templates);
  });

  // Create template
  app.post("/api/admin/notifications/templates", adminAuth, async (req, res) => {
    const { name, type, subject, bodyTemplate, channels, isActive } = req.body;
    
    if (!name || !type || !subject || !bodyTemplate) {
      return res.status(400).json({ error: 'name, type, subject, and bodyTemplate are required' });
    }
    
    const existing = await storage.getNotificationTemplateByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Template with this name already exists' });
    }
    
    const template = await storage.createNotificationTemplate({
      name,
      type,
      subject,
      bodyTemplate,
      channels: channels || ['in_app'],
      isActive: isActive !== false
    });
    
    res.json(template);
  });

  // Update template
  app.patch("/api/admin/notifications/templates/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const template = await storage.updateNotificationTemplate(id, updates);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  });

  // Delete template
  app.delete("/api/admin/notifications/templates/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    
    const success = await storage.deleteNotificationTemplate(id);
    if (!success) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ success: true });
  });

  // ===== Admin SMTP Settings API =====

  // Get SMTP settings
  app.get("/api/admin/notifications/smtp", adminAuth, async (req, res) => {
    const settings = await storage.getSmtpSettings();
    
    if (!settings) {
      return res.json({ configured: false });
    }
    
    res.json({
      ...settings,
      password: '••••••••',
      configured: true
    });
  });

  // Update SMTP settings
  app.post("/api/admin/notifications/smtp", adminAuth, async (req, res) => {
    const { host, port, username, password, fromEmail, fromName, encryption, isActive } = req.body;
    
    if (!host || !port || !username || !password || !fromEmail || !fromName) {
      return res.status(400).json({ 
        error: 'host, port, username, password, fromEmail, and fromName are required' 
      });
    }
    
    const settings = await storage.updateSmtpSettings({
      host,
      port: parseInt(port),
      username,
      password,
      fromEmail,
      fromName,
      encryption: encryption || 'tls',
      isActive: isActive !== false
    });
    
    res.json({
      ...settings,
      password: '••••••••'
    });
  });

  // ===== Push Subscription API =====

  // Subscribe to push notifications
  app.post("/api/notifications/:userId/push/subscribe", userAuth, async (req, res) => {
    const { userId } = req.params;
    const { endpoint, keys } = req.body;
    
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'endpoint and keys (p256dh, auth) are required' });
    }
    
    const subscription = await storage.subscribeToPush({
      userId,
      endpoint,
      keys
    });
    
    res.json(subscription);
  });

  // Unsubscribe from push notifications
  app.post("/api/notifications/:userId/push/unsubscribe", userAuth, async (req, res) => {
    const { userId } = req.params;
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint is required' });
    }
    
    const success = await storage.unsubscribeFromPush(userId, endpoint);
    res.json({ success });
  });

  // Get user's push subscriptions
  app.get("/api/notifications/:userId/push", userAuth, async (req, res) => {
    const { userId } = req.params;
    const subscriptions = await storage.getPushSubscriptions(userId);
    res.json(subscriptions);
  });

  return httpServer;
}
