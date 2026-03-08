import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || 'legal-13d13';

function initializeFirebase() {
  if (admin.apps && admin.apps.length > 0) {
    return admin.app();
  }
  
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  let serviceAccount;

  if (serviceAccountJson) {
    serviceAccount = JSON.parse(serviceAccountJson);
  } else {
    const filePath = path.join(process.cwd(), 'legal-13d13-firebase-adminsdk-fbsvc-e736182a52.json');
    if (fs.existsSync(filePath)) {
      serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  }

  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set and local service account file not found');
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
  plans: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('plans'),
  events: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('events'),
  vendorServices: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('vendorServices'),
  vendorApplications: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('vendorApplications'),
  adminSettings: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('adminSettings'),
  surveys: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('surveys'),
  trainingTerms: () => db.collection('artifacts').doc(FIREBASE_APP_ID).collection('trainingTerms'),
};

async function seedData() {
  console.log('Starting Firestore data seeding...');

  // Seed Plans
  const plans = [
    { id: 'free-user', name: 'Free', description: 'Basic access for citizens', price: '0', billingCycle: 'monthly', dailyCredits: 5, marketplaceListings: 0, features: ['AI Legal Help', 'Basic Civic Info'], type: 'free', userType: 'user' },
    { id: 'basic-user', name: 'Basic', description: 'Standard access with more features', price: '2000', billingCycle: 'monthly', dailyCredits: 15, marketplaceListings: 3, features: ['AI Legal Help', 'Civic Info', 'Job Matches', 'Events'], type: 'basic', userType: 'user' },
    { id: 'pro-user', name: 'Pro', description: 'Full access to all features', price: '5000', billingCycle: 'monthly', dailyCredits: 50, marketplaceListings: 10, features: ['All Features', 'Priority Support', 'Advanced AI'], type: 'pro', userType: 'user' },
    { id: 'free-vendor', name: 'Vendor Free', description: 'Basic vendor access', price: '0', billingCycle: 'monthly', dailyCredits: 10, marketplaceListings: 3, features: ['List 3 Services', 'Basic Analytics'], type: 'free', userType: 'vendor' },
    { id: 'pro-vendor', name: 'Vendor Pro', description: 'Full vendor access', price: '10000', billingCycle: 'monthly', dailyCredits: 100, marketplaceListings: null, features: ['Unlimited Services', 'Priority Listing', 'Full Analytics'], type: 'pro', userType: 'vendor' },
  ];

  for (const plan of plans) {
    await collections.plans().doc(plan.id).set(plan);
    console.log(`Created plan: ${plan.name}`);
  }

  // Seed Admin Settings
  const settings = [
    { key: 'google_maps_api_key', value: '', category: 'api_keys', isSecret: true },
    { key: 'stripe_enabled', value: 'true', category: 'payments', isSecret: false },
    { key: 'paystack_enabled', value: 'true', category: 'payments', isSecret: false },
    { key: 'flutterwave_enabled', value: 'true', category: 'payments', isSecret: false },
    { key: 'payment_mode', value: 'automatic', category: 'payments', isSecret: false },
    { key: 'stripe_api_key', value: '', category: 'api_keys', isSecret: true },
    { key: 'paystack_api_key', value: '', category: 'api_keys', isSecret: true },
    { key: 'flutterwave_api_key', value: '', category: 'api_keys', isSecret: true },
    { key: 'gemini_api_key', value: '', category: 'ai', isSecret: true },
    { key: 'chatgpt_api_key', value: '', category: 'ai', isSecret: true },
    { key: 'primary_ai', value: 'gemini', category: 'ai', isSecret: false },
  ];

  for (const setting of settings) {
    await collections.adminSettings().doc(setting.key).set({
      ...setting,
      updatedAt: new Date().toISOString(),
    });
    console.log(`Created setting: ${setting.key}`);
  }

  // Seed Test Users
  const testUsers = [
    { id: 'admin-001', username: 'admin', password: 'admin123' },
    { id: 'user-001', username: 'testuser', password: 'test123' },
    { id: 'vendor-001', username: 'vendortest', password: 'vendor123' },
  ];

  for (const user of testUsers) {
    await collections.users().doc(user.id).set(user);
    console.log(`Created user: ${user.username}`);
  }

  // Seed User Profiles
  const profiles = [
    { userId: 'admin-001', email: 'admin@digitalcitizen.ng', displayName: 'Admin User', isVendor: false, emailVerificationStatus: 'verified', vendorMode: false, isAdmin: true, createdAt: new Date() },
    { userId: 'user-001', email: 'user@example.com', displayName: 'Test User', isVendor: false, emailVerificationStatus: 'pending', vendorMode: false, isAdmin: false, createdAt: new Date() },
    { userId: 'vendor-001', email: 'vendor@example.com', displayName: 'Vendor Test', isVendor: true, emailVerificationStatus: 'verified', vendorMode: true, isAdmin: false, createdAt: new Date() },
  ];

  for (const profile of profiles) {
    await collections.profiles().doc(profile.userId).set(profile);
    console.log(`Created profile for: ${profile.displayName}`);
  }

  // Seed Credits
  const creditsData = [
    { id: 'cred-admin', userId: 'admin-001', totalCredits: 1000, usedCredits: 0, lastRefreshDate: new Date() },
    { id: 'cred-user', userId: 'user-001', totalCredits: 50, usedCredits: 0, lastRefreshDate: new Date() },
    { id: 'cred-vendor', userId: 'vendor-001', totalCredits: 200, usedCredits: 0, lastRefreshDate: new Date() },
  ];

  for (const cred of creditsData) {
    await collections.credits().doc(cred.userId).set(cred);
    console.log(`Created credits for user: ${cred.userId}`);
  }

  // Seed Subscriptions
  const subscriptions = [
    { id: 'sub-admin', userId: 'admin-001', planId: 'pro-user', status: 'active', startDate: new Date() },
    { id: 'sub-user', userId: 'user-001', planId: 'free-user', status: 'active', startDate: new Date() },
    { id: 'sub-vendor', userId: 'vendor-001', planId: 'pro-vendor', status: 'active', startDate: new Date() },
  ];

  for (const sub of subscriptions) {
    await collections.subscriptions().doc(sub.id).set(sub);
    console.log(`Created subscription: ${sub.id}`);
  }

  // Seed Vendor Application
  await collections.vendorApplications().doc('vendor-001').set({
    id: 'va-001',
    userId: 'vendor-001',
    businessName: 'Swift Services Ltd',
    serviceType: 'Multi-Service Provider',
    businessDocument: 'CAC-REG-12345',
    taxId: 'TIN-98765432',
    status: 'approved',
    emailVerificationStatus: 'verified',
    createdAt: new Date(),
    approvedAt: new Date(),
  });
  console.log('Created vendor application');

  // Seed Vendor Services
  const services = [
    { 
      id: 'svc-001', 
      vendorId: 'vendor-001', 
      name: 'Lagos Legal Services', 
      type: 'Legal', 
      specialization: 'Family Law', 
      description: 'Expert legal consultation for family matters including divorce, custody, and inheritance.', 
      location: 'Lagos', 
      latitude: '6.5244', 
      longitude: '3.3792', 
      rating: '4.5', 
      reviewCount: 12, 
      verified: true, 
      contactPhone: '+234 801 234 5678', 
      contactEmail: 'legal@example.com', 
      priceRange: 'N50,000 - N200,000', 
      isActive: true, 
      createdAt: new Date() 
    },
    { 
      id: 'svc-002', 
      vendorId: 'vendor-001', 
      name: 'TechFix Solutions', 
      type: 'Technology', 
      specialization: 'Computer Repair', 
      description: 'Professional computer and phone repair services. Fast turnaround.', 
      location: 'Abuja', 
      latitude: '9.0579', 
      longitude: '7.4951', 
      rating: '4.8', 
      reviewCount: 25, 
      verified: true, 
      contactPhone: '+234 802 345 6789', 
      contactEmail: 'techfix@example.com', 
      priceRange: 'N5,000 - N50,000', 
      isActive: true, 
      createdAt: new Date() 
    },
    { 
      id: 'svc-003', 
      vendorId: 'vendor-001', 
      name: 'Swift Plumbing', 
      type: 'Home Services', 
      specialization: 'Plumbing', 
      description: 'Reliable plumbing services for homes and businesses. 24/7 emergency service.', 
      location: 'Port Harcourt', 
      latitude: '4.8156', 
      longitude: '7.0498', 
      rating: '4.2', 
      reviewCount: 8, 
      verified: false, 
      contactPhone: '+234 803 456 7890', 
      contactEmail: 'plumbing@example.com', 
      priceRange: 'N10,000 - N100,000', 
      isActive: true, 
      createdAt: new Date() 
    },
  ];

  for (const service of services) {
    await collections.vendorServices().doc(service.id).set(service);
    console.log(`Created vendor service: ${service.name}`);
  }

  // Seed Events
  const events = [
    { 
      id: 'evt-001', 
      title: 'Civic Rights Workshop', 
      description: 'Learn about your constitutional rights as a Nigerian citizen. Free admission.', 
      date: '2025-01-15', 
      time: '10:00 AM', 
      location: 'Lagos Convention Centre', 
      category: 'Education', 
      organizer: 'Digital Citizen Foundation', 
      organizerId: 'admin-001', 
      attendees: 0, 
      maxAttendees: 100, 
      registeredBy: [],
      createdAt: new Date() 
    },
    { 
      id: 'evt-002', 
      title: 'Small Business Networking', 
      description: 'Connect with other entrepreneurs and vendors. Share ideas and grow together.', 
      date: '2025-01-20', 
      time: '2:00 PM', 
      location: 'Abuja Business Hub', 
      category: 'Networking', 
      organizer: 'Vendor Association', 
      organizerId: 'vendor-001', 
      attendees: 0, 
      maxAttendees: 50, 
      registeredBy: [],
      createdAt: new Date() 
    },
    { 
      id: 'evt-003', 
      title: 'Tech Career Fair', 
      description: 'Meet top tech companies hiring in Nigeria. Bring your CV!', 
      date: '2025-02-01', 
      time: '9:00 AM', 
      location: 'Ikeja Tech Hub', 
      category: 'Career', 
      organizer: 'Tech Community Nigeria', 
      organizerId: 'admin-001', 
      attendees: 0, 
      maxAttendees: 200, 
      registeredBy: [],
      createdAt: new Date() 
    },
  ];

  for (const event of events) {
    await collections.events().doc(event.id).set(event);
    console.log(`Created event: ${event.title}`);
  }

  // Seed Surveys
  const surveysData = [
    { id: 'srv-001', userId: 'user-001', feature: 'ai-legal-help', rating: 5, feedback: 'Very helpful, saved me a lot of time!', createdAt: new Date().toISOString() },
    { id: 'srv-002', userId: 'user-001', feature: 'marketplace', rating: 4, feedback: 'Good selection of services.', createdAt: new Date().toISOString() },
    { id: 'srv-003', userId: 'vendor-001', feature: 'vendor-dashboard', rating: 5, feedback: 'Easy to manage my services.', createdAt: new Date().toISOString() },
    { id: 'srv-004', userId: 'user-001', feature: 'civic-info', rating: 3, feedback: 'Need more local government info.', createdAt: new Date().toISOString() },
  ];

  for (const survey of surveysData) {
    await collections.surveys().doc(survey.id).set(survey);
    console.log(`Created survey for: ${survey.feature}`);
  }

  // Seed Training Terms
  const trainingTerms = [
    { id: 'term-001', term: 'Affidavit', category: 'legal', context: 'Used in court filings', createdAt: new Date().toISOString() },
    { id: 'term-002', term: 'Power of Attorney', category: 'legal', context: 'Giving legal authority to someone else', createdAt: new Date().toISOString() },
    { id: 'term-003', term: 'Civic Responsibility', category: 'civic', context: 'Duties of a citizen', createdAt: new Date().toISOString() },
    { id: 'term-004', term: 'Statutory Declaration', category: 'legal', context: 'Formal statement made to be true', createdAt: new Date().toISOString() },
  ];

  for (const term of trainingTerms) {
    await collections.trainingTerms().doc(term.id).set(term);
    console.log(`Created training term: ${term.term}`);
  }

  console.log('\n✅ Firestore seeding completed successfully!');
  console.log('\nTest accounts created:');
  console.log('- Admin: admin / admin123');
  console.log('- User: testuser / test123');
  console.log('- Vendor: vendortest / vendor123');
}

seedData().catch(console.error);
