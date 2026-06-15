<div align="center">
  <h1>IGNIS</h1>
  <h3>Advanced Supply Chain Management & Predictive Logistics System</h3>
  <p>An enterprise-grade, full-stack application designed to optimize logistics operations, predict warehouse overflows, and facilitate multi-party coordination through intelligent data orchestration.</p>
</div>

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Core Architecture & Capabilities](#core-architecture--capabilities)
3. [Machine Learning Integration](#machine-learning-integration)
4. [Application Workflow](#application-workflow)
5. [Technology Stack](#technology-stack)
6. [Prerequisites](#prerequisites)
7. [Installation & Environment Setup](#installation--environment-setup)
8. [Deployment Architecture](#deployment-architecture)

---

## Executive Summary
**IGNIS** is a sophisticated Supply Chain Management System (SCMS) engineered to solve complex logistics challenges. By centralizing warehouse inventory management, real-time fleet tracking, and secure financial transactions, the platform establishes a cohesive ecosystem for Business Owners, Buyers, and Drivers. The system integrates advanced real-time analytics and predictive machine learning models to anticipate resource constraints, ensuring zero operational downtime.

---

## Core Architecture & Capabilities

- **Granular Access Control:** Cryptographically secure, customized dashboards employing strict role-based access control (RBAC) mechanisms for Owners/Sellers, Buyers, and Drivers.
- **Real-Time Data Telemetry:** Interactive, high-performance data visualizations tracking critical metrics including dynamic warehouse capacity, inbound/outbound material volume, and granular order statuses.
- **Intelligent Dispatch & Spatial Routing:** Live map-based geospatial tracking and fleet status telemetry, powered by custom React-Leaflet integrations.
- **Secure Transaction Processing:** Integrated Razorpay checkout flow with webhook synchronization for secure, auditable load transactions.
- **Generative AI Assistant:** A contextual Gemini-powered AI heuristic bot capable of querying complex supply chain metrics, generating reports, and providing actionable operational insights.
- **Dynamic Localization Engine:** Native integration with Google Cloud Translation API, dynamically converting the entire application interface into English and 10 regional Indian languages with sub-second latency.

---

## Machine Learning Integration

To ensure operational continuity, IGNIS leverages a proprietary **Ensemble Machine Learning Pipeline** combining Random Forest regression with Long Short-Term Memory (LSTM) networks to proactively forecast warehouse overflow risks.

- **Feature Engineering:** Extraction of non-linear patterns from current inventory load, structural warehouse capacity, incoming shipment volume, load velocity (ΔInventory/ΔTime), and historical rolling averages.
- **Model Topology:** 
  - **Random Forest Regressor:** Processes multi-dimensional scalar features to accurately predict near-term capacity risks.
  - **LSTM Network:** Analyzes the prior 24 hourly system snapshots to capture sequential load trends and long-term dependencies.
- **Environmental Disruption Heuristics:** Dynamically queries the Google Weather API to augment risk probability coefficients (scaling up to 1.35x) during severe localized weather anomalies (e.g., cyclones, floods).
- **Predictive Telemetry:** Generates actionable intelligence including **Overflow Risk Probability Percentage**, **Estimated Time to Critical Overflow**, and **Algorithmic Rerouting Recommendations**.

---

## Application Workflow

1. **Authentication & Authorization:** Secure JWT-based session initiation via Supabase Auth, followed by automatic role-based routing based on verified database claims.
2. **Owner/Administrator Operations:** Centralized control over the master database, real-time macro-analytics monitoring, continuous fleet oversight, and AI-assisted strategic planning.
3. **Buyer Operations:** Dedicated client portal for comprehensive shipment assignment tracking, real-time geospatial delivery monitoring, and transparent financial settlement.
4. **Driver Operations:** Optimized mobile-responsive interface for logistics personnel to access active manifests, update real-time transit statuses, and audit historical earnings.
5. **Localization:** Instant, frictionless dashboard translation into preferred regional languages via a top-level navigation directive.

---

## Technology Stack

**Client Infrastructure**
- **Framework:** React.js (Create React App ecosystem)
- **Routing:** React Router DOM (v6+)
- **State Management:** Zustand (Atomic state management)
- **Data Visualization:** Recharts, React-Leaflet (Geospatial)
- **Styling:** Custom Modular CSS with strict Responsive Design principles

**Server & Data Infrastructure**
- **Runtime Environment:** Node.js
- **Server Framework:** Express.js (RESTful architecture)
- **Database Layer:** Supabase (PostgreSQL with Row Level Security)
- **Payment Gateway:** Razorpay API
- **AI/ML Layer:** Google Generative AI (Gemini), Scikit-Learn, TensorFlow

---

## Prerequisites
Ensure the target environment meets the following specifications prior to initialization:
- **Node.js:** v18.x or higher
- **Supabase Platform:** Active project with Database URL, Service Role Key, and Anon Key
- **Razorpay Merchant Services:** Valid Key ID and Key Secret
- **Google Cloud Platform:** Active Gemini API Key

---

## Installation & Environment Setup

### 1. Repository Initialization
Clone the source code to your local machine:
```bash
git clone https://github.com/Gagan-astatine/SCMS-GCD.git
cd SCMS-GCD
```

### 2. Backend Service Configuration
Initialize the Node.js server dependencies:
```bash
cd backend
npm install
```
Construct a `.env` file in the root of the `backend` directory with the following variables:
```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
```
Execute the backend service:
```bash
npm start
```

### 3. Client Service Configuration
In an independent terminal instance, initialize the React client:
```bash
cd scms
npm install
```
Construct a `.env` file in the root of the `scms` directory:
```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_API_URL=http://localhost:5000
```
Initialize the client development server:
```bash
npm start
```

---

## Deployment Architecture
- **Backend Infrastructure:** Designed for containerized or PaaS deployment on environments such as Render, AWS Elastic Beanstalk, or Heroku. Cross-Origin Resource Sharing (CORS) must be explicitly restricted to the production frontend domain.
- **Frontend Edge Deployment:** Optimized for edge delivery networks such as Vercel or AWS Amplify. The `REACT_APP_API_URL` environment variable must be mapped to the live production backend endpoint during the build process.

<br />
<div align="center">
  <i>Engineered with a focus on strict data governance, robust security protocols, and highly scalable system architecture.</i>
</div>
