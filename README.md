# 🛡️ MultiShield
### AI-Driven Zero Trust Early Warning System & Insider Threat Mitigation Platform

> **MultiShield** is an enterprise-grade, full-stack cybersecurity platform implementing **Zero Trust Architecture (ZTA)**, **AI-powered behavioral analytics**, and **blockchain-backed audit logging** for core banking environments.
>
> It acts as an **inline Policy Enforcement Point (PEP)** that continuously evaluates every user login, API request, and financial transaction before granting access.

---

# 🚀 Overview

Traditional banking systems often authenticate users only once at login, leaving systems vulnerable to insider threats, privilege abuse, account compromise, and sophisticated fraud.

**MultiShield** follows the **"Never Trust, Always Verify"** principle by continuously verifying users throughout every interaction.

The platform combines:

- 🔐 Zero Trust Access Control
- 🤖 AI Behavioral Risk Analysis
- 🚨 Insider Threat Detection
- 💰 Anti-Fraud Transaction Monitoring
- 🌍 Context-Aware Geofencing
- 🔑 Adaptive Multi-Factor Authentication
- ⛓️ Blockchain-based Immutable Audit Logs

---

# 🏗️ System Architecture

```text
                         ┌──────────────────────────────┐
                         │        Client Layer          │
                         │ ──────────────────────────── │
                         │ Banking Portal (React)       │
                         │ Admin Dashboard (React)      │
                         └──────────────┬───────────────┘
                                        │
                              REST APIs │ JWT
                                        ▼
                    ┌────────────────────────────────────┐
                    │ Zero Trust Access Gateway (PEP)    │
                    │ Continuous Verification            │
                    │ RBAC + Session Validation          │
                    └──────────────┬─────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌────────────────────────────┐                ┌─────────────────────────────┐
│ AI Behavioral Risk Engine  │                │ Transaction Risk Engine     │
│ FastAPI + Random Forest    │                │ Insider Threat Detection    │
│ Ensemble ML Models         │                │ Anti-Structuring Rules      │
└──────────────┬─────────────┘                └──────────────┬──────────────┘
               └────────────────────┬────────────────────────┘
                                    ▼
                     ┌────────────────────────────────┐
                     │ Adaptive Policy Decision Engine │
                     │ ALLOW • MFA • APPROVAL • DENY  │
                     └──────────────┬─────────────────┘
                                    ▼
                 ┌──────────────────────────────────────┐
                 │ Blockchain Audit Logger              │
                 │ SHA-256 → Ethereum Sepolia           │
                 │ Tamper Detection                     │
                 └──────────────────────────────────────┘
```

---

# ✨ Key Features

## 🔐 Zero Trust Access Gateway

Implements a Policy Enforcement Point (PEP) that continuously verifies every request rather than trusting a user after login.

### Features

- Continuous JWT verification
- Session validation
- Dynamic Role-Based Access Control (RBAC)
- Keycloak OIDC/OAuth2 Integration
- Least Privilege Enforcement
- Continuous authorization checks

---

## 🤖 AI Behavioral Risk Engine

A dedicated Python FastAPI microservice evaluates user behavior using Machine Learning.

### ML Models

- Random Forest
- Ensemble Learning
- Explainable AI (XAI)

### Behavioral Features

The model evaluates multiple behavioral indicators including:

- Off-hour logins
- USB device usage
- Large file transfers
- Multi-device login attempts
- Privilege escalation
- Login frequency
- Session anomalies
- Suspicious activity patterns
- Historical behavior deviations

### Output

Returns:

- Behavioral Risk Score (0–100)
- Feature importance (Explainable AI)
- Confidence score

If the ML service becomes unavailable, the platform automatically switches to a **heuristic-based fallback engine**, ensuring uninterrupted protection.

---

## 🚨 Insider Threat Detection

Detects risky activities performed by legitimate users.

### Examples

- Database Administrator initiating cash withdrawals
- IT Support issuing debit cards
- HR employee approving financial transactions
- Unauthorized privilege escalation
- Abnormal transaction behavior

The engine analyzes:

- Role-action mismatches
- Transaction frequency spikes
- Transaction amount anomalies
- Time-based anomalies
- Device authorization
- User history

---

## 💰 Anti-Fraud Structuring Engine

Detects **transaction splitting (Smurfing)** designed to bypass banking thresholds.

The engine performs a **24-hour rolling analysis** across previous transactions.

### Automated Response Levels

| Matches | Action |
|---------|--------|
| 1 | Warning Banner |
| 2 | 30-second Forced Delay + Incident Logged |
| 3+ | Account Suspended + Transaction Denied |

