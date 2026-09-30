# LendFlow Backend API

RESTful API backend for LendFlow (Personal Debt & Lending Ledger) built with Node.js, Express, TypeScript, and MongoDB.

## Features
- JWT Authentication (Register, Login, Me)
- Transactions Ledger (`LENT` / "You'll Get" & `BORROWED` / "You'll Give")
- Partial Payments & Settlement Tracking
- 1-Click Settle in Full
- Aggregated Contacts Ledger
- Dashboard Analytics (Net financial position, overdue & upcoming alerts)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env`:
   ```bash
   PORT=5000
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   ```
3. Run development:
   ```bash
   npm run dev
   ```
4. Build & start for production:
   ```bash
   npm run build
   npm start
   ```
