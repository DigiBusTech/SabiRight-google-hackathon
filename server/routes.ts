import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { firestoreStorage as storage, verifyAdminToken } from "./firestoreStorage";

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

  // Jobs API
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
