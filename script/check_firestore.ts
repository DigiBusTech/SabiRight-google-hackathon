import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const FIREBASE_APP_ID = 'legal-13d13';
const serviceAccountPath = path.join(process.cwd(), 'legal-13d13-firebase-adminsdk-fbsvc-e736182a52.json');

if (!admin.apps.length) {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'legal-13d13',
    });
    console.log('Initialized with service account file');
  } else {
    admin.initializeApp({
      projectId: 'legal-13d13',
    });
    console.log('Initialized with default credentials');
  }
}

const db = admin.firestore();

async function checkCollections() {
  const colls = ['crowd_translations', 'crowdTranslations', 'training_terms', 'trainingTerms'];
  
  for (const collName of colls) {
    const snapshot = await db.collection('artifacts').doc(FIREBASE_APP_ID).collection(collName).get();
    console.log(`Collection '${collName}': ${snapshot.size} documents`);
    if (snapshot.size > 0) {
      console.log(`Sample document from '${collName}':`, snapshot.docs[0].data());
    }
  }
}

checkCollections().catch(console.error);
