# 🚀 FinanceAI — Your AI-Powered Financial Companion

> A production-ready, full-stack personal finance assistant with AI-powered insights, budgeting, and goal tracking.

## ✨ Features

- **Smart Dashboard** — Real-time financial overview with charts and analytics
- **Transaction Management** — CRUD with search, filter, sort, and CSV/Excel export
- **AI Financial Assistant** — ChatGPT-like AI powered by Google Gemini for financial advice
- **Budget Generator** — AI-generated monthly budgets with progress tracking
- **Savings Goals** — Track goals with AI predictions and health scores
- **Financial Insights** — AI-powered weekly insights and recommendations
- **Reports** — Generate weekly/monthly/yearly reports with financial health scores
- **Notifications** — Budget alerts, overspending warnings, and goal progress
- **Admin Panel** — User management, analytics, and AI usage tracking
- **Authentication** — Email/password, Google OAuth, JWT, MFA support

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Shadcn UI, Recharts, Framer Motion |
| Backend | Node.js, Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL (Neon) |
| AI | Google Gemini API |
| Auth | JWT + Refresh Tokens, Google OAuth, TOTP MFA |
| Email | Resend |
| Storage | Cloudinary |

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (Neon recommended)
- Google Gemini API key

### 1. Clone & Install

```bash
git clone <repo-url>
cd financeai

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your API URL
```

### 3. Database Setup

```bash
cd backend
npx prisma generate
npx prisma db push
# Optional: npx prisma db seed
```

### 4. Run Development

```bash
# Backend (port 5000)
cd backend && npm run dev

# Frontend (port 3000)
cd frontend && npm run dev
```

### 5. Docker (Alternative)

```bash
docker-compose up -d
```

## 📁 Project Structure

```
financeai/
├── backend/
│   ├── src/
│   │   ├── config/         # Config, Prisma client
│   │   ├── middleware/      # Auth, error handling
│   │   ├── routes/          # API routes
│   │   ├── services/        # Email, AI, Cloudinary
│   │   ├── utils/           # JWT, validators, helpers
│   │   └── types/           # TypeScript types
│   └── prisma/
│       └── schema.prisma    # Database schema
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router pages
│       │   ├── auth/        # Login, register, etc.
│       │   ├── (app)/       # Authenticated routes
│       │   │   ├── dashboard/
│       │   │   ├── transactions/
│       │   │   ├── budget/
│       │   │   ├── goals/
│       │   │   ├── ai/
│       │   │   ├── reports/
│       │   │   ├── notifications/
│       │   │   ├── admin/
│       │   │   └── settings/
│       │   └── onboarding/
│       ├── components/      # UI components
│       └── lib/             # API client, utils, auth
└── docker-compose.yml
```

## 🔐 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Register new user |
| `POST /api/auth/login` | Login with email/password |
| `GET /api/auth/google` | Google OAuth login |
| `GET /api/transactions` | List transactions |
| `POST /api/transactions` | Create transaction |
| `GET /api/budgets` | List budgets |
| `POST /api/budgets` | Create budget |
| `GET /api/goals` | List savings goals |
| `POST /api/goals` | Create savings goal |
| `POST /api/chat` | Send AI chat message |
| `GET /api/chat/insights` | Get AI insights |
| `POST /api/reports/generate` | Generate report |
| `GET /api/admin/dashboard` | Admin dashboard |

## 🌐 Deployment

### Frontend → Vercel
1. Push to GitHub
2. Import in Vercel
3. Set `NEXT_PUBLIC_API_URL` environment variable
4. Deploy

### Backend → Render
1. Create a new Web Service
2. Connect GitHub repo
3. Set build command: `npm install && npx prisma generate`
4. Set start command: `npx prisma migrate deploy && node dist/index.js`
5. Add all environment variables

### Database → Neon
1. Create a new project at neon.tech
2. Copy connection string
3. Set `DATABASE_URL` and `DIRECT_URL`

## 📄 License

MIT

---

Built with ❤️ for your financial wellness.
