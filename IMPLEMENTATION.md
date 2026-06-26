# FinanceAI — Implementation Guide

> A production-ready, full-stack personal finance assistant with AI-powered insights, budgeting, and goal tracking.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS | React framework with App Router, SSR, and Turbopack |
| **UI** | Shadcn UI (Radix primitives), Framer Motion | Accessible components + animations |
| **Charts** | Recharts | Financial graphs and analytics |
| **Styling** | Tailwind CSS 3.4, PostCSS | Utility-first responsive design |
| **Backend** | Node.js, Express.js, TypeScript | REST API server |
| **ORM** | Prisma 6 | Type-safe database client |
| **Database** | PostgreSQL (Neon) | Serverless Postgres with branching |
| **AI** | Google Gemini 2.0 Flash | Financial chat, insights, budget suggestions |
| **Auth** | JWT + Refresh Tokens + Google OAuth + TOTP MFA | Multi-factor authentication |
| **Email** | Resend | Transactional emails (verification, password reset, reports) |
| **Storage** | Cloudinary | Image uploads (receipts, avatars) |
| **Validation** | Zod | Runtime request validation |
| **State** | TanStack React Query | Server state management |
| **HTTP** | Axios | API client with interceptors |
| **Security** | Helmet, express-rate-limit, CORS, bcryptjs | Production security |
| **Container** | Docker, Docker Compose | Local dev environment with Postgres |

---

## Folder Structure

```
financeai/
├── backend/
│   ├── src/
│   │   ├── config/              # Environment config, Prisma client, env validation
│   │   │   ├── index.ts         # Centralized config object (dotenv)
│   │   │   ├── prisma.ts        # Prisma singleton + connection verification
│   │   │   └── validateEnv.ts   # Startup env validation
│   │   ├── middleware/
│   │   │   ├── auth.ts          # JWT authentication + role guard
│   │   │   └── error.ts         # Global error handler + AppError class
│   │   ├── routes/              # Express route handlers (thin controllers)
│   │   │   ├── auth.ts          # Register, login, refresh, logout, OAuth, email verification
│   │   │   ├── users.ts         # Profile, password, avatar, MFA, onboarding
│   │   │   ├── transactions.ts  # CRUD + summary + monthly trends
│   │   │   ├── budgets.ts       # CRUD + spending percentage calculation
│   │   │   ├── goals.ts         # CRUD + add funds + AI prediction
│   │   │   ├── chat.ts          # AI chat + intent routing + insights + health checks
│   │   │   ├── reports.ts       # CRUD + report generation with health score
│   │   │   ├── notifications.ts # CRUD + budget alerts + weekly email reports
│   │   │   ├── admin.ts         # Dashboard stats, user management, AI usage, audit logs
│   │   │   └── upload.ts        # Image upload to Cloudinary
│   │   ├── services/            # Business logic
│   │   │   ├── gemini.ts        # Google Gemini AI integration (chat, budgets, insights, predictions)
│   │   │   ├── intentDetection.ts # NLP intent classification for chat routing
│   │   │   ├── financeQuery.ts  # DB query helpers for AI financial context
│   │   │   ├── email.ts         # Resend email service + HTML templates
│   │   │   └── cloudinary.ts    # Cloudinary image upload service
│   │   ├── utils/
│   │   │   ├── jwt.ts           # JWT generation & verification (access + refresh)
│   │   │   ├── validators.ts    # Zod schemas for all endpoints
│   │   │   ├── asyncHandler.ts  # Async error wrapper for Express 4
│   │   │   └── crypto.ts        # Secure token generation & hashing
│   │   └── types/
│   │       └── index.ts         # Shared TypeScript types (AuthUser, JwtPayload, etc.)
│   └── prisma/
│       └── schema.prisma        # Database schema (10 models, 6 enums)
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx       # Root layout (Inter font, Providers)
│       │   ├── page.tsx         # Landing page
│       │   ├── globals.css      # Tailwind directives + custom styles
│       │   ├── (auth)/          # Auth pages (login, register, forgot-password, etc.)
│       │   ├── (app)/           # Authenticated pages (dashboard, transactions, etc.)
│       │   │   └── layout.tsx   # Sidebar + header + nav
│       │   └── onboarding/      # Onboarding wizard
│       ├── components/
│       │   ├── ui/              # Shadcn UI primitives (button, card, dialog, etc.)
│       │   └── auth/            # Auth-specific components (Google sign-in button)
│       ├── lib/
│       │   ├── api.ts           # Axios client + API methods for all endpoints
│       │   ├── auth-context.tsx  # Auth state management + redirect logic
│       │   └── utils.ts         # Formatting helpers (currency, dates, colors)
│       └── middleware.ts         # Next.js middleware (minimal, root path only)
├── docker-compose.yml           # Backend + Frontend + Postgres
└── Dockerfile (backend + frontend)
```

