# MultiShield — AI-Driven Zero Trust Early Warning System

A full-stack prototype demonstrating an **AI-Driven Zero Trust Security Platform** that monitors insider activity within banking systems and detects/blocks suspicious activities in real time.

## Architecture

```
┌─────────────────────────┐     REST API      ┌─────────────────────────┐
│  Dummy Banking System   │ ──────────────────→│  Security Platform       │
│  (Port 3001 / 5173)     │ ←──────────────────│  (Port 3002 / 5174)      │
│                         │   Risk Analysis    │                          │
│  • Treasury Operations  │   & Decisions      │  • AI Risk Engine        │
│  • Loan Management      │                    │  • Policy Decision Engine│
│  • Customer Database    │                    │  • Incident Management   │
└─────────────────────────┘                    └─────────────────────────┘
```

## Quick Start

### 1. Start Security Platform Backend (Port 3002)
```bash
cd security-platform/backend
npm install
npm start
```

### 2. Start Banking System Backend (Port 3001)
```bash
cd dummy-banking-system/backend
npm install
npm start
```

### 3. Start Banking System Frontend (Port 5173)
```bash
cd dummy-banking-system/frontend
npm install
npm run dev
```

### 4. Start Security Platform Frontend (Port 5174)
```bash
cd security-platform/frontend
npm install
npm run dev
```

### Access the Applications
- **Banking System**: http://localhost:5173
- **Security Platform**: http://localhost:5174

### Demo Credentials (Banking System)
| Username | Password | Role |
|----------|----------|------|
| rajesh.kumar | pass123 | Treasury Operator |
| priya.sharma | pass123 | Loan Officer |
| amit.patel | pass123 | Database Admin |

## Integration Flow

1. User performs action in Banking System (e.g., large withdrawal)
2. Banking System sends activity data to Security Platform API
3. AI Risk Engine scores the activity (0-100)
4. Policy Engine returns: **ALLOW** / **REQUIRE_MFA** / **BLOCK**
5. Banking System shows result to user

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | SQLite (sql.js) |
| Frontend | React + Vite |
| API Format | JSON REST |