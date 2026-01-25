import admin from 'firebase-admin';
import fs from 'fs';

try {
  const serviceAccount = JSON.parse(fs.readFileSync('/home/ubuntu/firebase_service_account.json', 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'legal-13d13',
  });

  console.log('Firebase Admin SDK initialized successfully!');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}