---

## Features

### 1. Smart Dashboard
- Real-time financial overview with total balance, income vs. expenses
- Expense breakdown by category (pie/bar charts via Recharts)
- Monthly trends (last 6 months income/expenses)
- Recent transactions and quick action shortcuts
- Skeleton loading states and error fallbacks

### 2. Transaction Management
- Full CRUD with pagination, search, and filtering (type, category, date range)
- 12 predefined categories (FOOD, TRAVEL, SHOPPING, BILLS, RENT, INVESTMENT, ENTERTAINMENT, HEALTHCARE, EDUCATION, SALARY, FREELANCE, OTHER)
- CSV/Excel export support via xlsx library
- Auto-updates budget spent amounts on expense creation

### 3. AI Financial Assistant
- ChatGPT-like chat interface with Google Gemini 2.0 Flash
- **Intent detection** — queries are classified as direct DB lookup or AI analysis:
  - *Direct DB*: income, expenses, savings, balance, budget status, food expenses, category spending, goals, goal progress, recent transactions (sub-second responses)
  - *AI-powered*: budget creation, spending analysis, savings advice, financial insights, general chat (richer responses)
- Financial context builder — automatically includes user's financial data in AI prompts
- Graded error handling for AI failures (auth, quota, rate limit, safety, model, network errors)

### 4. Budget Generator
- AI-generated monthly budgets based on income and spending patterns
- 50/30/20 rule recommendations
- Per-category budget tracking with progress bars
- Real-time spending vs. budget percentage display
- Automatic budget creation from transactions

### 5. Savings Goals
- Track goals with target amount, deadline, and monthly targets
- AI-powered savings predictions with estimated completion dates
- Goal health scores (1-100) based on progress and time
- Add funds and auto-mark as completed on reaching target

### 6. Financial Insights
- AI-generated weekly financial health summaries
- Spending pattern analysis
- Savings rate evaluation
- Actionable recommendations (3-5 insights per analysis)

### 7. Reports
- Generate weekly/monthly/yearly/custom reports
- Financial health scoring based on savings rate
- Category breakdown and goal progress included
- Export-ready data structure

### 8. Notifications
- Budget alerts at 80% and 100% usage thresholds
- Overspending warnings
- Weekly email report delivery
- Goal progress updates
- Mark as read / delete / mark all as read

### 9. Authentication & Security
- Email/password registration with strong password requirements
- Google OAuth login
- JWT access tokens (15min) + refresh tokens (7 days) with rotation
- Email verification flow
- Password reset flow
- TOTP-based Multi-Factor Authentication (via otplib + QR codes)
- Rate limiting on auth endpoints (20 req/15min)
- Helmet security headers
- CORS with multi-origin support + Vercel preview deployments

### 10. Admin Panel
- User management (list, search, role change, delete)
- Platform analytics (total users, active users, transactions, AI usage)
- Audit log viewer
- AI usage statistics

---

## Database Schema (Prisma)

### Models

| Model | Fields | Purpose |
|-------|--------|---------|
| **User** | id, email, password, name, avatar, role, isEmailVerified, mfaEnabled, mfaSecret, provider, providerId, onboardingDone | Core user account |
| **RefreshToken** | id, token, userId, expiresAt | JWT refresh token storage with rotation |
| **EmailVerification** | id, token, userId, expiresAt, used | Email verification tokens |
| **PasswordReset** | id, token, userId, expiresAt, used | Password reset tokens |
| **Transaction** | id, amount, type, category, description, date, receiptUrl, userId | Financial transactions (income/expense) |
| **Budget** | id, name, amount, category, month, year, spent, userId | Monthly budget per category (unique per user/category/month/year) |
| **SavingsGoal** | id, name, targetAmount, currentAmount, deadline, monthlyTarget, priority, status, userId | Savings goals with progress tracking |
| **Report** | id, type, startDate, endDate, data (JSON), fileUrl, userId | Generated financial reports |
| **Notification** | id, title, message, type, read, userId | Budget alerts, overspending, reports, goals |
| **ChatHistory** | id, role, content, userId | AI chat conversation history |
| **FinancialInsight** | id, type, title, content, severity, read, userId | AI-generated financial insights |
| **BankAccount** | id, name, type, balance, currency, plaidToken, lastSyncedAt, isActive, userId | Linked bank accounts |
| **AuditLog** | id, action, entity, entityId, userId, details (JSON), ipAddress | Admin audit trail |