---

## 🛡️ Adaptive Policy Decision Engine

Combines:

- 50% Behavioral AI Score
- 50% Transaction Risk Score

to generate a unified risk score.

### Security Decisions

| Score | Action |
|--------|--------|
| 0–39 | ✅ ALLOW |
| 40–59 | 📝 JUSTIFY |
| 60–89 | 🔑 REQUIRE_MFA |
| 90–100 | 👤 ADMIN_APPROVAL |
| Critical Threat | ❌ DENY |

This enables dynamic, context-aware security decisions.

---

## 🌍 Context-Aware Security

### Geofencing

- Geo-IP validation
- Region-based access control
- Instant kill-switch for unauthorized countries
- Suspicious location detection

### Temporal Micro-Segmentation

Traffic originating during unusual working hours is automatically redirected into a sandbox environment for additional inspection.

---

## 🔑 Multi-Stage Adaptive MFA

Instead of relying on a single OTP, MultiShield enforces progressive authentication.

### Authentication Flow

1. Employee ID Verification
2. Password Authentication
3. Simulated Biometric Scan
4. Admin Hexcode OTP

Additional protection:

- Automatic lockout after biometric failures
- Session validation
- Risk-based MFA triggering

---

## ⛓️ Blockchain Audit Logging

Every security event is converted into a cryptographic fingerprint.

### Workflow

Security Event

↓

SHA-256 Hash

↓

Ethereum Sepolia Smart Contract

↓

Immutable Audit Record

↓

Tamper Verification

### Benefits

- Immutable audit trail
- Tamper detection
- Compliance support
- Transparent security logs
- Blockchain-backed integrity verification

---

# 🧠 Technology Stack

| Layer | Technology |
|---------|------------|
| Frontend | React, Vite, CSS |
| Backend | Node.js, Express.js |
| AI/ML | Python, FastAPI, Scikit-Learn |
| Machine Learning | Random Forest, Ensemble Models |
| Identity Provider | Keycloak (OIDC/OAuth2) |
| Database | SQLite (sql.js) |
| Blockchain | Ethereum Sepolia |
| Smart Contracts | Solidity |
| Web3 | Ethers.js |
| Authentication | JWT |
| Infrastructure | Docker, Docker Compose |

---

# 📂 Project Structure

```text
MultiShield/
│
├── dummy-banking-system/
│   ├── frontend/
│   └── backend/
│
├── security-platform/
│   ├── frontend/
│   └── backend/
│
├── ml-service/
│   ├── FastAPI
│   ├── Models
│   └── Prediction API
│
├── blockchain/
│   ├── AuditLogStore.sol
│   └── Deployment Scripts
│
├── docker-compose.yml
└── README.md
```
---

# 🔄 Risk Evaluation Workflow

```text
User Login

↓

JWT Verification

↓

RBAC Validation

↓

Behavioral ML Analysis

↓

Transaction Risk Analysis

↓

Adaptive Policy Engine

↓

ALLOW
JUSTIFY
REQUIRE MFA
ADMIN APPROVAL
DENY

↓

Blockchain Audit Logging
```

---

# 🎯 Security Highlights

- ✅ Zero Trust Architecture
- ✅ Continuous Authentication
- ✅ AI Behavioral Analytics
- ✅ Insider Threat Detection
- ✅ Explainable AI (XAI)
- ✅ Fraud Detection
- ✅ Transaction Structuring Detection
- ✅ Dynamic Policy Enforcement
- ✅ Adaptive MFA
- ✅ Geofencing
- ✅ Sandbox Isolation
- ✅ Blockchain Audit Trail
- ✅ Tamper Detection
- ✅ Web3 Integration

---

# 🔮 Future Enhancements

- SIEM Integration (Splunk, ELK)
- Kafka Event Streaming
- Real-time Threat Intelligence Feeds
- Deep Learning Behavioral Models
- Kubernetes Deployment
- Multi-Cloud Support
- Digital Twin Security Simulation
- Real-time SOC Dashboard
- Mobile Push Authentication
- Graph Neural Network Insider Detection

---

# 📄 License

This project is intended for **educational, research, and demonstration purposes**. It showcases the implementation of modern cybersecurity principles including Zero Trust Architecture, AI-driven threat detection, adaptive authentication, and blockchain-backed audit logging for banking systems.

---

# 👨‍💻 Authors

Developed as an academic and cybersecurity innovation project focused on **Zero Trust Banking Security**, **AI-powered Insider Threat Detection**, and **Next-Generation Financial Infrastructure Protection**.
