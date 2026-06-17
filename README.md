# SabiRight-google-hackathon

<div align="center">
  <h3>⚖️ SabiRight</h3>
  <p><strong>Empowering citizens and immigrants with instant, law-grounded civic guidance and seamless professional proximity matching.</strong></p>
  <p><i>Submitted for the Google Hackathon Evaluation Framework</i></p>
</div>

---

## 📌 Project Overview

**SabiRight** is a civic tech super-app designed to bridge the gap between complex statutory frameworks and the everyday legal, tenancy, compliance, real estate, and immigration challenges faced by citizens and immigrants. 

The platform operates on a dual-engine architecture:

1. **Civic Guidance Engine:** An advanced AI system providing instant, law-grounded guidance during civic disputes by querying independent, verified data nodes.
2. **Proximity Matching Directory:** A B2B/B2C marketplace framework where verified local professionals (lawyers, compliance experts, real estate advisors, and immigration agents) pay for premium directory listings and high-intent, context-rich leads. 

To completely eliminate lost billable hours spent on early-stage client discovery, the system synthesizes the user’s full interaction history into a comprehensive, AI-generated **pre-case file** dispatched straight to the matched professional before the first meeting.

---

## 🚀 Key Features

* **RAG-Driven Civic Intellect:** Seamless execution of Retrieval-Augmented Generation (RAG) over trusted legal frameworks (such as the 1999 Constitution, Police Act, Tenancy Laws, and Immigration Codes) ensuring zero-hallucination guidance.
* **Proximity Matching Routing Engine:** Matches users dynamically with nearby verified professionals within specific required categories based on spatial coordinates and case type.
* **Automated Pre-Case File Synthesis:** Condenses complex diagnostic chat interactions into structured legal discovery briefs, including cited statutes, core dispute timelines, and client goals.
* **B2B Marketplace Infrastructure:** Native monetization and lead-dispatch pipelines built for professional directory placements, secure lead routing, and tier-based matching.

---

## 🛠️ Google Cloud & Tech Stack Integration

SabiRight is engineered for low-latency system responses, secure data workflows, and deep AI capabilities using the Google ecosystem:

* **Core AI & RAG Orchestration:** **Gemini API / Vertex AI** utilizing long-context windows for deep document processing, text embedding, and automated synthesis of structured pre-case files.
* **Geospatial & Proximity Intelligence:** **Google Maps Platform** utilizing **Places API** and **Distance Matrix API** to compute, rank, and route users to local professionals within the Proximity Matching Directory.
* **Backend Core Architecture:** **google firestore / Node.js** architected for highly secure transactional routing, API gateways, and asynchronous lead distribution queues.
* **Frontend Experience:** **React** structured as a lightweight, cross-platform single-page application optimized for rapid mobile interface rendering.
* **Database & Infrastructure:** **Google Cloud firestore** managing relational database models for user profiles, verified professional accounts, active dispute tracking, and system audit trails.

---

## 📐 System Architecture Flow

```text
[ Citizen / Immigrant ] ──> ( React UI ) ──> [ Google firestore / Node.js Backend API ]
                                                   │                 │
     ┌─────────────────────────────────────────────┘                 └────────────────────────┐
     ▼                                                                                        ▼
[ Gemini RAG Engine ] <──> [ Verified Data Nodes ]                          [ Google Maps Proximity Engine ]
 (AI Law Guidance)          (Constitution, Tenancy, Immigration Acts)         (Geospatial Matching Router)
     │                                                                                        │
     ▼                                                                                        ▼
[ Generate Pre-Case File ] ───────────────────────────────────────────────> [ Matched Verified Professional ]


                                                                   (Paid B2B Directory & Qualified Lead)
📁 Repository StructurePlaintextSabiRight-google-hackathon/
├── ai-engine/              # Prompts, grounding data structures, and RAG pipelines
├── backend/                # API Gateway (Laravel / Node.js core backend code)
│   ├── app/                # Core business logic & Matching Services
│   ├── config/             # Cloud Integration Configurations
│   ├── database/           # Migrations and Seeds for verified data nodes & directories
│   └── .env.example        # Environment blueprint
├── frontend/               # Single Page Application (React)
│   ├── public/             # Asset files and manifests
│   └── src/                # Functional UI components, context providers, and hooks
└── README.md

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


The API server will launch at http://127.0.0.1:5000 Frontend Development Server Setup
Open a separate terminal window, navigate to the React source folder, and install user interface dependencies:
Bashcd ../frontend
npm install
npm start