### Enums

| Enum | Values |
|------|--------|
| **Role** | USER, ADMIN |
| **TransactionType** | INCOME, EXPENSE |
| **Category** | FOOD, TRAVEL, SHOPPING, BILLS, RENT, INVESTMENT, ENTERTAINMENT, HEALTHCARE, EDUCATION, SALARY, FREELANCE, OTHER |
| **Priority** | LOW, MEDIUM, HIGH |
| **GoalStatus** | ACTIVE, COMPLETED, CANCELLED |
| **ReportType** | WEEKLY, MONTHLY, YEARLY, CUSTOM |
| **NotificationType** | BUDGET_ALERT, OVERSPENDING, GOAL_PROGRESS, WEEKLY_REPORT, MONTHLY_REPORT, SYSTEM |

---

## Authentication Flow

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│  Client  │          │  Backend │          │  Prisma  │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │  POST /auth/register│                     │
     │  {email,password,   │                     │
     │   name}             │                     │
     ├────────────────────►│                     │
     │                     │  Hash password      │
     │                     │  (bcrypt, 12 rounds)│
     │                     │                     │
     │                     │  Create user        │
     │                     ├────────────────────►│
     │                     │◄────────────────────┤
     │                     │                     │
     │                     │  Create verification│
     │                     │  token + send email │
     │                     │  (via Resend)       │
     │                     │                     │
     │                     │  Generate JWT pair  │
     │                     │  (access: 15m,      │
     │                     │   refresh: 7d)      │
     │                     │                     │
     │  {user, accessToken}│                     │
     │  Set refreshToken   │                     │
     │  as httpOnly cookie◄┤                     │
     │◄────────────────────┤                     │
     │                     │                     │
     │  [Access token      │                     │
     │   expired: 401]     │                     │
     │                     │                     │
     │  POST /auth/refresh |                     │
     │  (cookie sent       │                     │
     │   automatically)    │                     │
     ├────────────────────►│                     │
     │                     │  Verify refresh     │
     │                     │  token in DB        │
     │                     │  Delete old token   │
     │                     │  Rotate → new pair  │
     │                     │                     │
     │  {accessToken}      │                     │
     │  Set new refresh    │                     │
     │  token cookie       │                     │
     │◄────────────────────┤                     │
```

### Key Auth Features:
- **Password policy**: min 8 chars, 1 uppercase, 1 lowercase, 1 number
- **Email verification**: 24-hour token, sent on registration
- **Password reset**: 1-hour token, invalidates all refresh tokens on reset
- **MFA**: TOTP via authenticator apps, QR code generation, setup → verify → enable flow
- **Token rotation**: Each refresh generates a new pair, old token is deleted
- **Rate limiting**: 20 attempts per 15 minutes on auth endpoints
- **Google OAuth**: PKCE flow, links existing accounts by email

---

## API Design

### Base URL: `http://localhost:5000/api`

### Standard Response Format
```json
// Success
{ "success": true, "data": {}, "message": "..." }

// Error
{ "success": false, "error": "...", "message": "..." }
```

### Pagination
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Endpoints

#### Auth (`/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Register new user |
| POST | `/login` | No | Login (supports MFA) |
| POST | `/refresh` | Cookie | Rotate refresh token |
| POST | `/logout` | Cookie | Clear refresh token |
| GET | `/verify-email?token=` | No | Verify email address |
| POST | `/forgot-password` | No | Send reset email |
| POST | `/reset-password` | No | Reset password with token |
| GET | `/google` | No | Google OAuth redirect |
| GET | `/google/callback` | No | Google OAuth callback |
| GET | `/me` | JWT | Get current user |

#### Users (`/users`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/profile` | JWT | Get profile |
| PUT | `/profile` | JWT | Update profile |
| PUT | `/password` | JWT | Change password |
| POST | `/avatar` | JWT | Upload avatar |
| POST | `/onboarding` | JWT | Complete onboarding |
| POST | `/mfa/setup` | JWT | Generate MFA secret + QR |
| POST | `/mfa/verify` | JWT | Verify & enable MFA |
| POST | `/mfa/disable` | JWT | Disable MFA |

#### Transactions (`/transactions`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List (paginated, filterable) |
| GET | `/summary` | JWT | Dashboard data (income, expenses, trends) |
| POST | `/` | JWT | Create (auto-updates budgets) |
| PUT | `/:id` | JWT | Update |
| DELETE | `/:id` | JWT | Delete |

#### Budgets (`/budgets`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List (monthly with spending %) |
| POST | `/` | JWT | Create or upsert |
| PUT | `/:id` | JWT | Update |
| DELETE | `/:id` | JWT | Delete |

