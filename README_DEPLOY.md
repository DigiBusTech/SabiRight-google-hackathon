# DigiZen AI Deployment Guide (Firestore Version)

This package contains the production-ready build of DigiZen AI, configured to use Firebase Firestore as the primary database.

## Prerequisites

1. **Node.js**: Ensure Node.js 18 or higher is installed.
2. **Firebase Project**: You need a Firebase project with:
   - **Firestore Database** enabled.
   - **Authentication** (Email/Password) enabled.
   - **Service Account Key**: Download the JSON key file from Firebase Console (Project Settings > Service Accounts).

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Client-side Firebase Config
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Gemini AI API Key
GEMINI_API_KEY=your-gemini-api-key

# Optional: Paystack / Flutterwave Keys
PAYSTACK_SECRET_KEY=your-paystack-key
FLUTTERWAVE_SECRET_KEY=your-flutterwave-key
```

## How to Run

1. **Unzip** the deployment package.
2. **Install Dependencies**:
   ```bash
   npm install --production
   ```
3. **Start the Server**:
   ```bash
   npm start
   ```
   The server will run on port 5000 by default (or the port specified in `PORT` env variable).

## Admin Setup

To set up the first admin user:
1. Register an account on the platform.
2. Use the provided script or manually update the user document in Firestore to set `isAdmin: true`.
3. Alternatively, use the Admin Setup feature in the Dashboard if you have the `ADMIN_SETUP_KEY` configured.

## Notes

- The project uses `dist/public` for client-side static files.
- The server logic is bundled into `dist/index.cjs`.
- Chat storage limits are enforced at the API level (Default 512KB).
