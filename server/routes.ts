import type { Express } from "express";
import { createServer, type Server } from "http";
import { dbStorage as storage } from "./dbStorage";

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

  app.patch("/api/vendor/mode/:userId", async (req, res) => {
    const { userId } = req.params;
    const { vendorMode } = req.body;

    const profile = await storage.getUserProfile(userId);
    if (!profile?.isVendor) {
      return res.status(403).json({ error: 'Not approved as vendor' });
    }

    await storage.switchVendorMode(userId, vendorMode);
    res.json({ success: true, vendorMode });
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

  // Admin Settings
  app.get("/api/admin/settings", async (req, res) => {
    const { category } = req.query;
    const settings = await storage.getAdminSettings(category as string | undefined);
    res.json(settings);
  });

  app.get("/api/admin/setting/:key", async (req, res) => {
    const { key } = req.params;
    const setting = await storage.getAdminSetting(key);
    res.json(setting || {});
  });

  app.post("/api/admin/settings", async (req, res) => {
    const { key, value, category, isSecret } = req.body;
    
    if (!key || !category) {
      return res.status(400).json({ error: 'Key and category required' });
    }

    await storage.setAdminSetting(key, value, category, isSecret);
    res.json({ success: true });
  });

  // Admin User Management
  app.get("/api/admin/users", async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/admin/vendor-applications", async (req, res) => {
    const applications = await storage.getAllVendorApplications();
    res.json(applications);
  });

  app.post("/api/admin/vendor/:userId/approve", async (req, res) => {
    const { userId } = req.params;
    await storage.approveVendorApplication(userId);
    res.json({ success: true });
  });

  app.post("/api/admin/vendor/:userId/reject", async (req, res) => {
    const { userId } = req.params;
    await storage.rejectVendorApplication(userId);
    res.json({ success: true });
  });

  // Payments
  app.get("/api/payments", async (req, res) => {
    const { userId } = req.query;
    const payments = await storage.getPayments(userId as string | undefined);
    res.json(payments);
  });

  app.post("/api/payments/initiate", async (req, res) => {
    const { userId, amount, currency, provider, type, description, metadata } = req.body;
    
    if (!userId || !amount || !provider || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const payment = await storage.createPayment({
      userId, amount, currency: currency || 'NGN', provider, type, description, metadata
    });

    // Payment initiation logic per provider
    let redirectUrl = '';
    if (provider === 'stripe') {
      redirectUrl = `/payment/stripe?paymentId=${payment.id}`;
    } else if (provider === 'paystack') {
      redirectUrl = `/payment/paystack?paymentId=${payment.id}`;
    } else if (provider === 'flutterwave') {
      redirectUrl = `/payment/flutterwave?paymentId=${payment.id}`;
    }

    res.json({ ...payment, redirectUrl });
  });

  app.post("/api/payments/:paymentId/confirm", async (req, res) => {
    const { paymentId } = req.params;
    const { status, providerRef } = req.body;

    await storage.updatePaymentStatus(paymentId, status, providerRef);
    res.json({ success: true });
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

  return httpServer;
}