#### Goals (`/goals`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List with progress + health scores |
| POST | `/` | JWT | Create |
| PUT | `/:id` | JWT | Update |
| POST | `/:id/add-funds` | JWT | Add funds (auto-completes) |
| GET | `/:id/predict` | JWT | AI prediction |
| DELETE | `/:id` | JWT | Delete |

#### Chat (`/chat`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | JWT | Send message (auto routes via intent detection) |
| GET | `/history` | JWT | Get conversation history |
| DELETE | `/history` | JWT | Clear history |
| POST | `/generate-budget` | JWT | AI budget generator |
| GET | `/insights` | JWT | AI financial insights |
| GET | `/insights/history` | JWT | Past insights |
| GET | `/health` | No | AI health check |
| GET | `/health/test-key` | No | Test API key validity |

#### Reports (`/reports`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List generated reports |
| POST | `/generate` | JWT | Generate report (with health score) |
| GET | `/:id` | JWT | Get single report |
| DELETE | `/:id` | JWT | Delete |

#### Notifications (`/notifications`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List (filterable by read status) |
| PATCH | `/:id/read` | JWT | Mark as read |
| PATCH | `/read-all` | JWT | Mark all as read |
| DELETE | `/:id` | JWT | Delete |
| GET | `/check-budgets` | JWT | Check and create budget alerts |
| POST | `/send-weekly-report` | JWT | Send weekly email report |

#### Admin (`/admin`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard` | Admin | Platform stats |
| GET | `/users` | Admin | List all users |
| PATCH | `/users/:id/role` | Admin | Change user role |
| DELETE | `/users/:id` | Admin | Delete user |
| GET | `/transactions` | Admin | All transactions |
| GET | `/ai-usage` | Admin | AI usage statistics |
| GET | `/audit-logs` | Admin | Audit trail |

#### Upload (`/upload`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/image` | JWT | Upload image to Cloudinary |

### Error Handling
```json
// Validation error (400)
{ "success": false, "error": "Validation failed", "details": ["email: Invalid email"] }

// Auth error (401)
{ "success": false, "error": "Invalid or expired token" }

// Forbidden (403)
{ "success": false, "error": "Admin access required" }

// Not found (404)
{ "success": false, "error": "Record not found" }

// Conflict (409)
{ "success": false, "error": "A record with this email already exists" }

// Rate limited (429)
{ "success": false, "error": "Too many requests, please try again later." }

// Server error (500)
{ "success": false, "error": "Internal server error" }

// DB unavailable (503)
{ "success": false, "error": "Database temporarily unavailable" }
```

---

## Deployment

### Frontend → Vercel
1. Connect GitHub repo to Vercel
2. Framework: Next.js
3. Environment variable: `NEXT_PUBLIC_API_URL` (points to Render backend)
4. Build command: `npm run build`
5. Output directory: `.next`

### Backend → Render
1. Create Web Service, connect GitHub
2. Build command: `npm install && npm run build`
3. Start command: `npx prisma migrate deploy && node dist/index.js`
4. Environment: Set all variables from `.env.example`

### Database → Neon
1. Create project at neon.tech
2. Use pooled connection string as `DATABASE_URL`
3. Use direct connection string as `DIRECT_URL` (for migrations)

### Docker (Local Development)
```bash
docker-compose up -d
# Runs: backend (5000) + frontend (3000) + postgres (5432)
```

### Key Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon pooled connection string |
| `JWT_SECRET` | ✅ | Access token signing secret |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token signing secret |
| `GEMINI_API_KEY` | ⚠️ | Google Gemini key (AI features disabled without it) |
| `GOOGLE_CLIENT_ID` | ⚠️ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ⚠️ | Google OAuth client secret |
| `CLOUDINARY_CLOUD_NAME` | ⚠️ | Cloudinary config (uploads disabled) |
| `RESEND_API_KEY` | ⚠️ | Resend config (emails disabled) |
| `FRONTEND_URL` | ⚠️ | CORS origin (default: localhost:3000) |

---

## Coding Standards

- **TypeScript strict mode** throughout
- **Prisma only** — no raw SQL or MongoDB
- **Zod validation** on every request body
- **Thin controllers** — routes call services, no business logic in handlers
- **Error handling** — every route wrapped in `asyncHandler`, centralized error middleware
- **No hardcoded URLs** — all config via environment variables
- **Keep files under 300 lines** where practical
- **ES Modules** throughout (import/export, not require)
- **Consistent naming**: files use kebab-case, classes PascalCase, functions camelCase
- **Graceful degradation** — AI failures show fallback data instead of crashing
