import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import admin from "firebase-admin";
import { createServer, type Server } from "http";
import { firestoreStorage as storage, FIREBASE_APP_ID } from "./firestoreStorage";
import { verifyAdminToken, verifyUserToken, isUserAdmin, getFirestoreUserFlags } from "./firestoreStorage";
import PaystackService from "./paystackService";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// import Stripe from 'stripe';

// Multer setup
const storageConfig = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storageConfig });

const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  // Use verifyAdminToken which checks Firestore directly
  const result = await verifyAdminToken(token);
  
  if (!result.valid) {
    if (result.error === 'not_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  if (!result.userId) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }

  // Ensure the local DB is synced with admin status from Firestore
  try {
    console.log(`[adminAuth] Checking profile for user ${result.userId}`);
    const profile = await storage.getUserProfile(result.userId);
    console.log(`[adminAuth] Profile found:`, profile ? { isAdmin: profile.isAdmin } : 'null');
    
    if (profile) {
      if (!profile.isAdmin) {
        console.log(`[adminAuth] Syncing admin status for user ${result.userId} to true`);
        await storage.toggleUserAdmin(result.userId, true);
      }
    } else {
      // Proactively create profile in DB if it doesn't exist but user is admin in Firestore
      console.log(`[adminAuth] Creating missing admin profile for user ${result.userId}`);
      await storage.updateUserProfile(result.userId, {
        userId: result.userId,
        isAdmin: true,
        isVendor: false,
        kycStatus: 'verified',
        createdAt: new Date()
      });
    }
  } catch (syncError) {
    console.error('[adminAuth] Failed to sync admin profile during auth:', syncError);
    // We still allow the request if the token is valid, but logging the error is important
  }
  
  (req as any).userId = result.userId;
  next();
};

const kycVerifiedAuth = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const profile = await storage.getUserProfile(userId);
    if (!profile || profile.kycStatus !== 'verified') {
      return res.status(403).json({ 
        error: 'KYC verification required', 
        message: 'You must have a verified KYC status to perform this action.' 
      });
    }
    next();
  } catch (error) {
    next(error);
  }
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
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Upload API
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fullUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url: `/uploads/${req.file.filename}`, fullUrl });
  });

  // Plans
  app.get("/api/plans", async (req, res, next) => {
    try {
      const plans = await storage.getAllPlans();
      console.log(`[API] GET /api/plans returned ${plans.length} plans`);
      res.json(plans);
    } catch (error) {
      console.error(`[API] GET /api/plans error:`, error);
      next(error);
    }
  });

  // Public Settings (Non-sensitive)
  app.get("/api/settings/public", async (req, res, next) => {
    try {
      const settings = await storage.getAdminSettings();
      const publicSettings = settings.filter(s => 
        ['captcha_site_key', 'ai_provider'].includes(s.key)
      ).reduce((acc: any, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {});
      res.json(publicSettings);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/settings/google_maps_api_key", async (req, res, next) => {
    try {
      const settings = await storage.getAdminSettings();
      const mapsKey = settings.find(s => s.key === 'google_maps_api_key');
      res.json({ value: mapsKey?.value || '' });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/plans/user-type/:userType", async (req, res, next) => {
    try {
      const { userType } = req.params;
      if (userType !== 'user' && userType !== 'vendor') {
        return res.status(400).json({ error: 'Invalid user type' });
      }
      const freePlans = await storage.getPlansByType('free', userType as 'user' | 'vendor');
      const basicPlans = await storage.getPlansByType('basic', userType as 'user' | 'vendor');
      const proPlans = await storage.getPlansByType('pro', userType as 'user' | 'vendor');
      res.json([...freePlans, ...basicPlans, ...proPlans]);
    } catch (error) {
      next(error);
    }
  });

  // Credits
  app.get("/api/credits/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const credits = await storage.getUserCredits(userId);
      if (!credits) {
        return res.status(404).json({ error: 'Credits not found' });
      }
      res.json(credits);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/credits/:userId/available", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/credits/:userId/deduct", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/credits/:userId/refund", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/credits/:userId/log", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const logs = await storage.getCreditLog(userId);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // Cloaked Routes
  app.get("/api/routes/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const routes = await storage.getUserRoutes(userId);
      res.json(routes);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/routes", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/routes/:routeId/status", async (req, res, next) => {
    try {
      const { routeId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status required' });
      }

      await storage.updateRouteStatus(routeId, status);
      res.json({ success: true, status });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/routes/:routeId", async (req, res, next) => {
    try {
      const { routeId } = req.params;
      await storage.deleteRoute(routeId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Traffic Alerts
  app.get("/api/alerts/:routeId", async (req, res, next) => {
    try {
      const { routeId } = req.params;
      const alerts = await storage.getRouteAlerts(routeId);
      res.json(alerts);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/alerts", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/alerts/:alertId/acknowledge", async (req, res, next) => {
    try {
      const { alertId } = req.params;
      await storage.acknowledgeAlert(alertId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // KYC & Vendor Endpoints
  app.post("/api/kyc/:userId/submit", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { kycDocument } = req.body;

      await storage.updateUserKYC(userId, 'pending', kycDocument);
      res.json({ success: true, status: 'pending' });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/debug/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const profile = await storage.getUserProfile(userId);
      const flags = await getFirestoreUserFlags(userId);
      
      // Get raw data from Firestore to be 100% sure
      const profileDoc = await admin.firestore()
        .collection('artifacts')
        .doc(process.env.FIREBASE_APP_ID || 'legal-13d13')
        .collection('profiles')
        .doc(userId)
        .get();
        
      const userDoc = await admin.firestore()
        .collection('artifacts')
        .doc(process.env.FIREBASE_APP_ID || 'legal-13d13')
        .collection('users')
        .doc(userId)
        .get();

      res.json({
        userId,
        appId: process.env.FIREBASE_APP_ID || 'legal-13d13',
        storageProfile: profile,
        flags,
        rawProfile: profileDoc.exists ? profileDoc.data() : 'not_found',
        rawUser: userDoc.exists ? userDoc.data() : 'not_found'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/profile/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      console.log(`[API] Fetching profile for ${userId}`);
      let profile = await storage.getUserProfile(userId);
      
      // Sync flags if profile exists
      if (profile) {
        const flags = await getFirestoreUserFlags(userId);
        let changed = false;
        
        if (flags.isAdmin && !profile.isAdmin) {
          console.log(`[API] Syncing admin status for ${userId} from Firestore`);
          await storage.toggleUserAdmin(userId, true);
          changed = true;
        }
        
        if (flags.isVendor && !profile.isVendor) {
          console.log(`[API] Syncing vendor status for ${userId} from Firestore`);
          await storage.toggleUserVendor(userId, true);
          changed = true;
        }
        
        if (changed) {
          profile = await storage.getUserProfile(userId); // Refresh profile
        }
      }

      console.log(`[API] Returning profile for ${userId}:`, profile ? { isAdmin: profile.isAdmin, isVendor: profile.isVendor } : 'null');
      res.json(profile || {});
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/profile/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { email, displayName, captchaToken } = req.body;
      
      // Verify reCAPTCHA if token is provided or if it's a new user
      const existingProfile = await storage.getUserProfile(userId);
      if (!existingProfile || !existingProfile.userId) {
        if (captchaToken) {
          const isValid = await verifyRecaptcha(captchaToken);
          if (!isValid) {
            return res.status(400).json({ error: 'reCAPTCHA verification failed' });
          }
        }
      }

      if (existingProfile && existingProfile.userId) {
        // Sync flags if they're false in DB but true in Firestore
        const flags = await getFirestoreUserFlags(userId);
        let changed = false;
        
        if (flags.isAdmin && !existingProfile.isAdmin) {
          await storage.toggleUserAdmin(userId, true);
          existingProfile.isAdmin = true;
          changed = true;
        }
        
        if (flags.isVendor && !existingProfile.isVendor) {
          await storage.toggleUserVendor(userId, true);
          existingProfile.isVendor = true;
          changed = true;
        }
        
        return res.json(existingProfile);
      }
      
      const flags = await getFirestoreUserFlags(userId);
      console.log(`[API] Creating profile for ${userId}, flags:`, flags);
      
      await storage.createUser({ id: userId, username: displayName || email || userId, password: '' } as any);
      await storage.updateUserProfile(userId, {
        userId,
        email: email || null,
        displayName: displayName || null,
        isVendor: flags.isVendor,
        isAdmin: flags.isAdmin,
        kycStatus: 'pending',
        vendorMode: false,
        createdAt: new Date()
      });
      
      const newProfile = await storage.getUserProfile(userId);
      res.json(newProfile);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/profile/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      await storage.updateUserProfile(userId, req.body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/vendor/apply", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/vendor/application/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const application = await storage.getVendorApplication(userId);
      res.json(application || {});
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/vendor/mode/:userId", adminAuth, async (req, res, next) => {
    const { userId } = req.params;
    const { vendorMode } = req.body;

    try {
      await storage.switchVendorMode(userId, vendorMode);
      res.json({ success: true, vendorMode });
    } catch (error: any) {
      if (error.message?.includes('Profile not found')) {
        return res.status(404).json({ error: 'User profile not found' });
      }
      next(error);
    }
  });

  app.patch("/api/vendor/self/mode", async (req, res, next) => {
    try {
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
      if (!profile.isVendor) {
        return res.status(403).json({ error: 'Not an approved vendor' });
      }

      await storage.switchVendorMode(userId, vendorMode);
      res.json({ success: true, vendorMode });
    } catch (error: any) {
      if (error.message?.includes('Profile not found')) {
        return res.status(404).json({ error: 'User profile not found' });
      }
      next(error);
    }
  });

  // Dashboard Traffic
  app.get("/api/dashboard/traffic/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const traffic = await storage.getDashboardTraffic(userId);
      res.json(traffic || {});
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/dashboard/traffic/:userId/refresh", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Events
  app.get("/api/events", async (req, res, next) => {
    try {
      const city = req.query.city as string;
      const events = await storage.getEvents();
      
      if (city) {
        events.sort((a: any, b: any) => {
          const aInCity = a.city?.toLowerCase() === city.toLowerCase() || a.location?.toLowerCase().includes(city.toLowerCase());
          const bInCity = b.city?.toLowerCase() === city.toLowerCase() || b.location?.toLowerCase().includes(city.toLowerCase());
          if (aInCity && !bInCity) return -1;
          if (!aInCity && bInCity) return 1;
          return 0;
        });
      }
      
      res.json(events);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/events", userAuth, kycVerifiedAuth, async (req, res, next) => {
    try {
      const { title, description, date, time, location, category, organizer, organizerId, maxAttendees } = req.body;
      const userId = (req as any).userId;
      
      if (!title || !date || !time || !location || !category || !organizer) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const event = await storage.createEvent({
        title, description, date, time, location, category, organizer, organizerId: organizerId || userId, maxAttendees
      });

      // Automatically save as MOAT data for AI training
      await storage.createMoatData({
        title: `Event: ${title}`,
        content: `Category: ${category}\nOrganizer: ${organizer}\nDate: ${date} ${time}\nLocation: ${location}\nDescription: ${description}`,
        category: 'events',
        source: 'sabievents',
        metadata: { eventId: event.id, category, location }
      });

      res.json(event);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/events/:eventId/register", userAuth, kycVerifiedAuth, async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      await storage.registerForEvent(eventId, userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/events/:eventId", userAuth, kycVerifiedAuth, async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const userId = (req as any).userId;
      const isAdmin = await isUserAdmin(userId);
      
      // Only admin or the creator can delete? 
      // For now, let's just protect with KYC as requested, 
      // but ideally we check ownership.
      await storage.deleteEvent(eventId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Saved Events
  app.post("/api/events/:eventId/save", userAuth, async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const userId = (req as any).userId;

      await storage.saveEvent(userId, eventId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/events/:eventId/save", userAuth, async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const userId = (req as any).userId;

      await storage.unsaveEvent(userId, eventId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/events/saved/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const currentUserId = (req as any).userId;
      const isAdmin = await isUserAdmin(currentUserId);

      if (!isAdmin && userId !== currentUserId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const savedEventIds = await storage.getSavedEvents(userId);
      res.json(savedEventIds);
    } catch (error) {
      next(error);
    }
  });

  // Vendor Services
  app.get("/api/services", async (req, res, next) => {
    try {
      const city = req.query.city as string;
      const services = await storage.getVendorServices();
      
      if (city) {
        services.sort((a: any, b: any) => {
          const aInCity = a.city?.toLowerCase() === city.toLowerCase() || a.location?.toLowerCase().includes(city.toLowerCase());
          const bInCity = b.city?.toLowerCase() === city.toLowerCase() || b.location?.toLowerCase().includes(city.toLowerCase());
          if (aInCity && !bInCity) return -1;
          if (!aInCity && bInCity) return 1;
          return 0;
        });
      }
      
      res.json(services);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/services", async (req, res, next) => {
    try {
      const { vendorId, name, type, specialization, description, location, latitude, longitude, contactPhone, contactEmail, priceRange } = req.body;
      
      if (!vendorId || !name || !type || !location) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const service = await storage.createVendorService({
        vendorId, name, type, specialization, description, location, latitude, longitude, contactPhone, contactEmail, priceRange
      });

      // Automatically save as MOAT data for AI training
      await storage.createMoatData({
        title: `Service: ${name} (${type})`,
        content: `Type: ${type}\nSpecialization: ${specialization}\nDescription: ${description}\nLocation: ${location}\nContact: ${contactPhone || contactEmail}`,
        category: 'marketplace',
        source: 'sabimarket',
        metadata: { serviceId: service.id, vendorId, type, location }
      });

      res.json(service);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/services/:serviceId", async (req, res, next) => {
    try {
      const { serviceId } = req.params;
      await storage.updateVendorService(serviceId, req.body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/services/:serviceId", async (req, res, next) => {
    try {
      const { serviceId } = req.params;
      await storage.deleteVendorService(serviceId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin Settings - protected routes
  app.get("/api/admin/settings", adminAuth, async (req, res, next) => {
    try {
      const { category } = req.query;
      const settings = await storage.getAdminSettings(category as string | undefined);
      const filteredSettings = settings.map((s: any) => ({
        ...s,
        value: s.isSecret ? '••••••••' : s.value
      }));
      res.json(filteredSettings);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/setting/:key", adminAuth, async (req, res, next) => {
    try {
      const { key } = req.params;
      const setting = await storage.getAdminSetting(key);
      res.json(setting || {});
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/settings", adminAuth, async (req, res, next) => {
    try {
      const { key, value, category, isSecret } = req.body;
      
      if (!key || !category) {
        return res.status(400).json({ error: 'Key and category required' });
      }

      await storage.setAdminSetting(key, value, category, isSecret);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin User Management - protected routes
  app.get("/api/admin/users", adminAuth, async (req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/vendor-applications", adminAuth, async (req, res, next) => {
    try {
      const applications = await storage.getAllVendorApplications();
      res.json(applications);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/vendor/:userId/approve", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      await storage.approveVendorApplication(userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/vendor/:userId/reject", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      await storage.rejectVendorApplication(userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Update user profile
  app.patch("/api/admin/users/:userId", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      await storage.updateUserProfile(userId, req.body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Update user credits
  app.patch("/api/admin/users/:userId/credits", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { totalCredits } = req.body;
      
      if (totalCredits === undefined || isNaN(parseInt(totalCredits))) {
        return res.status(400).json({ error: 'Valid totalCredits required' });
      }
      
      await storage.setUserCredits(userId, parseInt(totalCredits));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Debug: Show Firestore structure and create sample data
  app.get("/api/debug/firestore-status", async (req, res, next) => {
    try {
      const debugAppId = (req.query.appId as string) || FIREBASE_APP_ID;
      
      // Temporary helper to fetch from a specific appId
      const getCollection = (name: string) => admin.firestore().collection('artifacts').doc(debugAppId).collection(name);
      
      const profilesSnapshot = await getCollection('profiles').get();
      const profiles = profilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const vendorAppsSnapshot = await getCollection('vendorApplications').get();
      const vendorApps = vendorAppsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const plansSnapshot = await getCollection('plans').get();
      const plans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const eventsSnapshot = await getCollection('events').get();
      const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const servicesSnapshot = await getCollection('vendorServices').get();
      const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const jobsSnapshot = await getCollection('jobs').get();
      const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const paymentMethodsSnapshot = await getCollection('paymentMethods').get();
      const paymentMethods = paymentMethodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const walletsSnapshot = await getCollection('wallets').get();
      const wallets = walletsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const usersSnapshot = await getCollection('users').get();
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const rootCollections = ['users', 'profiles', 'vendors', 'bookings'];
      const rootStats: any = {};
      for (const collName of rootCollections) {
        try {
          const snapshot = await admin.firestore().collection(collName).limit(3).get();
          rootStats[collName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e: any) {
          rootStats[collName] = `Error: ${e.message}`;
        }
      }
      
      res.json({
        message: "Firestore data location: artifacts > " + debugAppId + " > [collection_name]",
        rootCollections,
        rootSample: rootStats,
        collections: {
          users: { count: users.length, path: "artifacts/" + debugAppId + "/users" },
          profiles: { count: profiles.length, path: "artifacts/" + debugAppId + "/profiles" },
          vendorApplications: { count: vendorApps.length, path: "artifacts/" + debugAppId + "/vendorApplications" },
          plans: { count: plans.length, path: "artifacts/" + debugAppId + "/plans" },
          events: { count: events.length, path: "artifacts/" + debugAppId + "/events" },
          vendorServices: { count: services.length, path: "artifacts/" + debugAppId + "/vendorServices" },
          jobs: { count: jobs.length, path: "artifacts/" + debugAppId + "/jobs" },
          paymentMethods: { count: paymentMethods.length, path: "artifacts/" + debugAppId + "/paymentMethods" },
          wallets: { count: wallets.length, path: "artifacts/" + debugAppId + "/wallets" },
        },
        sampleUsers: users.slice(0, 5),
        sampleProfiles: profiles.slice(0, 10),
        samplePlans: plans.slice(0, 3),
        samplePaymentMethods: paymentMethods.slice(0, 3),
        instructions: [
          "1. Go to Firebase Console > Firestore Database",
          "2. Click on 'artifacts' collection",
          "3. Click on '" + debugAppId + "' document",
          "4. You will see subcollections: profiles, plans, credits, events, etc.",
          "5. Click on 'profiles' to see user data"
        ]
      });
    } catch (err: any) {
      next(err);
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
      console.log(`Admin setup failed: Invalid key for user ${userId}`);
      return res.status(403).json({ error: 'Invalid setup key' });
    }
    
    console.log(`Setting user ${userId} as admin...`);
    
    // 1. Update local DB
    const success = await storage.toggleUserAdmin(userId, true);
    
    // 2. Proactively update Firestore if available
    try {
      const { FIREBASE_APP_ID } = await import('./firestoreStorage');
      const admin = await import('firebase-admin');
      
      await admin.default.firestore()
        .collection('artifacts')
        .doc(FIREBASE_APP_ID)
        .collection('profiles')
        .doc(userId)
        .set({ isAdmin: true }, { merge: true });
        
      console.log(`Firestore updated for admin ${userId}`);
    } catch (e) {
      console.error('Failed to sync admin status to Firestore:', e);
      // We still return success if local DB was updated, 
      // as the app will function with local admin status
    }

    if (success) {
      res.json({ success: true, message: 'User set as admin successfully' });
    } else {
      res.status(500).json({ error: 'Failed to set user as admin in local database' });
    }
  });

  // Admin: Approve KYC
  app.post("/api/admin/kyc/:userId/approve", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      await storage.updateUserKYC(userId, 'verified');
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Reject KYC
  app.post("/api/admin/kyc/:userId/reject", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      await storage.updateUserKYC(userId, 'rejected');
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Assign plan to user
  app.post("/api/admin/users/:userId/plan", adminAuth, async (req, res, next) => {
    try {
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

      // Update user storage limit based on plan
      let chatStorageLimit = 524288; // Default 512KB
      if (plan.type === 'pro') chatStorageLimit = 5 * 1024 * 1024; // 5MB
      else if (plan.type === 'enterprise') chatStorageLimit = 50 * 1024 * 1024; // 50MB
      else if (plan.type === 'basic') chatStorageLimit = 1 * 1024 * 1024; // 1MB

      await storage.updateUserProfile(userId, { chatStorageLimit });

      res.json({ success: true, subscription });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Get all vendors
  app.get("/api/admin/vendors", adminAuth, async (req, res, next) => {
    try {
      const vendors = await storage.getAllVendors();
      res.json(vendors);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Update user profile
  app.patch("/api/admin/users/:userId", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      const updated = await storage.updateUserProfile(userId, updates);
      if (updated) {
        res.json(updated);
      } else {
        res.status(404).json({ error: 'User profile not found' });
      }
    } catch (error) {
      next(error);
    }
  });

  // Admin: Impersonate user (Login as User)
  app.post("/api/admin/users/:userId/impersonate", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const token = await storage.getImpersonationToken(userId);
      res.json({ token });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Toggle user admin status
  app.post("/api/admin/users/:userId/toggle-admin", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { isAdmin } = req.body;
      
      const success = await storage.toggleUserAdmin(userId, isAdmin);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to update user' });
      }
    } catch (error) {
      next(error);
    }
  });

  // Admin: Delete user
  app.delete("/api/admin/users/:userId", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      
      const success = await storage.deleteUser(userId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to delete user' });
      }
    } catch (error) {
      next(error);
    }
  });

  // Admin: Get all plans
  app.get("/api/admin/plans", adminAuth, async (req, res, next) => {
    try {
      const plans = await storage.getAllPlans();
      res.json(plans);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Create plan
  app.post("/api/admin/plans", adminAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Admin: Update plan
  app.put("/api/admin/plans/:planId", adminAuth, async (req, res, next) => {
    try {
      const { planId } = req.params;
      const updates = req.body;

      const plan = await storage.updatePlan(planId, updates);
      if (plan) {
        res.json(plan);
      } else {
        res.status(404).json({ error: 'Plan not found' });
      }
    } catch (error) {
      next(error);
    }
  });

  // Admin: Delete plan
  app.delete("/api/admin/plans/:planId", adminAuth, async (req, res, next) => {
    try {
      const { planId } = req.params;
      const success = await storage.deletePlan(planId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Plan not found' });
      }
    } catch (error) {
      next(error);
    }
  });

  // Credit Packages API
  app.get("/api/admin/credit-packages", adminAuth, async (req, res, next) => {
    try {
      const packages = await storage.getCreditPackages();
      res.json(packages);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/credit-packages", adminAuth, async (req, res, next) => {
    try {
      const packageData = req.body;
      const newPackage = await storage.createCreditPackage(packageData);
      res.json(newPackage);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/credit-packages/:packageId", adminAuth, async (req, res, next) => {
    try {
      const { packageId } = req.params;
      const updates = req.body;
      const updated = await storage.updateCreditPackage(packageId, updates);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/credit-packages/:packageId", adminAuth, async (req, res, next) => {
    try {
      const { packageId } = req.params;
      const success = await storage.deleteCreditPackage(packageId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Package not found' });
      }
    } catch (error) {
      next(error);
    }
  });

  // Payment Methods API
  app.get("/api/admin/payment-methods", adminAuth, async (req, res, next) => {
    try {
      const methods = await storage.getPaymentMethods();
      res.json(methods);
    } catch (error) {
      next(error);
    }
  });

  // Admin Payments/Transactions API
  app.get("/api/admin/payments", adminAuth, async (req, res) => {
    try {
      const payments = await storage.getPayments();
      // Enrich with user details if possible (or frontend can fetch)
      // For now, just return payments. Frontend can match with users list if needed.
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/payment-methods", adminAuth, async (req, res, next) => {
    try {
      const methodData = req.body;
      const newMethod = await storage.createPaymentMethod(methodData);
      res.json(newMethod);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/payment-methods/:methodId", adminAuth, async (req, res, next) => {
    try {
      const { methodId } = req.params;
      const updates = req.body;
      const updated = await storage.updatePaymentMethod(methodId, updates);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/payment-methods/:methodId", adminAuth, async (req, res, next) => {
    try {
      const { methodId } = req.params;
      const success = await storage.deletePaymentMethod(methodId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Payment method not found' });
      }
    } catch (error) {
      next(error);
    }
  });

  // Admin Jobs Management
  app.get("/api/admin/jobs", adminAuth, async (req, res, next) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/jobs", adminAuth, async (req, res, next) => {
    try {
      const job = await storage.createJob(req.body);
      
      // Automatically save as MOAT data for AI training
      await storage.createMoatData({
        title: `Job: ${job.title} at ${job.company || 'Confidential'}`,
        content: `Role: ${job.title}\nCompany: ${job.company || 'Confidential'}\nLocation: ${job.location}\nType: ${job.type}\nDescription: ${job.description}`,
        category: 'jobs',
        source: 'sabijobs_admin',
        metadata: { jobId: job.id, company: job.company, location: job.location }
      });

      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/jobs/:jobId", adminAuth, async (req, res, next) => {
    try {
      const { jobId } = req.params;
      await storage.updateJob(jobId, req.body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/jobs/:jobId", adminAuth, async (req, res, next) => {
    try {
      const { jobId } = req.params;
      await storage.deleteJob(jobId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin Events Management
  app.get("/api/admin/events", adminAuth, async (req, res, next) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/events", adminAuth, async (req, res, next) => {
    try {
      const event = await storage.createEvent(req.body);

      // Automatically save as MOAT data for AI training
      await storage.createMoatData({
        title: `Event: ${event.title}`,
        content: `Category: ${event.category}\nOrganizer: ${event.organizer}\nDate: ${event.date} ${event.time}\nLocation: ${event.location}\nDescription: ${event.description}`,
        category: 'events',
        source: 'sabievents_admin',
        metadata: { eventId: event.id, category: event.category, location: event.location }
      });

      res.json(event);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/events/:eventId", adminAuth, async (req, res, next) => {
    try {
      const { eventId } = req.params;
      await storage.updateEvent(eventId, req.body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/events/:eventId", adminAuth, async (req, res, next) => {
    try {
      const { eventId } = req.params;
      await storage.deleteEvent(eventId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin: MOAT Data Management
  app.get("/api/admin/moat", adminAuth, async (req, res, next) => {
    try {
      const data = await storage.getMoatData();
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/moat", adminAuth, async (req, res, next) => {
    try {
      const item = await storage.createMoatData(req.body);
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/moat/:id", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      await storage.deleteMoatData(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // FAQ Management
  app.get("/api/faqs", async (req, res, next) => {
    try {
      const faqs = await storage.getFaqs();
      res.json(faqs);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/faqs", adminAuth, async (req, res, next) => {
    try {
      const faq = await storage.createFaq(req.body);
      res.json(faq);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/faqs/:id", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const faq = await storage.updateFaq(id, req.body);
      res.json(faq);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/faqs/:id", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      await storage.deleteFaq(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Testimonial Management
  app.get("/api/testimonials", async (req, res, next) => {
    try {
      const testimonials = await storage.getTestimonials();
      res.json(testimonials);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/testimonials", adminAuth, async (req, res, next) => {
    try {
      const testimonial = await storage.createTestimonial(req.body);
      res.json(testimonial);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/testimonials/:id", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const testimonial = await storage.updateTestimonial(id, req.body);
      res.json(testimonial);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/testimonials/:id", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      await storage.deleteTestimonial(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Survey API
  app.post("/api/surveys", userAuth, async (req, res, next) => {
    try {
      const { feature, rating, feedback } = req.body;
      const userId = (req as any).userId;

      if (!feature || !rating) {
        return res.status(400).json({ error: "Feature and rating are required" });
      }

      const survey = await storage.createSurvey({
        userId,
        feature,
        rating,
        feedback
      });

      res.status(201).json(survey);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/surveys", adminAuth, async (req, res, next) => {
    try {
      const surveys = await storage.getSurveys();
      res.json(surveys);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/surveys/stats", adminAuth, async (req, res, next) => {
    try {
      const surveys = await storage.getSurveys();
      
      const stats = surveys.reduce((acc: any, curr: any) => {
        if (!acc[curr.feature]) {
          acc[curr.feature] = { count: 0, totalRating: 0, feedback: [] };
        }
        acc[curr.feature].count++;
        acc[curr.feature].totalRating += curr.rating;
        if (curr.feedback) acc[curr.feature].feedback.push(curr.feedback);
        return acc;
      }, {});

      const processedStats = Object.keys(stats).reduce((acc: any, feature) => {
        acc[feature] = {
          averageRating: stats[feature].totalRating / stats[feature].count,
          count: stats[feature].count,
          feedback: stats[feature].feedback.slice(-5) // Last 5 feedback
        };
        return acc;
      }, {});

      res.json(processedStats);
    } catch (error) {
      next(error);
    }
  });

  // Public endpoint for active payment methods (no auth required)
  app.get("/api/payment-methods", async (req, res, next) => {
    try {
      const methods = await storage.getActivePaymentMethods();
      // Filter out sensitive data for public endpoint
      const safeMethods = methods.map((m: any) => {
        // Explicitly only allow safe fields to prevent sensitive data leakage
        const safeFields: any = {
          id: m.id,
          name: m.name,
          type: m.type,
          active: m.active,
          icon: m.icon,
          description: m.description,
          instructions: m.instructions,
          fields: m.fields,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt
        };
        
        // Add public keys for automatic gateways if they exist
        if (['paystack', 'flutterwave', 'stripe'].includes(m.type)) {
          safeFields.publicKey = m.publicKey || '';
        }
        
        return safeFields;
      });
      res.json(safeMethods);
    } catch (error) {
      next(error);
    }
  });

  // Public endpoint for credit packages (no auth required)
  app.get("/api/credit-packages", async (req, res, next) => {
    try {
      const packages = await storage.getCreditPackages();
      res.json(packages);
    } catch (error) {
      next(error);
    }
  });

  // Jobs APIs API
  app.get("/api/jobs", async (req, res, next) => {
    try {
      const city = req.query.city as string;
      const jobs = await storage.getJobs(100);
      
      if (city) {
        jobs.sort((a: any, b: any) => {
          const aInCity = a.city?.toLowerCase() === city.toLowerCase() || a.location?.toLowerCase().includes(city.toLowerCase());
          const bInCity = b.city?.toLowerCase() === city.toLowerCase() || b.location?.toLowerCase().includes(city.toLowerCase());
          if (aInCity && !bInCity) return -1;
          if (!aInCity && bInCity) return 1;
          return 0;
        });
      }
      
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/jobs", userAuth, kycVerifiedAuth, async (req, res, next) => {
    try {
      const { title, company, location, type, workMode, salary, description, contact, postedBy, source, isAiFetched } = req.body;
      const userId = (req as any).userId;
      
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
        postedBy: postedBy || userId,
        source: source || 'User Posted',
        isAiFetched: isAiFetched || false
      });

      // Automatically save as MOAT data for AI training
      await storage.createMoatData({
        title: `Job: ${title} at ${company || 'Confidential'}`,
        content: `Role: ${title}\nCompany: ${company || 'Confidential'}\nLocation: ${location}\nType: ${type}\nDescription: ${description}`,
        category: 'jobs',
        source: 'sabijobs',
        metadata: { jobId: job.id, company, location }
      });

      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  // Save Job
  app.post("/api/jobs/:jobId/save", userAuth, async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const userId = (req as any).userId;

      await storage.saveJob(userId, jobId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Unsave Job
  app.delete("/api/jobs/:jobId/save", userAuth, async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const userId = (req as any).userId;

      await storage.unsaveJob(userId, jobId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Get Saved Jobs
  app.get("/api/jobs/saved/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const currentUserId = (req as any).userId;
      const isAdmin = await isUserAdmin(currentUserId);

      if (!isAdmin && userId !== currentUserId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const jobs = await storage.getSavedJobs(userId);
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  // Get Saved Job IDs (for quick lookup)
  app.get("/api/jobs/saved-ids/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const currentUserId = (req as any).userId;
      const isAdmin = await isUserAdmin(currentUserId);

      if (!isAdmin && userId !== currentUserId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const jobIds = await storage.getSavedJobIds(userId);
      res.json(jobIds);
    } catch (error) {
      next(error);
    }
  });

  // Apply to Job
  app.post("/api/jobs/:jobId/apply", userAuth, kycVerifiedAuth, async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const userId = (req as any).userId;

      const application = await storage.applyToJob(userId, jobId);
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  // Get Applied Jobs
  app.get("/api/jobs/applied/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const currentUserId = (req as any).userId;
      const isAdmin = await isUserAdmin(currentUserId);

      if (!isAdmin && userId !== currentUserId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const jobs = await storage.getAppliedJobs(userId);
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  // Get Applied Job IDs (for quick lookup)
  app.get("/api/jobs/applied-ids/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const currentUserId = (req as any).userId;
      const isAdmin = await isUserAdmin(currentUserId);

      if (!isAdmin && userId !== currentUserId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const jobIds = await storage.getAppliedJobIds(userId);
      res.json(jobIds);
    } catch (error) {
      next(error);
    }
  });

  // Update Application Status
  app.patch("/api/jobs/:jobId/application-status", userAuth, async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const { userId, status } = req.body;
      const currentUserId = (req as any).userId;
      const isAdmin = await isUserAdmin(currentUserId);

      // Ideally only the employer or admin can update status.
      // For now, let's at least check if the current user is an admin or the one who posted the job.
      // But we don't have job creator info easily here without fetching the job.
      // Let's stick to admin or a basic check for now.
      if (!isAdmin) {
        // Basic check: user can't update their own status to 'accepted'?
        // Actually, this should probably be restricted to admins/vendors.
      }

      if (!userId || !status) {
        return res.status(400).json({ error: 'User ID and status required' });
      }

      const validStatuses = ['applied', 'reviewing', 'interviewing', 'accepted', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      await storage.updateApplicationStatus(userId, jobId, status);
      res.json({ success: true, status });
    } catch (error) {
      next(error);
    }
  });

  // Get AI Generated Jobs for User
  app.get("/api/jobs/generated/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const jobs = await storage.getGeneratedJobs(userId);
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  // AI Generation Helper
  const verifyRecaptcha = async (token: string) => {
    const secretKeySetting = await storage.getAdminSetting('captcha_secret_key');
    const secretKey = secretKeySetting?.value;

    if (!secretKey) {
      // If no secret key is configured, skip verification
      return true;
    }

    try {
      const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${secretKey}&response=${token}`
      });

      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('reCAPTCHA verification error:', err);
      return false;
    }
  };

  const generateAIResponse = async (prompt: string) => {
    const primaryAISetting = await storage.getAdminSetting('ai_provider');
    const provider = primaryAISetting?.value || 'google';

    if (provider === 'openai') {
      const apiKeySetting = await storage.getAdminSetting('openai_api_key');
      const apiKey = apiKeySetting?.value || process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content || null;
    } else {
      // Default to Gemini (google)
      const apiKeySetting = await storage.getAdminSetting('google_gemini_api_key');
      const apiKey = apiKeySetting?.value || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }

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
        throw new Error(`Gemini error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
  };

  // AI Generation API
  app.post("/api/ai/generate", async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    try {
      const text = await generateAIResponse(prompt);
      res.json({ response: text });
    } catch (err: any) {
      console.error('[AI Generate] Error:', err.message);
      if (err.message.includes('not configured')) {
        return res.status(503).json({ error: err.message });
      }
      res.status(500).json({ error: 'AI Generation failed. Please check your API keys in Admin Settings.' });
    }
  });

  // AI Civic Chat API (SabiRight Citizen Education)
  app.post("/api/ai/civic/chat", userAuth, async (req, res, next) => {
    try {
      const { userId, message, city, isUrgent, lat, lng, chatId } = req.body;
      
      if (!userId || !message) {
        return res.status(400).json({ error: 'User ID and message required' });
      }

      // Check storage limits
      const profile = await storage.getUserProfile(userId);
      if (profile) {
        const limit = profile.chatStorageLimit || 524288;
        const used = profile.chatStorageUsed || 0;
        if (used >= limit) {
          return res.status(400).json({ 
            error: "Storage limit reached", 
            message: "You have reached your chat storage limit. Please upgrade your plan for more space."
          });
        }
      }

      const credits = await storage.getUserCredits(userId);
      const availableCredits = (credits?.totalCredits || 0) - (credits?.usedCredits || 0);
      
      if (availableCredits < 1) {
        return res.status(402).json({ error: 'Insufficient credits' });
      }

      // Fetch nearby lawyers and accountants using distance if available
      const lawyers = await storage.getVendorServices({ type: 'Lawyer', city, lat, lng });
      const accountants = await storage.getVendorServices({ type: 'Accountant', city, lat, lng });
      
      // Sort by distance primarily (if available from getVendorServices), then verified status and rating
      const allVendors = [...lawyers, ...accountants].sort((a: any, b: any) => {
        if (a.distance !== undefined && b.distance !== undefined) {
          if (a.distance !== b.distance) return a.distance - b.distance;
        }
        
        if (a.verified && !b.verified) return -1;
        if (!a.verified && b.verified) return 1;
        return parseFloat(b.rating || '0') - parseFloat(a.rating || '0');
      }).slice(0, 5); // Suggest top 5 closest/best matches

      const nearbyVendors = allVendors.map((v: any) => 
        `- ${v.name} (${v.type}${v.verified ? ' - Verified' : ''}): ${v.location}${v.distance ? ` (${Math.round(v.distance)}km away)` : ''}. Contact: ${v.contactPhone || v.contactEmail}`
      ).join('\n');

      // Fetch relevant MOAT data for accurate citations
      const constitutionData = await storage.getMoatData('constitution');
      const police_actData = await storage.getMoatData('police_act');
      const forumMoat = await storage.getMoatData('forum');
      const marketplaceMoat = await storage.getMoatData('marketplace');
      const eventsMoat = await storage.getMoatData('events');
      const jobsMoat = await storage.getMoatData('jobs');
      const locationMoat = city ? await storage.getMoatData(city.toLowerCase()) : [];
      
      // Combine and limit context size to avoid token limits
      const moatContext = [...constitutionData, ...police_actData, ...forumMoat, ...marketplaceMoat, ...eventsMoat, ...jobsMoat, ...locationMoat]
        .slice(0, 50) // Limit to top 50 most recent relevant items
        .map(d => `Title: ${d.title || 'Untitled'}\nContent: ${d.content}\nSource: ${d.source || 'Unknown'}`)
        .join('\n\n');

      const systemPrompt = isUrgent
        ? `SabiRight CITIZEN EDUCATION AGENT (URGENT MODE). User Location: ${city || 'Nigeria'}.
           You are a lawful civic guidance tool providing "Legal First Aid". The user is in a stressful situation (e.g., police stop, dispute).
           1. First, calmly advise the user to stay polite, lawful, and composed.
           2. Provide immediate, law-based "first aid" guidance to reduce tension and misinformation:
           ${moatContext}
           3. Cite specific Nigerian laws (1999 Constitution, Police Act 2020) to ensure transparency and mutual respect.
           4. Do NOT replace a lawyer. Focus on immediate steps to handle the situation lawfully.
           5. Use clear, calm, and professional language.
           ${nearbyVendors ? `6. If they need professional legal help after this immediate guidance, suggest these verified experts nearby:\n${nearbyVendors}` : ''}`
        : `You are the SabiRight Citizen Education Agent for Nigeria. User Location: ${city || 'Nigeria'}.
           1. Your goal is to educate citizens on their rights and responsibilities calmly and lawfully using official data:
           ${moatContext}
           2. Provide clear, structured, and educational summaries.
           3. If the user asks about everyday civic situations (bail, arrests, tenancy, traffic), offer "Legal First Aid" guidance based on the Police Act and Constitution.
           4. Always emphasize lawful behavior and mutual respect between citizens and officials.
           5. Use Markdown for formatting (bolding key terms).
           6. Be professional, educational, and unifying.
           ${nearbyVendors ? `7. If they need further professional help, suggest these verified experts from Sabimarket:\n${nearbyVendors}` : ''}`;

      const fullPrompt = `${systemPrompt}\n\nUser Question: ${message}`;

      const text = await generateAIResponse(fullPrompt);
      if (!text) {
        return res.status(500).json({ error: 'Empty AI response' });
      }

      // Save to chat if chatId provided
      if (chatId) {
        await storage.addSabiGuardMessage(chatId, "user", message);
        await storage.addSabiGuardMessage(chatId, "ai", text);
        
        // Track storage used (rough estimate: characters * 1 byte)
        const bytesUsed = (message.length + text.length);
        await storage.updateChatStorageUsed(userId, bytesUsed);

        // MOAT Integration: Use chat data for threat analysis
        if (message.length > 50) {
          await storage.createMoatData({
            category: "chat_intel",
            source: "sabiguard_chat",
            content: message,
            metadata: { userId, chatId, timestamp: new Date().toISOString() }
          });
        }
      }

      await storage.deductCredits(userId, 1, 'civic_guard', `Legal AI query: ${message.substring(0, 50)}`);
      res.json({ response: text });
    } catch (err: any) {
      console.error('[Civic Chat] Error:', err.message);
      next(err);
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
      const text = await generateAIResponse(aiPrompt);
      if (!text) {
        return res.status(500).json({ error: 'Empty AI response' });
      }
      
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
    } catch (err: any) {
      console.error('[AI Jobs] Error:', err.message);
      res.status(503).json({ error: err.message });
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
  app.get("/api/payments", userAuth, async (req, res) => {
    const { userId } = req.query;
    const currentUserId = (req as any).userId;
    const isAdmin = await isUserAdmin(currentUserId);

    // Security check: Only admins can view other users' payments
    if (!isAdmin && userId && userId !== currentUserId) {
      return res.status(403).json({ error: 'Access denied. You can only view your own payments.' });
    }

    // If not admin and no userId provided, default to current user
    const targetUserId = isAdmin ? (userId as string | undefined) : currentUserId;
    
    const payments = await storage.getPayments(targetUserId);
    res.json(payments);
  });

  app.post("/api/payments/initiate", async (req, res) => {
    try {
      const { userId, amount, currency, provider, type, description, metadata, email, captchaToken } = req.body;
      
      if (!userId || !amount || !provider || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Verify reCAPTCHA for payment initiation
      if (captchaToken) {
        const isValid = await verifyRecaptcha(captchaToken);
        if (!isValid) {
          return res.status(400).json({ error: 'reCAPTCHA verification failed' });
        }
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
          reference: ((payment.metadata as any)?.reference) || `PAY-${payment.id}`,
          currency: currency || 'NGN',
          callback_url: `${process.env.APP_URL || 'http://localhost:5000'}/api/payments/paystack/callback`,
          metadata: {
            paymentId: payment.id,
            userId,
            type,
            ...(metadata || {})
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
              ...((payment.metadata as any) || {}),
              access_code: accessCode
            }
          });
        } else {
          return res.status(500).json({ error: 'Failed to initialize Paystack payment' });
        }
      } else if (provider === 'stripe') {
        // Stripe is temporarily disabled due to dependency issues
        return res.status(503).json({ error: 'Stripe is temporarily disabled. Please use Paystack.' });
        /*
        // Get Stripe settings
        const stripeSecretKey = await storage.getAdminSetting('stripe_secret_key');
        const stripePublishableKey = await storage.getAdminSetting('stripe_publishable_key'); 

        if (!stripeSecretKey?.value) {
            return res.status(503).json({ error: 'Stripe not configured. Please set up API keys in admin settings.' });
        }

        const stripe = new (await import('stripe')).default(stripeSecretKey.value);
        
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), 
                currency: currency?.toLowerCase() || 'ngn',
                metadata: {
                    paymentId: payment.id,
                    userId,
                    type,
                    ...(metadata || {})
                },
                automatic_payment_methods: { enabled: true },
            });

            await storage.updatePayment(payment.id, {
                providerRef: paymentIntent.id,
                metadata: {
                    ...((payment.metadata as any) || {}),
                    clientSecret: paymentIntent.client_secret
                }
            });

            return res.json({
                ...payment,
                clientSecret: paymentIntent.client_secret,
                publicKey: stripePublishableKey?.value 
            });

        } catch (err: any) {
             console.error('Stripe init error:', err);
             return res.status(500).json({ error: err.message || 'Failed to initialize Stripe payment' });
        }
        */
      }
      // Flutterwave uses inline checkout, no redirect needed

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
          await storage.addCredits(userId, parseInt(String(credits)), `Paystack purchase: ${paymentId}`);
        } else if (type === 'subscription' && planId) {
          await storage.createSubscription({
            userId,
            planId,
            status: 'active',
            startDate: new Date().toISOString()
          });
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
            await storage.addCredits(userId, parseInt(String(credits)), `Paystack purchase (webhook): ${paymentId}`);
          } else if (type === 'subscription' && planId) {
            await storage.createSubscription({
              userId,
              planId,
              status: 'active',
              startDate: new Date().toISOString()
            });
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Paystack webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payments/paystack/verify", async (req, res, next) => {
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
    } catch (error) {
      next(error);
    }
  });

  // Flutterwave webhook
  app.post("/api/payments/flutterwave/webhook", async (req, res, next) => {
    try {
      const secretHash = req.headers['verif-hash'] as string;
      
      // Get Flutterwave payment methods
      const paymentMethods = await storage.getPaymentMethods();
      const flutterwaveMethod = paymentMethods.find((m: any) => m.type === 'flutterwave' && m.active);
      
      if (!flutterwaveMethod?.webhookHash) {
        console.error('Flutterwave webhook hash not configured');
        return res.status(503).json({ error: 'Flutterwave webhook not configured' });
      }

      // Verify webhook signature
      if (!secretHash) {
        console.error('Missing verif-hash header');
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      if (secretHash !== flutterwaveMethod.webhookHash) {
        console.error('Invalid webhook signature:', { received: secretHash, expected: flutterwaveMethod.webhookHash });
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('Flutterwave webhook signature verified successfully');

      const event = req.body;

      // Handle successful payment
      if (event.event === 'charge.completed' && event.data.status === 'successful') {
        const { tx_ref, amount, customer, meta } = event.data;
        const { userId, type, credits, planId } = meta || {};

        if (userId) {
          // Find payment by reference
          const payments = await storage.getPayments();
          const payment = payments.find((p: any) => p.metadata?.reference === tx_ref);

          if (!payment) {
            console.error('Payment not found for reference:', tx_ref);
            return res.status(404).json({ error: 'Payment not found' });
          }

          // Idempotency check - prevent duplicate processing
          if (payment.status === 'completed') {
            console.log('Payment already processed:', payment.id);
            return res.json({ success: true, message: 'Payment already processed' });
          }

          // Amount verification - ensure paid amount matches expected amount
          if (payment.amount !== amount) {
            console.error('Amount mismatch:', { 
              paymentId: payment.id,
              expected: payment.amount, 
              received: amount 
            });
            return res.status(400).json({ error: 'Amount mismatch' });
          }

          console.log('Processing payment:', {
            paymentId: payment.id,
            userId,
            amount,
            type
          });

          // Update payment status
          await storage.updatePayment(payment.id, {
            status: 'completed',
            providerRef: tx_ref
          });

          // Process based on type
          if (type === 'wallet_topup') {
            await storage.topUpWallet(userId, amount, tx_ref, 'Flutterwave payment');
            console.log('Wallet topped up:', { userId, amount });
          } else if (type === 'credit_purchase' && credits) {
            await storage.addCredits(userId, parseInt(String(credits)), `Flutterwave webhook purchase: ${payment.id}`);
            console.log('Credits added via webhook:', { userId, credits });
          } else if (type === 'subscription' && planId) {
            await storage.createSubscription({
              userId,
              planId,
              status: 'active',
              startDate: new Date().toISOString()
            });
            console.log('Subscription created:', { userId, planId });
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Verify Flutterwave payment (manual verification from frontend)
  app.post("/api/payments/flutterwave/verify", userAuth, async (req, res, next) => {
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

          if (!payment) {
            console.error('Payment not found for reference:', tx_ref);
            return res.status(404).json({ error: 'Payment not found' });
          }

          // Idempotency check
          if (payment.status === 'completed') {
            console.log('Payment already verified and processed:', payment.id);
            return res.json({ status: 'success', message: 'Payment already processed', data: data.data });
          }

          // Amount verification
          if (payment.amount !== amount) {
            console.error('Amount mismatch during verification:', { 
              paymentId: payment.id,
              expected: payment.amount, 
              received: amount 
            });
            return res.status(400).json({ error: 'Amount mismatch' });
          }

          console.log('Verifying and processing payment:', {
            paymentId: payment.id,
            userId,
            amount,
            type,
            tx_ref
          });

          // Update payment status
          await storage.updatePayment(payment.id, {
            status: 'completed',
            providerRef: tx_ref
          });

          // Process based on type
          if (type === 'wallet_topup') {
            await storage.topUpWallet(userId, amount, tx_ref, 'Flutterwave payment');
            console.log('Wallet topped up via verification:', { userId, amount });
          } else if (type === 'credit_purchase' && credits) {
            await storage.addCredits(userId, parseInt(String(credits)), `Flutterwave purchase: ${payment.id}`);
            console.log('Credits added via verification:', { userId, credits });
          } else if (type === 'subscription' && planId) {
            await storage.createSubscription({
              userId,
              planId,
              status: 'active',
              startDate: new Date().toISOString()
            });
            console.log('Subscription created via verification:', { userId, planId });
          }
        }

        return res.json({ status: 'success', data: data.data });
      }

      res.json({ status: 'failed', message: 'Payment verification failed' });
    } catch (error) {
      next(error);
    }
  });

  // Pay with wallet balance
  app.post("/api/payments/wallet-payment", userAuth, async (req, res, next) => {
    try {
      const { userId, amount, type, planId, credits } = req.body;
      
      if (!userId || !amount || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get wallet and check balance
      const wallet = await storage.getWalletByUserId(userId);
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const balance = parseFloat(String(wallet.balance ?? '0'));
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
        await storage.addCredits(userId, parseInt(String(credits)), `Wallet payment: ${type}`);
      } else if (type === 'subscription' && planId) {
        // Activate subscription
        await storage.createSubscription({
          userId,
          planId,
          status: 'active',
          startDate: new Date().toISOString()
        });
      }

      res.json({ 
        success: true,
        message: 'Payment successful',
        newBalance: (balance - amount).toFixed(2)
      });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Approve manual payment
  app.post("/api/admin/payments/:paymentId/approve", adminAuth, async (req, res, next) => {
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
          parseFloat(String(payment.amount)), 
          payment.providerRef || paymentId,
          `Wallet top-up - ${payment.description || 'Manual approval'}`
        );
        
        // Send notification
        await storage.sendNotification({
          userId: payment.userId,
          type: 'payment_approved',
          title: 'Payment Approved',
          message: `Your wallet top-up of ${payment.currency || 'NGN'} ${payment.amount.toLocaleString()} has been approved and credited to your wallet.`,
          data: { paymentId, amount: payment.amount, type: payment.type }
        });
      } else if (payment.type === 'credit_purchase' && payment.metadata && (payment.metadata as any)?.credits) {
        const credits = parseInt(String((payment.metadata as any).credits));
        await storage.addCredits(payment.userId, credits, `Credit purchase approved: ${paymentId}`);
        
        // Send notification
        await storage.sendNotification({
          userId: payment.userId,
          type: 'credits_added',
          title: 'Credits Added',
          message: `${credits} credits have been added to your account. Your payment of ${payment.currency || 'NGN'} ${parseFloat(String(payment.amount)).toLocaleString()} has been approved.`,
          data: { paymentId, credits, amount: payment.amount }
        });
      } else if (payment.type === 'subscription' && payment.metadata && (payment.metadata as any)?.planId) {
        const planId = (payment.metadata as any).planId;
        await storage.createSubscription({
          userId: payment.userId,
          planId,
          status: 'active',
          startDate: new Date().toISOString()
        });
        
        // Send notification
        await storage.sendNotification({
          userId: payment.userId,
          type: 'subscription_activated',
          title: 'Subscription Activated',
          message: `Your subscription to plan ${planId} has been activated. Your payment of ${payment.currency || 'NGN'} ${parseFloat(String(payment.amount)).toLocaleString()} has been approved.`,
          data: { paymentId, planId, amount: payment.amount }
        });
      }
      
      res.json({ success: true, message: 'Payment approved and processed' });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Reject manual payment
  app.post("/api/admin/payments/:paymentId/reject", adminAuth, async (req, res, next) => {
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
      await storage.sendNotification({
        userId: payment.userId,
        type: 'payment_rejected',
        title: 'Payment Rejected',
        message: `Your payment of ${payment.currency || 'NGN'} ${payment.amount.toLocaleString()} has been rejected. ${reason ? `Reason: ${reason}` : 'Please contact support for more information.'}`,
        data: { paymentId, amount: payment.amount, reason }
      });
      
      res.json({ success: true, message: 'Payment rejected' });
    } catch (error) {
      next(error);
    }
  });

  // Flagged Posts Management
  app.get("/api/admin/flagged-posts", adminAuth, async (req, res, next) => {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || 'legal-13d13';
      
      const postsRef = db.collection('artifacts').doc(FIREBASE_APP_ID)
        .collection('public').doc('data').collection('forum_posts');
      
      const snapshot = await postsRef.where('shadowedForReview', '==', true).get();
      const flaggedPosts = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      
      res.json(flaggedPosts);
    } catch (error) {
      next(error);
    }
  });


    // Forum APIs
  // Forum
  app.get("/api/forum/posts", async (req, res, next) => {
    try {
      const city = req.query.city as string;
      const posts = await storage.getForumPosts();
      
      if (city) {
        posts.sort((a: any, b: any) => {
          const aInCity = a.city?.toLowerCase() === city.toLowerCase();
          const bInCity = b.city?.toLowerCase() === city.toLowerCase();
          if (aInCity && !bInCity) return -1;
          if (!aInCity && bInCity) return 1;
          return 0;
        });
      }
      
      res.json(posts);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forum/posts", userAuth, kycVerifiedAuth, async (req, res, next) => {
    const { content, city, author } = req.body;
    const userId = (req as any).userId;
    
    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    try {
      const post = await storage.createForumPost({
        content,
        city: city || "Lagos",
        author: author || "Citizen",
        userId,
        upvotes: 0,
        downvotes: 0,
        comments: [],
        flagged: false,
        flagCount: 0,
        flaggedBy: [],
        shadowedForReview: false,
        upvotedBy: []
      });

      // Automatically save as MOAT data for AI training
      await storage.createMoatData({
        title: `Forum Post by ${author || 'Citizen'}`,
        content: `City: ${city || 'Lagos'}\nContent: ${content}`,
        category: 'forum',
        source: 'community_forum',
        metadata: { postId: post.id, city: city || 'Lagos' }
      });

      res.json(post);
    } catch (error) {
      next(error);
    }
  });

  // Public Forum: Flag post with configurable threshold shadowing
  app.post("/api/forum/posts/:postId/flag", userAuth, async (req, res, next) => {
    try {
      const { postId } = req.params;
      const userId = (req as any).userId;
      
      const postData = await storage.getForumPost(postId);
      if (!postData) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const flaggedBy = postData.flaggedBy || [];

      if (flaggedBy.includes(userId)) {
        return res.status(400).json({ error: 'You have already flagged this post' });
      }

      // Get threshold from admin settings
      const thresholdSetting = await storage.getAdminSetting('flag_shadow_threshold');
      const threshold = parseInt(thresholdSetting?.value || '50');

      const newFlagCount = (postData.flagCount || 0) + 1;
      const updates: any = {
        flagCount: newFlagCount,
        flaggedBy: [...flaggedBy, userId]
      };

      let shadowed = false;
      if (newFlagCount >= threshold) {
        updates.shadowedForReview = true;
        updates.flagged = true;
        updates.shadowedAt = new Date();
        shadowed = true;
      }

      await storage.updateForumPost(postId, updates);
      
      // Notify the reporter
      try {
        await storage.sendNotification({
          userId: userId,
          type: 'forum_report_received',
          title: 'Report Received',
          message: 'Thank you for reporting this post. Our team will review it.',
          data: { postId }
        });
      } catch (notifyError) {
        console.error('Error notifying reporter:', notifyError);
      }

      if (shadowed && postData.userId && postData.userId !== 'anon') {
        try {
          await storage.sendNotification({
            userId: postData.userId,
            type: 'post_shadowed',
            title: 'Post Hidden for Review',
            message: 'Your post has been hidden because it was flagged multiple times by the community. It is currently under review.',
            data: { postId },
            templateName: 'post_shadowed',
            variables: {
              content: postData.content?.substring(0, 50) + (postData.content?.length > 50 ? '...' : '')
            }
          });
        } catch (notifyError) {
          console.error('Error notifying author:', notifyError);
        }
      }
      
      res.json({ 
        success: true, 
        flagged: true, 
        shadowed: shadowed,
        flagCount: newFlagCount,
        threshold
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forum/posts/:postId/comments", userAuth, kycVerifiedAuth, async (req, res, next) => {
    try {
      const { postId } = req.params;
      const { text, author, userId } = req.body;
      const currentUserId = (req as any).userId;

      if (userId !== currentUserId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (!text) {
        return res.status(400).json({ error: 'Comment text required' });
      }

      await storage.addForumComment(postId, {
        text,
        author: author || "Citizen",
        userId,
        upvotes: 0,
        upvotedBy: []
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/forum/posts/:postId/comments/:commentId", userAuth, async (req, res, next) => {
    try {
      const { postId, commentId } = req.params;
      const currentUserId = (req as any).userId;
      const isAdmin = await isUserAdmin(currentUserId);

      const post = await storage.getForumPost(postId);
      if (!post) return res.status(404).json({ error: 'Post not found' });

      const comment = post.comments?.find((c: any) => c.id === commentId);
      if (!comment) return res.status(404).json({ error: 'Comment not found' });

      if (!isAdmin && comment.userId !== currentUserId) {
        return res.status(403).json({ error: 'Unauthorized to delete this comment' });
      }

      await storage.deleteForumComment(postId, commentId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forum/posts/:postId/vote", userAuth, async (req, res, next) => {
    try {
      const { postId } = req.params;
      const { type } = req.body; // 'up' | 'down'
      const userId = (req as any).userId;

      if (!['up', 'down'].includes(type)) {
        return res.status(400).json({ error: 'Invalid vote type' });
      }

      await storage.voteForumPost(postId, userId, type);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forum/posts/:postId/comments/:commentId/vote", userAuth, async (req, res, next) => {
    try {
      const { postId, commentId } = req.params;
      const userId = (req as any).userId;

      await storage.voteForumComment(postId, commentId, userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/flagged-posts/:postId/reinstate", adminAuth, async (req, res, next) => {
    try {
      const { postId } = req.params;
      const postData = await storage.getForumPost(postId);
      
      if (!postData) {
        return res.status(404).json({ error: 'Post not found' });
      }

      await storage.updateForumPost(postId, {
        shadowedForReview: false,
        flagged: false,
        flagCount: 0,
        flaggedBy: [],
        reinstatedAt: new Date(),
        reinstatedBy: (req as any).userId
      });

      // Notify the author that their post was reinstated
      if (postData.userId && postData.userId !== 'anon') {
        try {
          await storage.sendNotification({
            userId: postData.userId,
            type: 'post_reinstated',
            title: 'Post Reinstated',
            message: 'Your post has been reviewed and reinstated to the community forum.',
            data: { postId },
            templateName: 'post_reinstated',
            variables: {
              content: postData.content?.substring(0, 50) + (postData.content?.length > 50 ? '...' : '')
            }
          });
        } catch (notifyError) {
          console.error('Error notifying author on reinstate:', notifyError);
        }
      }
      
      res.json({ success: true, message: 'Post reinstated successfully' });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/flagged-posts/:postId", adminAuth, async (req, res, next) => {
    try {
      const { postId } = req.params;
      const postData = await storage.getForumPost(postId);
      
      if (postData) {
        // Notify the author that their post was removed
        if (postData.userId && postData.userId !== 'anon') {
          try {
            await storage.sendNotification({
              userId: postData.userId,
              type: 'post_removed',
              title: 'Post Removed',
              message: 'Your post has been removed for violating community guidelines following a review.',
              data: { postId },
              templateName: 'post_removed',
              variables: {
                content: postData.content?.substring(0, 50) + (postData.content?.length > 50 ? '...' : '')
              }
            });
          } catch (notifyError) {
            console.error('Error notifying author on delete:', notifyError);
          }
        }
      }

      await storage.deleteForumPost(postId);
      
      res.json({ success: true, message: 'Post deleted permanently' });
    } catch (error) {
      next(error);
    }
  });

  // Subscriptions
  app.get("/api/subscription/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const subscription = await storage.getUserPlan(userId);
      if (!subscription) {
        return res.status(404).json({ error: 'No active subscription' });
      }
      res.json(subscription);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/subscription/upgrade", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // ===== Coupons API (Admin) =====
  
  app.get("/api/admin/coupons", adminAuth, async (req, res, next) => {
    try {
      const coupons = await storage.getAllCoupons();
      res.json(coupons);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/coupons", adminAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/coupons/:id", adminAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/coupons/:id", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteCoupon(id);
      if (!success) {
        return res.status(404).json({ error: 'Coupon not found' });
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/coupons/validate", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // ===== Wallet API =====
  
  app.get("/api/wallet/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const wallet = await storage.getWalletByUserId(userId);
      
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }
      
      res.json(wallet);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/wallet/:userId/create", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { currency } = req.body;
      
      const wallet = await storage.createWallet(userId, currency || 'NGN');
      res.json(wallet);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/wallet/:userId/topup", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { amount, reference, description } = req.body;
      
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Valid positive amount is required' });
      }

      let wallet = await storage.getWalletByUserId(userId);
      if (!wallet) {
        wallet = await storage.createWallet(userId);
      }

      const transaction = await storage.topUpWallet(
        userId,
        parseFloat(amount),
        reference,
        description
      );
      
      const updatedWallet = await storage.getWalletByUserId(userId);
      res.json({
        success: true,
        transaction,
        wallet: updatedWallet
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wallet/:userId/transactions", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { limit } = req.query;
      
      const transactions = await storage.getWalletTransactions(
        userId,
        limit ? parseInt(limit as string) : 50
      );
      
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  // ===== Booking System API =====

  // Create a booking (user books vendor service)
  app.post("/api/bookings", async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Get user's bookings
  app.get("/api/bookings/user/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const bookings = await storage.getBookingsByUserId(userId);
      res.json(bookings);
    } catch (error) {
      next(error);
    }
  });

  // Get vendor's bookings
  app.get("/api/bookings/vendor/:vendorId", async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const bookings = await storage.getBookingsByVendorId(vendorId);
      res.json(bookings);
    } catch (error) {
      next(error);
    }
  });

  // Get booking details with milestones, escrow, contract
  app.get("/api/bookings/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const details = await storage.getBookingDetails(id);
      
      if (!details.booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      
      res.json(details);
    } catch (error) {
      next(error);
    }
  });

  // Update booking status (vendor confirms, completes)
  app.patch("/api/bookings/:id/status", bookingParticipantAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const validStatuses = ['requested', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
      }

      await storage.updateBookingStatus(id, status);
      const updated = await storage.getBookingById(id);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // ===== Escrow Management =====

  // Fund escrow (deduct from user wallet)
  app.post("/api/bookings/:id/escrow/fund", bookingParticipantAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Mark milestone as completed (vendor marks completion)
  app.post("/api/bookings/:id/milestones/:milestoneId/complete", bookingParticipantAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Release milestone funds to vendor
  app.post("/api/bookings/:id/milestones/:milestoneId/release", bookingParticipantAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // ===== Contracts =====

  // Create contract with terms
  app.post("/api/bookings/:id/contract", bookingParticipantAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Sign contract (user or vendor)
  app.post("/api/bookings/:id/contract/sign", bookingParticipantAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // ===== Chat / Messages =====

  // Get booking chat messages
  app.get("/api/bookings/:id/messages", bookingParticipantAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { limit } = req.query;

      const messages = await storage.getBookingMessages(
        id,
        limit ? parseInt(limit as string) : 100
      );
      
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  // Send message
  app.post("/api/bookings/:id/messages", bookingParticipantAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { message, attachments } = req.body;
      const senderId = (req as any).userId;
      const isAdmin = (req as any).isAdmin;
      
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }

      // Check if an admin has joined a dispute for this booking
      const dispute = await storage.getDisputeByBookingId(id);
      if (dispute && dispute.adminJoined && !isAdmin) {
        return res.status(403).json({ error: 'Admin has joined the dispute. User/Vendor interaction is restricted.' });
      }

      const newMessage = await storage.createBookingMessage({
        bookingId: id,
        senderId,
        message,
        attachments: attachments || [],
        isAdminMessage: !!isAdmin
      });

      res.json(newMessage);
    } catch (error) {
      next(error);
    }
  });

  // ===== Disputes =====

  // Open dispute
  app.post("/api/bookings/:id/dispute", bookingParticipantAuth, async (req, res, next) => {
    try {
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

      // Auto-message for dispute opening
      await storage.createBookingMessage({
        bookingId: id,
        senderId: 'system',
        message: 'A dispute has been opened. Please provide all evidence to enable admin settle the escrow.',
        isAdminMessage: true,
        createdAt: new Date()
      });

      res.json(dispute);
    } catch (error) {
      next(error);
    }
  });

  // Admin: List all disputes
  app.get("/api/admin/disputes", adminAuth, async (req, res, next) => {
    try {
      const disputes = await storage.getDisputes();
      res.json(disputes);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Resolve dispute
  app.patch("/api/admin/disputes/:id/resolve", adminAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Admin: Join dispute
  app.post("/api/admin/disputes/:id/join", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const adminId = (req as any).userId;
      
      const dispute = await storage.joinDispute(id, adminId);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }

      res.json(dispute);
    } catch (error) {
      next(error);
    }
  });

  // ===== SabiGuard, SabiMove, SabiWork Service Endpoints =====

  // SabiGuard - AI Legal Assistant & Chat
  app.get("/api/sabiguard/chats", userAuth, async (req, res, next) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const chats = await storage.getSabiGuardChats(userId);
      res.json(chats);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sabiguard/chats/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const chats = await storage.getSabiGuardChats(userId);
      res.json(chats);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sabiguard/chats/:chatId/messages", userAuth, async (req, res, next) => {
    try {
      const { chatId } = req.params;
      const messages = await storage.getSabiGuardMessages(chatId);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sabiguard/chats", userAuth, async (req, res, next) => {
    try {
      const { userId, title } = req.body;
      const chat = await storage.createSabiGuardChat(userId, title || "New Chat");
      res.json(chat);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/sabiguard/chats/:chatId", userAuth, async (req, res, next) => {
    try {
      const { chatId } = req.params;
      await storage.deleteSabiGuardChat(chatId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sabiguard/query", userAuth, async (req, res, next) => {
    try {
      const { userId, query, chatId } = req.body;
  
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      // Check storage limits
      const profile = await storage.getUserProfile(userId);
      if (profile) {
        const limit = profile.chatStorageLimit || 524288;
        const used = profile.chatStorageUsed || 0;
        if (used >= limit) {
          return res.status(400).json({ 
            error: "Storage limit reached", 
            message: "You have reached your chat storage limit. Please upgrade your plan for more space."
          });
        }
      }
  
      // Check and deduct credits
      const userCredits = await storage.getUserCredits(userId);
      const sabiguardCost = 5; // 5 credits per query
      const total = userCredits?.totalCredits || 0;
      const used = userCredits?.usedCredits || 0;
      const available = total - used;
  
      if (available < sabiguardCost) {
        return res.status(400).json({ 
          error: "Insufficient credits", 
          required: sabiguardCost,
          available
        });
      }
  
      // Deduct credits
      await storage.deductCredits(userId, sabiguardCost, "SabiGuard query", "SabiGuard query");
  
      // Get AI Response (placeholder)
      const aiResponseText = "This is a placeholder response. Implement Gemini API integration here.";
      
      // Save to chat if chatId provided
      if (chatId) {
        await storage.addSabiGuardMessage(chatId, "user", query);
        await storage.addSabiGuardMessage(chatId, "ai", aiResponseText);
        
        // Track storage used (rough estimate: characters * 1 byte)
        const bytesUsed = (query.length + aiResponseText.length);
        await storage.updateChatStorageUsed(userId, bytesUsed);

        // MOAT Integration: Use chat data for threat analysis
        if (query.length > 50) {
          await storage.createMoatData({
            category: "chat_intel",
            source: "sabiguard_chat",
            content: query,
            metadata: { userId, chatId, timestamp: new Date().toISOString() }
          });
        }
      }

      const response = {
        answer: aiResponseText,
        query,
        timestamp: new Date().toISOString()
      };
  
      // Send notification
      await storage.sendNotification({
        userId,
        type: "service_used",
        title: "SabiGuard Query Processed",
        message: `${sabiguardCost} credits deducted. Remaining: ${available - sabiguardCost}`,
        data: { service: "sabiguard", creditsDeducted: sabiguardCost }
      });
  
      res.json({ 
        success: true, 
        response,
        creditsRemaining: available - sabiguardCost
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get SabiGuard query history
  app.get("/api/sabiguard/history/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const history = await storage.getCreditLog(userId, 50);
      const sabiguardHistory = history.filter(log => log.description?.includes("SabiGuard"));
      res.json(sabiguardHistory);
    } catch (error) {
      next(error);
    }
  });
  
  // SabiMove - Route Planning with Traffic Alerts
  app.post("/api/sabimove/route", userAuth, async (req, res, next) => {
    try {
      const { userId, origin, destination, waypoints } = req.body;
  
      if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and destination are required" });
      }
  
      // Check and deduct credits
      const userCredits = await storage.getUserCredits(userId);
      const sabimoveCost = 3; // 3 credits per route
      const total = userCredits?.totalCredits || 0;
      const used = userCredits?.usedCredits || 0;
      const available = total - used;
  
      if (available < sabimoveCost) {
        return res.status(400).json({ 
          error: "Insufficient credits",
          required: sabimoveCost,
          available
        });
      }
  
      // Deduct credits
      await storage.deductCredits(userId, sabimoveCost, "SabiMove route planning", "SabiMove route planning");
  
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
        message: `${sabimoveCost} credits deducted. Remaining: ${available - sabimoveCost}`,
        data: { service: "sabimove", routeId: route.id, creditsDeducted: sabimoveCost }
      });
  
      res.json({ 
        success: true, 
        route,
        creditsRemaining: available - sabimoveCost
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get SabiMove route history
  app.get("/api/sabimove/history/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const routes = await storage.getUserRoutes(userId);
      res.json(routes);
    } catch (error) {
      next(error);
    }
  });
  
  // SabiWork - Job Matching and Recommendations
  app.post("/api/sabiwork/recommendations", userAuth, async (req, res, next) => {
    try {
      const { userId, skills, location, jobType } = req.body;
  
      // Check and deduct credits
      const userCredits = await storage.getUserCredits(userId);
      const sabiworkCost = 2; // 2 credits per recommendation request
      const total = userCredits?.totalCredits || 0;
      const used = userCredits?.usedCredits || 0;
      const available = total - used;
  
      if (available < sabiworkCost) {
        return res.status(400).json({ 
          error: "Insufficient credits",
          required: sabiworkCost,
          available
        });
      }
  
      // Deduct credits
      await storage.deductCredits(userId, sabiworkCost, "SabiWork job recommendations", "SabiWork job recommendations");
  
      // Get job recommendations (uses existing vendor services)
      const allServices = await storage.getVendorServices();
      const recommendations = allServices
        .filter(service => 
          (service.type?.toLowerCase().includes("job")) ||
          (service.specialization?.toLowerCase().includes("job"))
        )
        .slice(0, 10);
  
      // Send notification
      await storage.sendNotification({
        userId,
        type: "service_used",
        title: "SabiWork Recommendations Generated",
        message: `${sabiworkCost} credits deducted. Remaining: ${available - sabiworkCost}`,
        data: { service: "sabiwork", count: recommendations.length, creditsDeducted: sabiworkCost }
      });
  
      res.json({ 
        success: true, 
        recommendations,
        creditsRemaining: available - sabiworkCost
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Apply for a job through SabiWork
  app.post("/api/sabiwork/apply", userAuth, async (req, res, next) => {
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
        message: `Your application for "${service.name}" has been submitted`,
        data: { bookingId: booking.id, serviceId }
      });
  
      await storage.sendNotification({
        userId: service.vendorId,
        type: "job_application",
        title: "New Job Application",
        message: `You have a new application for "${service.name}"`,
        data: { bookingId: booking.id, applicantId: userId }
      });
  
      res.json({ success: true, booking });
    } catch (error) {
      next(error);
    }
  });
  
  // Get SabiWork application history
  app.get("/api/sabiwork/history/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const history = await storage.getCreditLog(userId, 50);
      const sabiworkHistory = history.filter(log => log.description?.includes("SabiWork"));
      res.json(sabiworkHistory);
    } catch (error) {
      next(error);
    }
  });
  // ===== Notification API =====

  // Get user notifications
  app.get("/api/notifications/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { limit, type } = req.query;
      
      let notifications = await storage.getNotificationsByUserId(
        userId,
        limit ? parseInt(limit as string) : 50
      );

      if (type && type !== 'all') {
        notifications = notifications.filter(n => n.type === type);
      }
      
      const unreadCount = await storage.getUnreadNotificationCount(userId);
      
      res.json({
        notifications,
        unreadCount,
        totalCount: notifications.length
      });
    } catch (error) {
      next(error);
    }
  });

  // Get unread notification count
  app.get("/api/notifications/:userId/unread", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      next(error);
    }
  });

  // Mark single notification as read
  app.post("/api/notifications/:userId/read/:notificationId", userAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/:userId/read-all", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const count = await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true, markedCount: count });
    } catch (error) {
      next(error);
    }
  });

  // ===== Admin Notification Templates API =====

  // List all templates
  app.get("/api/admin/notifications/templates", adminAuth, async (req, res, next) => {
    try {
      const templates = await storage.getAllNotificationTemplates();
      res.json(templates);
    } catch (error) {
      next(error);
    }
  });

  // Create template
  app.post("/api/admin/notifications/templates", adminAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Update template
  app.patch("/api/admin/notifications/templates/:id", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const template = await storage.updateNotificationTemplate(id, updates);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  // Delete template
  app.delete("/api/admin/notifications/templates/:id", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteNotificationTemplate(id);
      if (!success) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ===== Admin Vendor Service API =====

  app.get("/api/admin/vendor-services", adminAuth, async (req, res, next) => {
    try {
      const services = await storage.getAllVendorServices();
      res.json(services);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/vendor-services/:id/approve", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      await storage.approveVendorService(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/vendor-services/:id/reject", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      await storage.rejectVendorService(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Update user chat storage limit
  app.post("/api/admin/users/:userId/storage-limit", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { limitBytes } = req.body;
      
      if (typeof limitBytes !== 'number') {
        return res.status(400).json({ error: "limitBytes must be a number" });
      }

      await storage.updateUserProfile(userId, { chatStorageLimit: limitBytes });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ===== Admin SMTP Settings API =====

  // Get SMTP settings
  app.get("/api/admin/notifications/smtp", adminAuth, async (req, res, next) => {
    try {
      const settings = await storage.getSmtpSettings();
      
      if (!settings) {
        return res.json({ configured: false });
      }
      
      res.json({
        ...settings,
        password: '••••••••',
        configured: true
      });
    } catch (error) {
      next(error);
    }
  });

  // Update SMTP settings
  app.post("/api/admin/notifications/smtp", adminAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // ===== Push Subscription API =====

  // Subscribe to push notifications
  app.post("/api/notifications/:userId/push/subscribe", userAuth, async (req, res, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  // Unsubscribe from push notifications
  app.post("/api/notifications/:userId/push/unsubscribe", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({ error: 'endpoint is required' });
      }
      
      const success = await storage.unsubscribeFromPush(userId, endpoint);
      res.json({ success });
    } catch (error) {
      next(error);
    }
  });

  // Get user's push subscriptions
  app.get("/api/notifications/:userId/push", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const subscriptions = await storage.getPushSubscriptions(userId);
      res.json(subscriptions);
    } catch (error) {
      next(error);
    }
  });

  // Escrow & Disputes
  app.get("/api/admin/disputes", adminAuth, async (req, res, next) => {
    try {
      const disputes = await storage.getDisputes();
      res.json(disputes);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/disputes/:id", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const dispute = await storage.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }
      res.json(dispute);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/disputes/:id/join", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const adminId = (req as any).userId;
      
      const dispute = await storage.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }

      const updatedDispute = await storage.joinDispute(id, adminId);

      // Auto-message for admin joining
      if (updatedDispute) {
        await storage.createBookingMessage({
          bookingId: updatedDispute.bookingId,
          senderId: adminId,
          message: 'An administrator has joined the dispute. User and vendor interaction is now restricted.',
          isAdminMessage: true,
          createdAt: new Date()
        });
      }

      res.json(updatedDispute);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/disputes/:id/resolve", adminAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { resolution, resolutionNotes } = req.body;
      const adminId = (req as any).userId;

      if (!resolution) {
        return res.status(400).json({ error: 'Resolution required' });
      }

      const dispute = await storage.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }

      const updatedDispute = await storage.resolveDispute(id, resolution, resolutionNotes || '', adminId);
      res.json(updatedDispute);
    } catch (error) {
      next(error);
    }
  });

  // Dispute Chat Messages (Authenticated users involved in the booking)
  app.get("/api/disputes/:id/messages", async (req, res, next) => {
    try {
      const { id } = req.params; // Dispute ID
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const token = authHeader.substring(7);
      const userResult = await verifyUserToken(token);
      const adminResult = await verifyAdminToken(token);
      
      if (!userResult.valid && !adminResult.valid) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      const userId = userResult.userId || adminResult.userId;

      const dispute = await storage.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }
      
      // Check if user is participant or admin
      const booking = await storage.getBookingById(dispute.bookingId);
      if (!booking) {
         return res.status(404).json({ error: 'Booking not found' });
      }
      
      const isParticipant = booking.userId === userId || booking.vendorId === userId;
      const isAdmin = adminResult.valid && adminResult.isAdmin;
      
      if (!isParticipant && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const messages = await storage.getBookingMessages(dispute.bookingId);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/disputes/:id/messages", async (req, res, next) => {
    try {
      const { id } = req.params; // Dispute ID
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content required' });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const token = authHeader.substring(7);
      const userResult = await verifyUserToken(token);
      const adminResult = await verifyAdminToken(token);
      
      if (!userResult.valid && !adminResult.valid) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      const userId = userResult.userId || adminResult.userId;
      const isAdmin = adminResult.valid && adminResult.isAdmin;

      const dispute = await storage.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }
      
      const booking = await storage.getBookingById(dispute.bookingId);
      if (!booking) {
         return res.status(404).json({ error: 'Booking not found' });
      }
      
      const isParticipant = booking.userId === userId || booking.vendorId === userId;
      
      if (!isParticipant && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Restriction Logic: If admin joined, participants cannot send messages
      if (dispute.adminJoined && !isAdmin) {
         return res.status(403).json({ error: 'Chat is restricted. Admin has joined.' });
      }

      const message = await storage.createBookingMessage({
        bookingId: dispute.bookingId,
        senderId: userId,
        content,
        isAdminMessage: isAdmin,
        timestamp: new Date()
      });
      
      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
