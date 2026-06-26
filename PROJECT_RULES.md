# Project Rules — FinanceAI

> Rules for maintaining code quality, consistency, and best practices throughout the FinanceAI codebase. These rules apply to all development, especially AI-assisted code generation.

---

## 🚫 Never Do These

- **Never create duplicate code** — always reuse existing functions, components, and utilities
- **Never use MongoDB** — this project uses PostgreSQL (Neon) with Prisma ORM exclusively
- **Never use raw SQL** — use Prisma queries for all database access
- **Never hardcode URLs or secrets** — use environment variables via the centralized config
- **Never cast to `any` type** — prefer proper TypeScript types, interfaces, or generics
- **Never commit `.env` files** — use `.env.example` as a template
- **Never use `require()`** — use ES Module `import`/`export` syntax only

---

## ✅ Always Do These

### Architecture & Patterns

- **Keep controllers thin** — route handlers delegate to services; no business logic in route files
- **Business logic belongs in services** (e.g., `gemini.ts`, `financeQuery.ts`, `email.ts`)
- **Use Prisma only** — no direct database drivers, no raw queries outside of `$queryRaw` for health checks
- **Validate every request** — use Zod schemas defined in `utils/validators.ts`
- **Wrap async routes** — use `asyncHandler` from `utils/asyncHandler.ts` for every async route
- **Error handling on every API** — centralized error middleware handles all error types (Zod, Prisma, AppError, generic)
- **Every API returns consistent JSON** — use `{ success, data, message }` or `{ success, error }` formats
- **Use HTTP status codes correctly** — 201 for creation, 200 for success, 4xx for client errors, 5xx for server errors

### Frontend

- **Every component must be responsive** — use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`)
- **Reuse Shadcn UI components** — don't create new button, card, dialog, input, etc. from scratch
- **Use TanStack React Query** for all server state — no direct `useEffect` + `fetch` for API calls
- **Handle loading, error, and empty states** — show skeleton loaders, error fallbacks, and empty state messages
- **Use Framer Motion sparingly** — only for meaningful animations (page transitions, mobile menus)
- **Import icons from `lucide-react`** — use meaningful icon names and tree-shake imports
- **Use `motion.div` for staggered animations** — wrap lists with `AnimatePresence` and stagger children
- **Prefix API client methods with the domain** — e.g., `transactionsApi.create()`, `budgetsApi.list()`

### Backend

- **Use the config singleton** — `import { config } from '../config'` instead of `process.env` directly
- **Zod schemas live in `utils/validators.ts`** — shared, reusable, and exported
- **Auth middleware** — `authenticate` for JWT validation, `requireAdmin` for admin-only routes
- **Use `AppError` class** for throwing HTTP errors: `throw new AppError(statusCode, message)`
- **Never expose stack traces** — production error responses hide internal details
- **Graceful degradation for AI** — Gemini failures fall back to database-derived financial data
- **Rate limit auth endpoints** — 20 requests per 15 minutes for login/register
- **Log with emoji prefixes** — `🚀`, `✅`, `⚠️`, `❌`, `💥` for visual log scanning
- **Graceful shutdown** — listen for SIGTERM/SIGINT, disconnect Prisma, force exit after 10s

### Code Quality

- **Keep files under 300 lines** where practical; split large files into modules
- **Use TypeScript strict mode** — no implicit any, strict null checks enabled
- **Name files with kebab-case** — e.g., `auth-context.tsx`, `finance-query.ts`
- **Use PascalCase for types, interfaces, enums, and classes**
- **Use camelCase for functions, variables, and methods**
- **Use UPPER_SNAKE_CASE for environment variable names and constants**
- **Document complex logic** with JSDoc or inline comments (but prefer self-documenting code)
- **Remove unused imports, variables, and files** after making changes
- **Run type checking (`tsc --noEmit`) before committing**

### TypeScript Patterns

- **Define shared types in `backend/src/types/index.ts`**
- **Use Prisma-generated types** for database models (e.g., `Transaction`, `Budget` from `@prisma/client`)
- **Extend Express Request** via `AuthRequest` interface for authenticated routes
- **Use Zod inference** — `z.infer<typeof schema>` for handler parameter types
- **Avoid `Record<string, any>`** — prefer specific interfaces or generics
- **Use strict equality** (`===`/`!==`) — never loose equality (`==`/`!=`)

### Git Practices

- **Write descriptive commit messages** — prefix with type: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **Don't commit `node_modules/`, `.next/`, `dist/`, `.env` files**
- **Rebase feature branches before merging** to keep a linear history
- **Review your own diff before pushing** to catch issues early

### Testing & Validation

- **Run `npx tsc --noEmit` in the backend** to check for type errors
- **Run `next lint` in the frontend** before committing
- **Test error states** — test with invalid tokens, missing data, and AI failures
- **Verify Prisma schema changes** with `npx prisma db push` locally before deploying
- **Test the build** — `npm run build` in both frontend and backend should succeed

---

## AI-Specific Rules

When using AI to generate or modify code:

1. **Read existing files first** — understand patterns before suggesting changes
2. **Verify libraries exist** — check `package.json` before importing a new package
3. **Follow existing conventions** — match the coding style of neighboring files
4. **Don't remove existing functionality** — assume every line of code has a purpose
5. **Reuse existing components** — don't reimplement UI primitives, API methods, or helpers
6. **Add imports** — always include necessary imports when creating or modifying files
7. **Remove dead code** — clean up replaced functions, unused imports, and stale comments
8. **Validate with the build step** — run type checks after making changes
9. **Keep changes minimal** — implement only what was requested, no scope creep
