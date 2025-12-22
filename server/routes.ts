import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

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
