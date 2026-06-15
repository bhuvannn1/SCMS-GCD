<div align="center">
  <h1>IGNIS - Supply Chain Management System</h1>
  <p>A comprehensive, AI-powered full-stack Supply Chain Management System designed to streamline logistics operations and proactive warehouse management.</p>
  
  <p>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" alt="Express.js" />
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Machine%20Learning-FF6F00?style=for-the-badge&logo=scikit-learn&logoColor=white" alt="Machine Learning" />
  </p>
</div>

---

## 📖 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Machine Learning Pipeline](#-machine-learning-pipeline-overflow-prediction)
- [Application Workflow](#-application-workflow)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
- [Production Deployment](#-production-deployment)

---

## 🌟 Overview
**IGNIS** is a sophisticated Supply Chain Management System (SCMS) that centralizes warehouse inventory management, fleet tracking, and multi-party communication. It provides distinct workflows for Business Owners, Buyers, and Drivers, backed by real-time analytics and predictive machine learning models to anticipate warehouse overflows before they occur.

---

## ✨ Key Features

- 🔐 **Role-Based Access Control:** Secure, customized dashboards tailored specifically for Owners/Sellers, Buyers, and Drivers.
- 📊 **Real-Time Analytics:** Interactive data visualizations monitoring warehouse capacity, inbound/outbound volume, and order statuses.
- 🗺️ **Intelligent Dispatch & Routing:** Live map-based tracking and fleet status monitoring using React-Leaflet integration.
- 💳 **Secure Payments:** Seamless Razorpay integration for buyers to execute secure load transactions.
- 🤖 **AI-Powered Assistant:** A contextual Gemini-powered AI chatbot capable of querying supply chain metrics and providing operational insights.
- 🌍 **Regional Localization:** Native Google Translate integration seamlessly converting the dashboard into English and 10 regional Indian languages.

---

## 🧠 Machine Learning Pipeline (Overflow Prediction)
The system employs an **Ensemble Machine Learning** approach (Random Forest + LSTM) to proactively predict warehouse overflow risks, ensuring zero operational downtime.

- **Feature Engineering:** Current inventory load, warehouse capacity, incoming shipment volume, load velocity (ΔInventory/ΔTime), and rolling averages.
- **Model Architecture:** 
  - **Random Forest Regressor:** Processes scalar features to predict near-term risk.
  - **LSTM (Long Short-Term Memory):** Analyzes the last 24 hourly snapshots to capture sequential load trends.
- **Weather Disruption Factor:** Dynamically integrates with the Google Weather API to augment risk probability (up to 1.35x) during severe weather events (e.g., cyclones, floods).
- **Predictive Outputs:** Actionable insights including **Overflow Risk Percentage**, **Expected Overflow Time**, and **Recommended Rerouting Actions**.

---

## 🔄 Application Workflow

1. **Authentication:** Secure onboarding via Supabase Auth with automatic role-based routing.
2. **Owner Operations:** Master database management, macro-analytics monitoring, fleet oversight, and AI-assisted decision making.
3. **Buyer Operations:** Dedicated portal for shipment assignment tracking, map-based delivery monitoring, and payment processing.
4. **Driver Operations:** Mobile-responsive interface for drivers to view assigned loads, update transit statuses, and track historical earnings.
5. **Cross-Platform Localization:** Instant dashboard translation into preferred regional languages via the top-navigation widget.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React.js (Create React App)
- **Routing:** React Router DOM
- **State Management:** Zustand
- **Visualization:** Recharts & React-Leaflet (Map View)
- **Styling:** Custom Modular CSS / Responsive Design

### Backend & ML
- **Runtime & Framework:** Node.js, Express.js
- **Database & Auth:** Supabase (PostgreSQL)
- **Payment Processing:** Razorpay API
- **AI Integration:** Google Generative AI (Gemini)
- **Machine Learning:** Random Forest Regressor & LSTM Ensemble (Scikit-Learn, TensorFlow)

---

## 📋 Prerequisites
Before you begin, ensure you have the following credentials and tools:
- **Node.js:** v18 or higher recommended
- **Supabase:** Database URL, Service Role Key, Anon Key
- **Razorpay:** Merchant Key ID and Key Secret
- **Google Gemini:** API Key

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Gagan-astatine/SCMS-GCD.git
cd SCMS-GCD
```

### 2. Backend Configuration
```bash
cd backend
npm install
```
Create a `.env` file in the root of the `backend` directory:
```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
```
Start the backend server:
```bash
npm start
```

### 3. Frontend Configuration
Open a new terminal window:
```bash
cd scms
npm install
```
Create a `.env` file in the root of the `scms` directory:
```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_API_URL=http://localhost:5000
```
Start the frontend server:
```bash
npm start
```

---

## 🌐 Production Deployment
- **Backend:** Configured for seamless deployment on platforms like Render or Heroku. Ensure CORS origins match the production frontend URL.
- **Frontend:** Optimized for Vercel. Ensure `REACT_APP_API_URL` environment variable points to your live backend.

<div align="center">
  <br />
  <i>Developed with a focus on ethical data practices, robust security standards, and scalable architecture.</i>
</div>
