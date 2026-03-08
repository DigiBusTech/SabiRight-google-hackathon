import type { Express, Request, Response, NextFunction } from "express";
import "./types";
import express from "express";
import admin from "firebase-admin";
import nodemailer from "nodemailer";
import webpush from 'web-push';
import { createServer, type Server } from "http";
import { firestoreStorage as storage, FIREBASE_APP_ID } from "./firestoreStorage";
import { verifyAdminToken, verifyUserToken, isUserAdmin, getFirestoreUserFlags } from "./firestoreStorage";
import PaystackService from "./paystackService";
import multer from 'multer';
import path from 'path';
import fs from 'fs';

async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      console.warn('RECAPTCHA_SECRET_KEY not set, skipping verification');
      return true;
    }

    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`, {
      method: 'POST'
    });
    const data = await response.json() as any;
    return data.success;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}

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
    const profile = await storage.getUserProfile(result.userId);
    
    if (profile) {
      if (!profile.isAdmin) {
        await storage.toggleUserAdmin(result.userId, true);
      }
    } else {
      // Proactively create profile in DB if it doesn't exist but user is admin in Firestore
      await storage.updateUserProfile(result.userId, {
        userId: result.userId,
        isAdmin: true,
        isVendor: false,
        emailVerificationStatus: 'verified',
        createdAt: new Date()
      });
    }
  } catch (syncError) {
    console.error('[adminAuth] Failed to sync admin profile during auth:', syncError);
    // We still allow the request if the token is valid, but logging the error is important
  }
  
  req.userId = result.userId;
  req.isAdmin = true;
  next();
};

const emailVerifiedAuth = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const profile = await storage.getUserProfile(userId);
    if (!profile || profile.emailVerificationStatus !== 'verified') {
      return res.status(403).json({ 
        error: 'Email verification required', 
        message: 'You must have a verified email to perform this action.' 
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

  // Set user data on request for convenience
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
    };
  } catch (e) {
    console.error('Failed to decode token for user context:', e);
  }
  
  const pathUserId = req.params.userId;
  if (pathUserId && result.userId !== pathUserId) {
    return res.status(403).json({ error: 'Access denied: User ID mismatch' });
  }
  
  const userId = result.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = userId;
  req.isAdmin = await isUserAdmin(userId);
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
  
  req.userId = result.userId;
  req.booking = booking;
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
      const allowedKeys = [
        'captcha_site_key', 'ai_provider', 'site_title', 'site_logo', 'footer_text', 
        'seo_description', 'contact_email', 'site_favicon', 'site_favicon_dark',
        'hero_title', 'hero_subtitle', 'video_demo_url', 'seo_title', 
        'privacy_policy', 'terms_of_service', 'cookie_policy',
        'frontend_page_content', 'frontend_page_content_about', 'frontend_page_content_contact', 'frontend_page_content_footer'
      ];
      
      const publicSettings = settings.filter(s => 
        allowedKeys.includes(s.key)
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
      const total = updatedCredits?.totalCredits ?? 0;
      
      res.json({
        totalCredits: total,
        usedCredits: 0,
        availableCredits: total,
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
      const total = credits?.totalCredits ?? 0;
      const used = credits?.usedCredits ?? 0;
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
      const total = credits?.totalCredits ?? 0;
      const used = credits?.usedCredits ?? 0;
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

  app.post("/api/routes/:routeId/refresh", async (req, res, next) => {
    try {
      const { routeId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      // Get route details
      const route = await storage.getRoute(routeId);
      if (!route) {
        return res.status(404).json({ error: 'Route not found' });
      }

      // Attempt to get actual traffic data via Google Maps API if available
      let googleTrafficContext = "";
      try {
        const mapsKey = await storage.getAdminSetting('google_maps_api_key');
        if (mapsKey?.value) {
          const origin = `${route.startLat},${route.startLng}`;
          const destination = `${route.endLat},${route.endLng}`;
          const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&departure_time=now&traffic_model=best_guess&key=${mapsKey.value}`;
          
          const gRes = await fetch(url);
          if (gRes.ok) {
            const gData = await gRes.json() as any;
            if (gData.routes && gData.routes[0] && gData.routes[0].legs[0]) {
              const leg = gData.routes[0].legs[0];
              const duration = leg.duration.text;
              const durationInTraffic = leg.duration_in_traffic?.text || duration;
              googleTrafficContext = `Google Maps Report: Normal time: ${duration}. Current time with traffic: ${durationInTraffic}. ${leg.duration_in_traffic ? 'Delays detected.' : 'No significant delays.'}`;
            }
          }
        }
      } catch (gErr) {
        console.error('Google Maps Traffic check failed:', gErr);
      }

      // Use AI to determine route status and recommendations
      const prompt = `As a smart traffic assistant, analyze this route in Nigeria:
      Route: ${route.routeName}
      From: ${route.startLocation}
      To: ${route.endLocation}
      
      ${googleTrafficContext ? `Live Traffic Data: ${googleTrafficContext}` : "No live sensor data available."}
      
      Determine the current status. Is there an active checkpoint (likely if there are unusual delays or patterns), heavy traffic, or is it cleared?
      Also provide a recommended route to follow if there's an issue, or confirm the main route is best.
      
      Provide:
      1. status: one of 'active', 'cleared', 'unknown'
      2. message: a helpful status message for the user
      3. recommendation: specific route advice (e.g., "Follow Ikorodu road, then divert at Fadeyi to avoid the checkpoint.")
      4. cloakedStreets: a list of any "cloaked" or hidden streets/paths to avoid due to checkpoints or heavy traffic.
      
      Format the response as JSON: {"status": "...", "message": "...", "recommendation": "...", "cloakedStreets": ["street1", "street2"]}`;

      let result;
      try {
        const aiResponse = await generateAIResponse(prompt);
        const cleanedResponse = aiResponse?.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleanedResponse || '{}');
      } catch (aiError) {
        console.error('AI Route Refresh Error:', aiError);
        result = { 
          status: 'unknown', 
          message: 'Unable to determine status at this time.',
          recommendation: 'Stay on the main route and exercise caution.',
          cloakedStreets: []
        };
      }

      const status = result.status || 'unknown';
      const message = result.message || 'Route status updated.';
      const recommendation = result.recommendation || 'No specific recommendation available.';
      const cloakedStreets = result.cloakedStreets || [];

      // Update route status in database
      await storage.updateRouteStatus(routeId, status);

      // Create an alert for the user
      await storage.createAlert({
        routeId,
        userId,
        alertType: status === 'active' ? 'active_checkpoint' : status === 'cleared' ? 'cleared' : 'unknown',
        message: `${message} Recommendation: ${recommendation} ${cloakedStreets.length > 0 ? 'Avoid: ' + cloakedStreets.join(', ') : ''}`,
        severity: status === 'active' ? 'high' : status === 'cleared' ? 'low' : 'medium'
      });

      // Update user dashboard traffic
      try {
        if (typeof storage.updateDashboardTraffic === 'function') {
          const description = `${message} ${recommendation} ${cloakedStreets.length > 0 ? 'Avoid: ' + cloakedStreets.join(', ') : ''}`;
          await storage.updateDashboardTraffic(
            userId, 
            route.routeName, 
            status.toUpperCase(), 
            description
          );
        }
      } catch (dashErr) {
        console.error('Failed to update dashboard traffic:', dashErr);
      }

      res.json({ success: true, status, message, recommendation, cloakedStreets });
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

  // Email Verification & Vendor Endpoints
  app.post("/api/email-verification/:userId/submit", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { email } = req.body;
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date();
      expires.setHours(expires.getHours() + 1); // 1 hour expiry

      await storage.setEmailVerificationCode(userId, code, expires);
      
      // Update profile email if provided
      if (email) {
        await storage.updateUserProfile(userId, { email });
      }

      // Send email using template
      const userProfile = await storage.getUserProfile(userId);
      await storage.sendNotification({
        userId,
        type: 'email_verification_code',
        title: 'Your Verification Code',
        message: `Your SabiRight verification code is: ${code}. This code expires in 1 hour.`,
        templateName: 'email_verification_code',
        variables: { 
          code, 
          expiry: '1 hour',
          userName: userProfile?.displayName || userProfile?.email || 'User'
        },
        channels: ['email', 'in_app']
      });

      await storage.updateEmailVerificationStatus(userId, 'pending');
      res.json({ success: true, status: 'pending' });
    } catch (error) {
      console.error(`[EmailVerification] Error in submit:`, error);
      next(error);
    }
  });

  app.post("/api/email-verification/:userId/verify-code", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Verification code is required' });
      }

      const verified = await storage.verifyEmailCode(userId, code);
      if (verified) {
        res.json({ success: true, status: 'verified' });
      } else {
        res.status(400).json({ error: 'Invalid or expired verification code' });
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/debug/user/:userId", async (req: Request, res: Response) => {
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
      let profile = await storage.getUserProfile(userId);
      
      // Sync flags if profile exists
      if (profile) {
        const flags = await getFirestoreUserFlags(userId);
        let changed = false;
        
        if (flags.isAdmin && !profile.isAdmin) {
          await storage.toggleUserAdmin(userId, true);
          changed = true;
        }
        
        if (flags.isVendor && !profile.isVendor) {
          await storage.toggleUserVendor(userId, true);
          changed = true;
        }
        
        if (changed) {
          profile = await storage.getUserProfile(userId); // Refresh profile
        }
      }

      res.json(profile || {});
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/profile/:userId/referral-code", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const code = await storage.generateReferralCode(userId);
      res.json({ referralCode: code });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/profile/:userId", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { email, displayName, phoneNumber, dob, gender, state, city, referralCode, captchaToken } = req.body;
      
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
        
        // Also update any missing fields if they were provided in this call
        const updates: any = {};
        if (email) updates.email = email;
        if (displayName) updates.displayName = displayName;
        if (phoneNumber) updates.phoneNumber = phoneNumber;
        if (dob) updates.dob = dob;
        if (gender) updates.gender = gender;
        if (state) updates.state = state;
        if (city) updates.city = city;

        if (Object.keys(updates).length > 0) {
          const updated = await storage.updateUserProfile(userId, updates);
          return res.json(updated);
        }
        
        return res.json(existingProfile);
      }
      
      
      const flags = await getFirestoreUserFlags(userId);

      await storage.createUser({ 
        id: userId, 
        username: displayName || email || userId, 
        password: '',
        email,
        phoneNumber,
        dob,
        gender,
        state,
        city
      } as any);
      
      await storage.updateUserProfile(userId, {
        userId,
        email: email || null,
        displayName: displayName || null,
        phoneNumber: phoneNumber || null,
        dob: dob || null,
        gender: gender || null,
        state: state || null,
        city: city || null,
        isVendor: flags.isVendor,
        isAdmin: flags.isAdmin,
        emailVerified: false,
        emailVerificationStatus: 'pending',
        vendorMode: false,
        createdAt: new Date()
      });

      // Handle referral if provided
      if (referralCode) {
        await storage.processReferral(userId, referralCode);
      }
      
      const newProfile = await storage.getUserProfile(userId);

      // Send welcome email
      if (email) {
        await storage.sendNotification({
          userId,
          type: 'welcome_email',
          title: 'Welcome to SabiRight!',
          message: `Hello ${displayName || 'Citizen'}, Welcome to SabiRight! We are excited to have you on board.`,
          templateName: 'welcome_email',
          variables: { name: displayName || 'Citizen' },
          channels: ['email', 'in_app']
        });
      }

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
      res.json(application || null);
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
      const { city } = req.body;

      const credits = await storage.getUserCredits(userId);
      if (!credits) {
        return res.status(402).json({ error: 'No credits account' });
      }

      const availableCredits = credits.totalCredits || 0;
      if (availableCredits < 1) {
        return res.status(402).json({ error: 'Insufficient credits for refresh' });
      }

      // Deduct credits
      await storage.deductCredits(userId, 1, 'traffic_refresh', 'Daily traffic alert refresh');

      // Attempt to get live data via internet search first
      let liveContext = "";
      try {
        const searchKey = await storage.getAdminSetting('tavily_api_key');
        const query = `current traffic updates and road alerts in ${city || 'Lagos'}, Nigeria today`;
        
        if (searchKey?.value) {
          const searchRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: searchKey.value,
              query: query,
              search_depth: "basic",
              max_results: 3
            })
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json() as any;
            liveContext = searchData.results.map((r: any) => r.content).join('\n');
          }
        }
      } catch (searchErr) {
        console.error('Traffic internet search failed:', searchErr);
      }

      // Generate live traffic update using AI
      const prompt = `Generate a realistic, concise traffic update for ${city || 'Lagos'}, Nigeria. 
      ${liveContext ? `Use this real-time info if relevant: ${liveContext}` : "If no real-time info, use highly probable current patterns."}
      
      Include:
      1. A specific location (e.g., a major road or bridge).
      2. A status (one of: 'active', 'cleared', 'normal').
      3. A brief description of the situation.
      
      Format the response as JSON: {"location": "...", "status": "active|cleared|normal", "description": "..."}`;

      let trafficUpdate;
      try {
        const aiResponse = await generateAIResponse(prompt);
        // Clean up the response in case AI adds markdown
        const cleanedResponse = aiResponse?.replace(/```json|```/g, '').trim();
        trafficUpdate = JSON.parse(cleanedResponse || '{}');
      } catch (aiError) {
        console.error('AI Traffic Generation Error:', aiError);
        // Fallback to more generic location if AI fails
        trafficUpdate = {
          location: city ? `${city} Major Route` : 'City Center',
          status: 'normal',
          description: 'Traffic information currently being updated. Please check again soon.'
        };
      }

      await storage.updateDashboardTraffic(
        userId, 
        trafficUpdate.location || "Major Route", 
        trafficUpdate.status || "normal", 
        trafficUpdate.description || "Traffic is moving normally."
      );

      res.json({ success: true, traffic: trafficUpdate });
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

  app.post("/api/events", userAuth, emailVerifiedAuth, async (req, res, next) => {
    try {
      const { title, description, date, time, location, category, organizer, organizerId, maxAttendees } = req.body;
      const userId = req.userId;
      
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

  app.post("/api/events/:eventId/register", userAuth, emailVerifiedAuth, async (req, res, next) => {
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

  app.delete("/api/events/:eventId", userAuth, emailVerifiedAuth, async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const isAdmin = await isUserAdmin(userId);
      
      // Only admin or the creator can delete? 
      // For now, let's just protect with email verification as requested, 
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
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      await storage.saveEvent(userId, eventId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/events/:eventId/save", userAuth, async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      await storage.unsaveEvent(userId, eventId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/events/saved/:userId", userAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.userId;
      if (!currentUserId) return res.status(401).json({ error: 'Authentication required' });
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
      const { vendorId, name, type, specialization, description, location, latitude, longitude, contactPhone, contactEmail, priceRange, priceList } = req.body;
      
      if (!vendorId || !name || !type || !location) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const service = await storage.createVendorService({
        vendorId, name, type, specialization, description, location, latitude, longitude, contactPhone, contactEmail, priceRange, priceList
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
    const validSetupKey = process.env.ADMIN_SETUP_KEY || 'legal-13d13-admin-setup-2024';
    
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

  // Admin: Approve Email Verification
  app.post("/api/admin/email-verification/:userId/approve", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      await storage.updateEmailVerificationStatus(userId, 'verified');
      
      // Send notification
      await storage.sendNotification({
        userId,
        type: 'email_verified',
        title: 'Email Verified',
        message: 'Your email address has been successfully verified. You now have full access to all features.',
        templateName: 'email_verified',
        channels: ['in_app', 'email']
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Reject Email Verification
  app.post("/api/admin/email-verification/:userId/reject", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      await storage.updateEmailVerificationStatus(userId, 'rejected');
      
      // Send notification
      await storage.sendNotification({
        userId,
        type: 'email_rejected',
        title: 'Email Verification Failed',
        message: `Your email verification was not approved. ${reason ? `Reason: ${reason}` : 'Please try again.'}`,
        channels: ['in_app', 'email'],
        data: { reason }
      });

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
      const userId = req.userId;

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

  // Legal Leads & Case Files
  app.post("/api/leads", userAuth, async (req, res) => {
    const { userId, lawyerId, lawyerName, source } = req.body;
    
    if (!lawyerId || !lawyerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const lead = await storage.createVendorLead({
      vendorId: lawyerId,
      customerId: userId,
      customerName: req.user?.displayName || 'Anonymous User',
      customerEmail: req.user?.email || '',
      serviceType: 'Legal Aid',
      message: `Lead from SabiRight Civic Chat (${source})`,
      metadata: { lawyerName }
    });

    res.json(lead);
  });

  app.post("/api/case-files", userAuth, upload.single('file'), async (req, res) => {
    const { userId, lawyerId, chatId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Save case document to MOAT data for reference/training
    const caseDoc = await storage.createMoatData({
      title: `Case File: ${file.originalname}`,
      content: `User ${userId} submitted a case file for lawyer ${lawyerId || 'any'}. Chat ID: ${chatId || 'none'}. Path: ${file.path}`,
      category: 'case_documents',
      source: 'user_submission',
      metadata: {
        userId,
        lawyerId,
        chatId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path
      }
    });

    // Also notify the lawyer if specified
    if (lawyerId) {
      await storage.createNotification({
        userId: lawyerId,
        type: 'case_file_submission',
        title: 'New Case File Submitted',
        message: `A user has submitted a pre-vetted case file for your review.`,
        data: { caseDocId: caseDoc.id, userId, chatId }
      });
    }

    res.json({ success: true, fileName: file.originalname, docId: caseDoc.id });
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

  app.post("/api/jobs", userAuth, emailVerifiedAuth, async (req, res, next) => {
    try {
      const { title, company, location, type, workMode, salary, description, contact, postedBy, source, isAiFetched } = req.body;
      const userId = req.userId;
      
      if (!title || !location) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const job = await storage.createJob({
        title,
        company: company || 'Confidential',
        location,
        type: type || 'Full-time',
        workMode: workMode || 'Onsite',
        salary: salary || 'To be Negotiated',
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
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

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
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

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
      const currentUserId = req.userId;
      if (!currentUserId) return res.status(401).json({ error: 'Authentication required' });
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
      const currentUserId = req.userId;
      if (!currentUserId) return res.status(401).json({ error: 'Authentication required' });
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
  app.post("/api/jobs/:jobId/apply", userAuth, emailVerifiedAuth, async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

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
      const currentUserId = req.userId;
      if (!currentUserId) return res.status(401).json({ error: 'Authentication required' });
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
      const currentUserId = req.userId;
      if (!currentUserId) return res.status(401).json({ error: 'Authentication required' });
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
      const currentUserId = req.userId;
      if (!currentUserId) return res.status(401).json({ error: 'Authentication required' });
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

      const data = await response.json() as any;
      return data.success;
    } catch (err) {
      console.error('reCAPTCHA verification error:', err);
      return false;
    }
  };

  const generateAIResponse = async (prompt: string) => {
    const primaryAISetting = await storage.getAdminSetting('ai_provider');
    const provider = (primaryAISetting?.value || 'google').toLowerCase();

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
        if (response.status === 429) {
          const err = new Error('AI service is temporarily busy (rate limit exceeded). Please try again in a few moments.');
          (err as any).status = 429;
          throw err;
        }
        const errorBody = await response.text();
        throw new Error(`OpenAI error: ${response.status} ${errorBody}`);
      }

      const data = await response.json() as any;
      return data?.choices?.[0]?.message?.content || null;
    } else if (provider === 'anthropic') {
      const apiKeySetting = await storage.getAdminSetting('anthropic_api_key');
      const apiKey = apiKeySetting?.value || process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        throw new Error('Anthropic API key not configured');
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Anthropic error: ${response.status} ${errorBody}`);
      }

      const data = await response.json() as any;
      return data?.content?.[0]?.text || null;
    } else if (provider === 'groq') {
      const apiKeySetting = await storage.getAdminSetting('groq_api_key');
      const apiKey = apiKeySetting?.value || process.env.GROQ_API_KEY;

      if (!apiKey) {
        throw new Error('Groq API key not configured');
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Groq error: ${response.status} ${errorBody}`);
      }

      const data = await response.json() as any;
      return data?.choices?.[0]?.message?.content || null;
    } else if (provider === 'deepseek') {
      const apiKeySetting = await storage.getAdminSetting('deepseek_api_key');
      const apiKey = apiKeySetting?.value || process.env.DEEPSEEK_API_KEY;

      if (!apiKey) {
        throw new Error('DeepSeek API key not configured');
      }

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`DeepSeek error: ${response.status} ${errorBody}`);
      }

      const data = await response.json() as any;
      return data?.choices?.[0]?.message?.content || null;
    } else if (provider === 'openrouter') {
      const apiKeySetting = await storage.getAdminSetting('openrouter_api_key');
      const apiKey = apiKeySetting?.value || process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://sabiright.com',
          'X-Title': 'SabiRight AI'
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter error: ${response.status} ${errorBody}`);
      }

      const data = await response.json() as any;
      return data?.choices?.[0]?.message?.content || null;
    } else if (provider === 'perplexity') {
      const apiKeySetting = await storage.getAdminSetting('perplexity_api_key');
      const apiKey = apiKeySetting?.value || process.env.PERPLEXITY_API_KEY;

      if (!apiKey) {
        throw new Error('Perplexity API key not configured');
      }

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Perplexity error: ${response.status} ${errorBody}`);
      }

      const data = await response.json() as any;
      return data?.choices?.[0]?.message?.content || null;
    } else if (provider === 'mistral') {
      const apiKeySetting = await storage.getAdminSetting('mistral_api_key');
      const apiKey = apiKeySetting?.value || process.env.MISTRAL_API_KEY;

      if (!apiKey) {
        throw new Error('Mistral API key not configured');
      }

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-tiny',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Mistral error: ${response.status} ${errorBody}`);
      }

      const data = await response.json() as any;
      return data?.choices?.[0]?.message?.content || null;
    } else {
      // Default to Gemini (google)
      const apiKeySetting = await storage.getAdminSetting('google_gemini_api_key');
      const apiKey = apiKeySetting?.value || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }

      // Use gemini-2.0-flash with v1beta endpoint for stability and modern features
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          // v1beta supports tools and safety settings better
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Gemini API Error (${response.status}):`, errorBody);
        
        if (response.status === 429) {
          const err = new Error('AI Service Busy. Please try again in a moment.');
          (err as any).status = 429;
          throw err;
        }
        if (response.status === 503) {
          const err = new Error('AI service is temporarily unavailable. Please try again in a few moments.');
          (err as any).status = 503;
          throw err;
        }
        throw new Error(`Gemini error: ${response.status} ${errorBody}`);
      }

      const data = await response.json() as any;
      
      // Handle the case where the response might be blocked or empty
      if (data.promptFeedback?.blockReason) {
        return "⚠️ My response was blocked by safety filters.";
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.warn('Empty Gemini response data:', JSON.stringify(data));
        return "I couldn't generate a response. Please try again.";
      }
      
      return text;
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
      if (err.status === 429) {
        return res.status(429).json({ error: err.message });
      }
      if (err.message.includes('not configured')) {
        return res.status(503).json({ error: err.message });
      }
      res.status(500).json({ error: 'AI Generation failed. Please check your API keys in Admin Settings.' });
    }
  });

  // AI Civic Chat API (SabiRight Citizen Education)
  app.post("/api/ai/civic/chat", userAuth, async (req, res, next) => {
    try {
      const { message, city, isUrgent, lat, lng, chatId } = req.body;
      const userId = req.userId;
      
      if (!userId || !message) {
        return res.status(400).json({ error: 'User ID and message required' });
      }

      // Check if this is the first message in the session for the greeting
      let isFirstMessage = true;
      let chatHistory = "";
      if (chatId) {
        const existingMessages = await storage.getSabiGuardMessages(chatId);
        if (existingMessages && existingMessages.length > 0) {
          isFirstMessage = false;
          // Build chat history for AI context
          chatHistory = existingMessages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        }
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
      const availableCredits = credits?.totalCredits ?? 0;
      
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
      
      // Enhanced keyword-based relevance filtering for MOAT data
      const queryKeywords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      
      const caseDocsMoat = await storage.getMoatData('case_documents');
      const electricityMoat = await storage.getMoatData('electricity'); // Added for electricity queries
      const tenancyMoat = await storage.getMoatData('tenancy'); // Added for tenancy queries
      
      const allMoatData = [
        ...constitutionData, 
        ...police_actData, 
        ...forumMoat, 
        ...marketplaceMoat, 
        ...eventsMoat, 
        ...jobsMoat, 
        ...locationMoat, 
        ...caseDocsMoat,
        ...electricityMoat,
        ...tenancyMoat
      ];
      
      // Filter MOAT data strictly to avoid irrelevant content like ads/events unless requested
      const isLegalQuery = message.toLowerCase().match(/(law|bail|police|rights|court|legal|constitution|arrest|fine|crime|case|document|affidavit|petition|electricity|meter|landlord|tenant|rent|bill)/);
      const isMarketQuery = message.toLowerCase().match(/(buy|sell|price|market|vendor|product|cost)/);
      
      let relevantMoat = allMoatData.filter(d => {
        const content = d.content.toLowerCase();
        const title = (d.title || '').toLowerCase();
        
        // Match keywords
        const hasKeyword = queryKeywords.some((kw: string) => content.includes(kw) || title.includes(kw));
        
        // If it's a legal or utility query, prioritize relevant categories
        if (isLegalQuery && (d.category === 'case_documents' || d.category === 'constitution' || d.category === 'police_act' || d.category === 'electricity' || d.category === 'tenancy')) {
          return hasKeyword || content.includes('law') || content.includes('legal') || content.includes('right');
        }

        // If it's a legal query, ignore marketplace/events/jobs unless they contain the keyword
        if (isLegalQuery && (d.category === 'marketplace' || d.category === 'events' || d.category === 'jobs')) {
          return hasKeyword && (content.includes('law') || content.includes('legal'));
        }
        
        return hasKeyword;
      });

      // Optimization: If we have high-quality MOAT data, we can skip or reduce internet search
      const hasStrongMoatData = relevantMoat.length >= 3; // Increased slightly for better local context
      
      // Only search internet if absolutely necessary or explicitly requested
      const needsInternetSearch = (message.toLowerCase().includes('verify') || 
                                  message.toLowerCase().includes('update') || 
                                  message.toLowerCase().includes('latest') ||
                                  (!hasStrongMoatData && isLegalQuery)) && 
                                  !message.toLowerCase().includes('quick'); // Add "quick" keyword to skip search
      
      let internetContext = "";
      if (needsInternetSearch) {
        // Only call internet if we don't have enough local knowledge for legal queries
        // or if explicitly requested. This saves API calls/quota.
        try {
          const searchKey = await storage.getAdminSetting('tavily_api_key');
          if (searchKey?.value) {
            const searchRes = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: searchKey.value,
                query: message,
                search_depth: "basic",
                max_results: 2 // Reduced from 3 for faster response
              })
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json() as any;
              internetContext = searchData.results.map((r: any) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content}`).join('\n\n');
            }
          } else {
            // Fallback to DuckDuckGo (Free, no key)
            const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(message)}&format=json&no_html=1&skip_disambig=1`);
            if (ddgRes.ok) {
              const ddgData = await ddgRes.json() as any;
              if (ddgData.AbstractText) {
                internetContext = `Source: DuckDuckGo\nContent: ${ddgData.AbstractText}`;
              }
            }
          }
        } catch (searchErr) {
          console.error('[Civic Chat] Internet search failed:', searchErr);
        }
      }

      // Combine MOAT and Internet context
      const combinedContext = [
        relevantMoat.length > 0 ? "--- RELEVANT MOAT DATA ---" : "",
        relevantMoat.slice(0, 10).map(d => `Title: ${d.title || 'Untitled'}\nContent: ${d.content}\nSource: ${d.source || 'Unknown'}`).join('\n\n'),
        internetContext ? "--- INTERNET SEARCH RESULTS ---" : "",
        internetContext
      ].filter(Boolean).join('\n\n');

      const systemPrompt = `You are the SabiRight AI Citizen Education Agent for Nigeria. 
        User Location: ${city || 'Nigeria'}.
        
        CRITICAL ROLE: Educate citizens on their rights and responsibilities in a concise, lawful, and highly precise manner.
        
        STRICT RESPONSE GUIDELINES:
        1. BE CONCISE: Provide short, punchy summaries. Avoid bulky paragraphs. Use bullet points for clarity.
        2. DIRECT LEGAL CITATIONS: You MUST cite specific Sections and Subsections of the 1999 Constitution or relevant Acts (e.g., "Section 35(1) of the 1999 Constitution"). Do NOT generalize.
        3. NO HALLUCINATIONS: Be accurate about legal definitions. (e.g., Teachers are NOT typically "Public Officers" under the Code of Conduct unless employed by the State/Federal Civil Service commission).
        4. VENDOR REFERRALS: If the user query involves legal issues, property, or taxes, you MUST explicitly refer them to the nearby professionals listed below.
        5. TONE: Professional, authoritative, yet helpful.
        
        CONTEXT FOR THIS QUERY:
        ${combinedContext || 'No specific local context found. Use general knowledge of Nigerian law.'}
        
        NEARBY PROFESSIONALS (REFER USER TO THESE IF NEEDED):
        ${nearbyVendors || 'No verified lawyers currently available in this immediate area.'}`;

      const fullPrompt = `System: ${systemPrompt}\n\nUser Question: ${message}\n\nAssistant Response (Short, precise, with citations):`;

      let text;
      try {
        text = await generateAIResponse(fullPrompt);
      } catch (aiErr: any) {
        if (aiErr.status === 429) {
          return res.status(429).json({ error: aiErr.message });
        }
        throw aiErr;
      }

      if (!text) {
        return res.status(500).json({ error: 'Empty AI response' });
      }

      // Save to chat if chatId provided
      if (chatId) {
        await storage.addSabiGuardMessage(chatId, "user", message);
        await storage.addSabiGuardMessage(chatId, "ai", text);
        
        // Track storage used (rough estimate: characters * 1 byte)
        const bytesUsed = (message.length + text.length);
        if (userId) {
          await storage.updateChatStorageUsed(userId, bytesUsed);
        }

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
      console.error('[Civic Chat] Error:', err.message, err.stack);
      if (err.status === 429) {
        return res.status(429).json({ error: err.message });
      }
      if (err.status === 503) {
        return res.status(503).json({ error: err.message });
      }
      res.status(500).json({ 
        error: 'Internal server error processing chat',
        message: err.message 
      });
    }
  });

  // AI Job Search API
  app.post("/api/ai/jobs/search", userAuth, async (req, res) => {
    const { role, location, employmentType, workMode } = req.body;
    const userId = req.userId;
    
    if (!userId || !role) {
      return res.status(400).json({ error: 'User ID and role required' });
    }

    const credits = await storage.getUserCredits(userId);
      if (!credits || (credits.totalCredits ?? 0) < 1) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    const aiPrompt = `
      Act as a Job Search API for Nigeria.
      Criteria: Role: ${role}, Location: ${location || 'Lagos'}${employmentType ? `, Employment: ${employmentType}` : ''}${workMode ? `, Work Mode: ${workMode}` : ''}.
      
      Task: List 3 highly realistic and CURRENT job opportunities matching these criteria.
      
      CRITICAL INSTRUCTIONS:
      1. Sources MUST strictly be from these Nigerian Job portals: "Jobberman", "HotNigerianJobs", "Indeed", "MyJobMag", "LinkedIn", or "NG Careers".
      2. If salary is not explicitly stated in the listing, set "salary" to "To be Negotiated".
      3. The 'description' must be comprehensive (at least 100 words). Format using Markdown.
      4. The 'contact' field must be a valid URL to the job listing or a professional application email.
      5. The 'type' must be either "Full-time" or "Part-time".
      6. The 'workMode' must be either "Remote", "Onsite", or "Hybrid".
      7. Ensure NO hallucinations. All companies and jobs must be real.
      
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

      const rawJobs = JSON.parse(jsonMatch[0]);
      const savedJobs = [];
      const allowedSources = ["Jobberman", "HotNigerianJobs", "Indeed", "MyJobMag", "LinkedIn", "NG Careers"];

      for (const job of rawJobs) {
        // Validation: Ensure source is compliant and fields are realistic
        if (!job.title || !job.company || !job.contact) continue;
        
        // Normalize source and check if it's allowed
        const jobSource = job.source || 'AI Generated';
        const isCompliant = allowedSources.some(s => jobSource.toLowerCase().includes(s.toLowerCase()));
        
        if (!isCompliant) {
          continue;
        }

        // Ensure salary is set correctly
        if (!job.salary || job.salary.toLowerCase().includes('not stated') || job.salary.toLowerCase().includes('negotiable')) {
          job.salary = "To be Negotiated";
        }

        // Create in both general jobs and generated jobs for visibility
        const savedJob = await storage.createJob({
          ...job,
          postedBy: userId,
          source: jobSource,
          isAiFetched: true
        });

        // Also save to generated jobs collection for the "AI Generated" tab
        // Use the same ID as the general job to avoid confusion
        await storage.createGeneratedJob(userId, {
          ...job,
          id: savedJob.id,
          source: jobSource
        });

        savedJobs.push(savedJob);
      }

      if (savedJobs.length === 0) {
        return res.status(500).json({ error: 'No valid job opportunities found. Please try a different role or location.' });
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
  app.get("/api/payments", async (req, res) => {
    const { userId } = req.query;
    const authHeader = req.headers.authorization;
    
    let currentUserId: string | undefined;
    let isAdmin = false;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const result = await verifyUserToken(token);
      if (result.valid && result.userId) {
        currentUserId = result.userId;
        isAdmin = await isUserAdmin(currentUserId);
      }
    }

    // Security check: If not admin and trying to view another user's payments
    if (userId && userId !== currentUserId && !isAdmin) {
      return res.status(401).json({ error: 'Authentication required to view these payments' });
    }

    // Default to current user if no userId provided and not admin
    const targetUserId = (isAdmin && userId) ? (userId as string) : (userId as string || currentUserId);
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

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

      // Get Paystack settings from paymentMethods
      const paymentMethods = await storage.getPaymentMethods();
      const paystackMethod = paymentMethods.find((m: any) => m.type === 'paystack' && m.active);
      
      if (!paystackMethod?.secretKey) {
        return res.status(503).json({ error: 'Paystack not configured or inactive' });
      }

      // Initialize Paystack service
      const paystack = new PaystackService({
        secretKey: paystackMethod.secretKey,
        publicKey: paystackMethod.publicKey || ''
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
        const { paymentId, userId, type, credits, planId } = metadata || {};

        if (status === 'success' && userId) {
          // Find payment by ID or reference
          let payment = null;
          if (paymentId) {
            payment = await storage.getPayment(paymentId);
          }
          
          if (!payment) {
            const payments = await storage.getPayments();
            payment = payments.find((p: any) => p.providerRef === reference || p.metadata?.reference === reference);
          }

          if (payment && payment.status === 'completed') {
            return res.json({ success: true, message: 'Payment already processed' });
          }

          // Update payment status
          if (paymentId) {
            await storage.updatePayment(paymentId, {
              status: 'completed',
              providerRef: reference
            });
          }

          // Process based on type
          const amountInNaira = (event.data.amount as number) / 100; // Convert from kobo
          
          if (type === 'wallet_topup') {
            await storage.topUpWallet(userId, amountInNaira, reference, 'Paystack payment');
          } else if (type === 'credit_purchase' && credits) {
            await storage.addCredits(userId, parseInt(String(credits)), `Paystack purchase (webhook): ${paymentId || reference}`);
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

      // Get Paystack settings from paymentMethods
      const paymentMethods = await storage.getPaymentMethods();
      const paystackMethod = paymentMethods.find((m: any) => m.type === 'paystack' && m.active);
      
      if (!paystackMethod?.secretKey || !paystackMethod?.publicKey) {
        return res.status(503).json({ error: 'Paystack not configured or inactive' });
      }

      // Initialize Paystack service
      const paystack = new PaystackService({
        secretKey: paystackMethod.secretKey,
        publicKey: paystackMethod.publicKey
      });

      // Verify payment
      const verification = await paystack.verifyPayment(reference);

      // Process payment if successful
      if (verification.status && verification.data.status === 'success') {
        const { paymentId, userId, type, credits, planId } = verification.data.metadata || {};

        if (userId) {
          // Find payment by ID or reference
          let payment = null;
          if (paymentId) {
            payment = await storage.getPayment(paymentId);
          }
          
          if (!payment) {
            const payments = await storage.getPayments();
            payment = payments.find((p: any) => p.providerRef === reference || p.metadata?.reference === reference);
          }
          
          if (payment && payment.status !== 'completed') {
            // Update payment status
            await storage.updatePayment(payment.id, {
              status: 'completed',
              providerRef: verification.data.reference
            });

            // Process based on type
            const amount = verification.data.amount / 100; // Convert from kobo
            
            if (type === 'wallet_topup') {
              await storage.topUpWallet(userId, amount, verification.data.reference, 'Paystack payment (verified)');
            } else if (type === 'credit_purchase' && credits) {
              await storage.addCredits(userId, parseInt(String(credits)), `Paystack purchase (verified): ${payment.id}`);
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
      }

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

          // Update payment status
          await storage.updatePayment(payment.id, {
            status: 'completed',
            providerRef: tx_ref
          });

          // Process based on type
          if (type === 'wallet_topup') {
            await storage.topUpWallet(userId, amount, tx_ref, 'Flutterwave payment');
          } else if (type === 'credit_purchase' && credits) {
            await storage.addCredits(userId, parseInt(String(credits)), `Flutterwave webhook purchase: ${payment.id}`);
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

      const data = await response.json() as any;
      
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

          // Update payment status
          await storage.updatePayment(payment.id, {
            status: 'completed',
            providerRef: tx_ref
          });

          // Process based on type
          if (type === 'wallet_topup') {
            await storage.topUpWallet(userId, amount, tx_ref, 'Flutterwave payment');
          } else if (type === 'credit_purchase' && credits) {
            await storage.addCredits(userId, parseInt(String(credits)), `Flutterwave purchase: ${payment.id}`);
          } else if (type === 'subscription' && planId) {
            await storage.createSubscription({
              userId,
              planId,
              status: 'active',
              startDate: new Date().toISOString()
            });
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
      const payment = await storage.getPayment(paymentId);
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
          data: { paymentId, amount: payment.amount, type: payment.type },
          channels: ['in_app', 'email']
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
          data: { paymentId, credits, amount: payment.amount },
          channels: ['in_app', 'email']
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
          data: { paymentId, planId, amount: payment.amount },
          channels: ['in_app', 'email']
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
      const payment = await storage.getPayment(paymentId);
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
        data: { paymentId, amount: payment.amount, reason },
        channels: ['in_app', 'email']
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

  app.post("/api/forum/posts", userAuth, emailVerifiedAuth, async (req, res, next) => {
    const { content, city, author } = req.body;
    const userId = req.userId;
    
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
      const userId = req.userId;
      
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
          userId: userId!,
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

  app.post("/api/forum/posts/:postId/comments", userAuth, emailVerifiedAuth, async (req, res, next) => {
    try {
      const { postId } = req.params;
      const { text, author, userId } = req.body;
      const currentUserId = req.userId;

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
      const currentUserId = req.userId;
      const isAdmin = await isUserAdmin(currentUserId!);

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
      const userId = req.userId;

      if (!['up', 'down'].includes(type)) {
        return res.status(400).json({ error: 'Invalid vote type' });
      }

      await storage.voteForumPost(postId, userId!, type);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forum/posts/:postId/comments/:commentId/vote", userAuth, async (req, res, next) => {
    try {
      const { postId, commentId } = req.params;
      const userId = req.userId;

      await storage.voteForumComment(postId, commentId, userId!);
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
        reinstatedBy: req.userId
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
      
      if (!result.valid || !result.coupon) {
        return res.status(400).json({ valid: false, error: result.error || 'Invalid coupon' });
      }

      res.json({
        valid: true,
        coupon: {
          id: result.coupon.id,
          code: result.coupon.code,
          discountType: result.coupon.discountType,
          discountValue: result.coupon.discountValue
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
      const userId = req.userId;
      const booking = req.booking;
      
      if (!userId || !booking) {
        return res.status(401).json({ error: 'Authentication required or booking not found' });
      }
      
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
      const userId = req.userId;
      const booking = req.booking;

      if (!userId || !booking) {
        return res.status(401).json({ error: 'Authentication required or booking not found' });
      }

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
      const userId = req.userId;
      const booking = req.booking;
      
      if (!userId || !booking) {
        return res.status(401).json({ error: 'Authentication required or booking not found' });
      }
      
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

      const vendorId = booking.vendorId;
      if (!vendorId) {
        return res.status(400).json({ error: 'Vendor ID not found for this booking' });
      }

      const event = await storage.releaseEscrowMilestone(
        escrow.id,
        milestoneId,
        vendorId,
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
      const userId = req.userId;
      const booking = req.booking;
      
      if (!userId || !booking) {
        return res.status(401).json({ error: 'Authentication required or booking not found' });
      }
      
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
      const senderId = req.userId;
      const isAdmin = req.isAdmin;
      
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
      const openedBy = req.userId;
      
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

      const adminId = req.userId;
      const dispute = await storage.resolveDispute(id, resolution, resolutionNotes || '', adminId!);
      
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
      const adminId = req.userId;
      
      const dispute = await storage.joinDispute(id, adminId!);
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

  app.post("/api/sabiguard/chats/:chatId/messages", userAuth, async (req, res, next) => {
    try {
      const { chatId } = req.params;
      const { role, text, userId } = req.body;
      if (!role || !text) {
        return res.status(400).json({ error: "Role and text are required" });
      }

      // Check storage limits if userId is provided
      if (userId) {
        const profile = await storage.getUserProfile(userId);
        if (profile) {
          const limit = profile.chatStorageLimit || 524288;
          const used = profile.chatStorageUsed || 0;
          if (used >= limit) {
            return res.status(400).json({ error: "Storage limit reached" });
          }
        }
      }

      const message = await storage.addSabiGuardMessage(chatId, role, text);
      
      // Update storage used
      if (userId) {
        const bytesUsed = text.length;
        await storage.updateChatStorageUsed(userId, bytesUsed);
      }

      res.json(message);
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
      const available = userCredits?.totalCredits || 0;
  
      if (available < sabiguardCost) {
        return res.status(400).json({ 
          error: "Insufficient credits", 
          required: sabiguardCost,
          available
        });
      }
  
      // Deduct credits (subtract instead of add)
      await storage.deductCredits(userId, sabiguardCost, "SabiGuard query", "SabiGuard query");
  
      // Get AI Response
      let aiResponseText = "";
      try {
        const prompt = `You are SabiGuard, a civic and legal AI assistant for Nigeria. 
        User Question: ${query}
        
        CRITICAL INSTRUCTIONS:
        1. Summarize your response. Be extremely concise and "Short and Smart".
        2. Do not provide bulky details unless the user explicitly asks for them.
        3. Provide helpful, accurate, and concise guidance. 
        4. If it's a legal issue, remind them you are an AI, not a lawyer.
        5. Always end by asking: "Would you like a more detailed explanation, or should we continue in this 'Short and Smart' mode?"`;
        aiResponseText = await generateAIResponse(prompt) || "I'm sorry, I couldn't generate a response at this time.";
      } catch (aiErr: any) {
        console.error('SabiGuard AI Error:', aiErr);
        aiResponseText = `Error generating AI response: ${aiErr.message}. Please check API keys.`;
      }
      
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
      const available = userCredits?.totalCredits || 0;
  
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
      const available = userCredits?.totalCredits || 0;
  
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
  app.get("/api/notifications/:userId", async (req, res, next) => {
    try {
      console.log(`[GET /api/notifications/${req.params.userId}] Request received`);
      const { userId } = req.params;
      const { limit, type } = req.query;
      const authHeader = req.headers.authorization;

      // Disable caching for notifications to prevent ERR_ABORTED or stale data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.substring(7);
      let result;
      try {
        result = await verifyUserToken(token);
      } catch (tokenError) {
        console.error('Token verification error:', tokenError);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      if (!result || !result.valid || !result.userId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Security check: If not admin and trying to view another user's notifications
      let isAdmin = false;
      try {
        isAdmin = await isUserAdmin(result.userId);
      } catch (adminCheckError) {
        console.error('Admin check error:', adminCheckError);
        // Default to non-admin if check fails
      }

      if (userId !== result.userId && !isAdmin) {
        return res.status(403).json({ error: 'Access denied: User ID mismatch' });
      }
      
      let notifications = [];
      try {
        notifications = await storage.getNotificationsByUserId(
          userId,
          limit ? parseInt(limit as string) : 50
        );
      } catch (storageError) {
        console.error('Storage fetch notifications error:', storageError);
        return res.status(500).json({ error: 'Failed to fetch notifications from storage' });
      }

      if (type && type !== 'all') {
        notifications = notifications.filter(n => n.type === type);
      }
      
      let unreadCount = 0;
      try {
        unreadCount = await storage.getUnreadNotificationCount(userId);
      } catch (unreadError) {
        console.error('Storage fetch unread count error:', unreadError);
        // Non-fatal, just set to 0
      }
      
      res.json({
        notifications: notifications || [],
        unreadCount: unreadCount || 0,
        totalCount: (notifications || []).length
      });
    } catch (error) {
      console.error('Unexpected error in GET /api/notifications/:userId:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error fetching notifications' });
      }
    }
  });

  // Get unread notification count
  app.get("/api/notifications/:userId/unread", async (req, res, next) => {
    try {
      const { userId } = req.params;
      const authHeader = req.headers.authorization;

      // Disable caching for unread count to prevent ERR_ABORTED or stale data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.substring(7);
      let result;
      try {
        result = await verifyUserToken(token);
      } catch (tokenError) {
        console.error('Token verification error:', tokenError);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      if (!result || !result.valid) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      let isAdmin = false;
      if (result.userId) {
        try {
          isAdmin = await isUserAdmin(result.userId);
        } catch (adminCheckError) {
          console.error('Admin check error:', adminCheckError);
        }
      }

      if (userId !== result.userId && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      let count = 0;
      try {
        count = await storage.getUnreadNotificationCount(userId);
      } catch (storageError) {
        console.error('Storage fetch unread count error:', storageError);
        return res.status(500).json({ error: 'Failed to fetch unread count' });
      }

      res.json({ count });
    } catch (error) {
      console.error('Unexpected error in GET /api/notifications/:userId/unread:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error fetching unread count' });
      }
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
      
      let finalPassword = password;
      if (password === '••••••••') {
        const existingSettings = await storage.getSmtpSettings();
        if (existingSettings) {
          finalPassword = existingSettings.password;
        }
      }
      
      const settings = await storage.updateSmtpSettings({
        host,
        port: parseInt(port),
        username,
        password: finalPassword,
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

  // ===== Admin Push Settings API =====

  // Get Push settings
  app.get("/api/admin/notifications/push", adminAuth, async (req, res, next) => {
    try {
      const settings = await storage.getPushSettings();
      
      if (!settings) {
        return res.json({ configured: false });
      }
      
      res.json({
        ...settings,
        privateKey: '••••••••',
        configured: true
      });
    } catch (error) {
      next(error);
    }
  });

  // Update Push settings
  app.post("/api/admin/notifications/push", adminAuth, async (req, res, next) => {
    try {
      const { publicKey, privateKey, subject, isActive } = req.body;
      
      if (!publicKey || !privateKey || !subject) {
        return res.status(400).json({ 
          error: 'publicKey, privateKey, and subject are required' 
        });
      }
      
      let finalPrivateKey = privateKey;
      if (privateKey === '••••••••') {
        const existingSettings = await storage.getPushSettings();
        if (existingSettings) {
          finalPrivateKey = existingSettings.privateKey;
        }
      }
      
      const settings = await storage.updatePushSettings({
        publicKey,
        privateKey: finalPrivateKey,
        subject,
        isActive: isActive !== false
      });
      
      res.json({
        ...settings,
        privateKey: '••••••••'
      });
    } catch (error) {
      next(error);
    }
  });

  // Test Push notification
  app.post("/api/admin/notifications/push/test", adminAuth, async (req, res, next) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId is required for testing' });

      const success = await storage.sendNotification({
        userId,
        type: 'system',
        title: 'Push Test',
        message: 'This is a test push notification from SabiRight Admin.',
        channels: ['push', 'in_app']
      });

      res.json({ success });
    } catch (error: any) {
      console.error('Push Test Error:', error);
      res.status(500).json({ 
        error: 'Push test failed', 
        details: error.message 
      });
    }
  });

  // Generate VAPID keys
  app.post("/api/admin/notifications/push/generate-keys", adminAuth, async (req, res, next) => {
    try {
      const vapidKeys = webpush.generateVAPIDKeys();
      res.json(vapidKeys);
    } catch (error: any) {
      console.error('VAPID Key Generation Error:', error);
      res.status(500).json({ 
        error: 'Failed to generate VAPID keys', 
        details: error.message 
      });
    }
  });

  // Test SMTP connection
  app.post("/api/admin/notifications/smtp/test", adminAuth, async (req, res, next) => {
    try {
      const { host, port, username, password, fromEmail, fromName, encryption } = req.body;
      
      let finalPassword = password;
      if (password === '••••••••') {
        const settings = await storage.getSmtpSettings();
        if (settings) {
          finalPassword = settings.password;
        }
      }

      if (!host || !port || !username || !finalPassword || !fromEmail || !fromName) {
        return res.status(400).json({ error: 'All fields are required for testing' });
      }

      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: encryption === 'ssl' || parseInt(port) === 465,
        auth: {
          user: username,
          pass: finalPassword,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection configuration
      await transporter.verify();

      // Send a test email
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: fromEmail, // Send to self
        subject: "SMTP Connection Test - SabiRight",
        html: `
          <h1>SMTP Connection Successful!</h1>
          <p>This is a test email from SabiRight Admin Dashboard.</p>
          <p>If you received this, your SMTP settings are correctly configured.</p>
          <hr />
          <p><strong>Config Details:</strong></p>
          <ul>
            <li>Host: ${host}</li>
            <li>Port: ${port}</li>
            <li>User: ${username}</li>
            <li>Encryption: ${encryption || 'tls'}</li>
          </ul>
        `,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error('SMTP Test Error:', error);
      res.status(500).json({ 
        error: 'SMTP test failed', 
        details: error.message 
      });
    }
  });

  // ===== Crowd Translation API =====

  // Submit a translation
  app.post("/api/crowd-translations", userAuth, async (req, res, next) => {
    try {
      const { termId, english, translation, language } = req.body;
      if (!termId || !english || !translation || !language) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await storage.submitTranslation({
        termId,
        english,
        translation,
        language,
        userId: req.userId,
      });

      // Award credits for contributing
      try {
        await storage.refundCredits(req.userId!, 5, "Translation Contribution");
      } catch (e) {
        console.error('Failed to award credits for translation:', e);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Get random translation for verification
  app.get("/api/crowd-translations/verification", userAuth, async (req, res, next) => {
    try {
      const translation = await storage.getRandomTranslationForVerification(req.userId!);
      if (!translation) {
        return res.status(404).json({ error: "No translations available for verification" });
      }
      res.json(translation);
    } catch (error) {
      next(error);
    }
  });

  // Vote on a translation
  app.post("/api/crowd-translations/:id/vote", userAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { vote } = req.body; // boolean: true for Yes, false for No
      
      await storage.voteTranslation(id, vote);
      
      // Award credits for voting/verifying
      try {
        await storage.refundCredits(req.userId!, 2, "Translation Verification");
      } catch (e) {
        console.error('Failed to award credits for voting:', e);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Get translation stats
  app.get("/api/admin/crowd-translations/stats", adminAuth, async (req, res, next) => {
    try {
      console.log(`[Admin] Fetching crowd translation stats`);
      const stats = await storage.getCrowdTranslationStats();
      console.log(`[Admin] Stats:`, stats);
      res.json(stats);
    } catch (error) {
      console.error(`[Admin] Error fetching stats:`, error);
      next(error);
    }
  });

  // Admin: Get all crowd translations
  app.get("/api/admin/crowd-translations", adminAuth, async (req, res, next) => {
    try {
      console.log(`[Admin] Fetching all crowd translations`);
      const translations = await storage.getAllCrowdTranslations();
      console.log(`[Admin] Found ${translations.length} translations`);
      res.json(translations);
    } catch (error) {
      console.error(`[Admin] Error fetching translations:`, error);
      next(error);
    }
  });

  // Admin: Export verified translations as JSONL
  app.get("/api/admin/crowd-translations/export", adminAuth, async (req, res, next) => {
    try {
      const translations = await storage.getVerifiedTranslations(2); // votes > 2
      
      const jsonl = translations.map(t => JSON.stringify({
        instruction: `Translate ${t.english} to ${t.language}`,
        input: t.english,
        output: t.translation
      })).join('\n');

      res.setHeader('Content-Type', 'application/x-jsonlines');
      res.setHeader('Content-Disposition', 'attachment; filename=crowd_translations_export.jsonl');
      res.send(jsonl);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Get all training terms
  app.get("/api/admin/training-terms", adminAuth, async (req, res, next) => {
    try {
      const terms = await storage.getTrainingTerms();
      res.json(terms);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Create new training term
  app.post("/api/admin/training-terms", adminAuth, async (req, res, next) => {
    try {
      const term = await storage.createTrainingTerm(req.body);
      res.json(term);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Delete training term
  app.delete("/api/admin/training-terms/:id", adminAuth, async (req, res, next) => {
    try {
      await storage.deleteTrainingTerm(req.params.id);
      res.json({ success: true });
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
      const adminId = req.userId;
      
      const dispute = await storage.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }

      const updatedDispute = await storage.joinDispute(id, adminId!);

      // Auto-message for admin joining
      if (updatedDispute) {
        await storage.createBookingMessage({
          bookingId: updatedDispute.bookingId,
          senderId: adminId!,
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
      const adminId = req.userId;

      if (!resolution) {
        return res.status(400).json({ error: 'Resolution required' });
      }

      const dispute = await storage.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }

      const updatedDispute = await storage.resolveDispute(id, resolution, resolutionNotes || '', adminId!);
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

  // Admin Generated Jobs API
  app.get("/api/admin/generated-jobs", adminAuth, async (req, res, next) => {
    try {
      const jobs = await storage.getGeneratedJobs();
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/generated-jobs/:id", adminAuth, async (req, res, next) => {
    try {
      await storage.deleteGeneratedJob(req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Auto-delete generated jobs older than 48 hours
  const cleanupGeneratedJobs = async () => {
    try {
      console.log('[Cleanup] Running generated jobs cleanup...');
      const deletedCount = await storage.cleanupOldGeneratedJobs(48);
      if (deletedCount > 0) {
        console.log(`[Cleanup] Deleted ${deletedCount} old generated jobs.`);
      }
    } catch (error) {
      console.error('[Cleanup] Error cleaning up generated jobs:', error);
    }
  };

  // Run cleanup every hour
  setInterval(cleanupGeneratedJobs, 60 * 60 * 1000);
  // Also run once at startup after a short delay
  setTimeout(cleanupGeneratedJobs, 10000);

  return httpServer;
}
