## Campus Management System (CMS)

Monorepo for the Campus Management System built with Next.js, Fastify, and Prisma. The project delivers three flagship capabilities: Freelancer Hub, Exam Integrity Suite, and Attendance Intelligence across dedicated Admin, Lecturer, and Student interfaces.

### Repository Structure
- `apps/web` — Next.js 16 App Router frontend (TypeScript, Tailwind).
- `apps/api` — Fastify-based API gateway for core backend services.
- `packages/database` — Shared Prisma schema, migrations, and client wrapper.
- `docs/architecture.md` — High-level solution design.
- `docs/roadmap.md` — Phase-by-phase implementation plan.

### Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment variables**
   - Copy `env.example` to `.env` (or your preferred local file) and adjust values.
   - Copy `apps/web/env.example` to `apps/web/.env.local`.
   - Copy `apps/api/env.example` to `apps/api/.env`.
3. **Generate Prisma client**
   ```bash
   npm run generate --workspace @cms/database
   ```
4. **Apply schema to your database (development)**
   ```bash
   npm run migrate:dev --workspace @cms/database -- --name init
   ```
   > If PostgreSQL is not available yet, leave `NEXTAUTH_USE_PRISMA=false` to stay in demo mode and revisit this step later.
5. **Seed sample data (requires reachable PostgreSQL instance)**
   ```bash
   npm run seed --workspace @cms/database
   ```
   _Default credentials_: `admin@example.edu`, `lecturer@example.edu`, `student@example.edu` all use the password `ChangeMe123!`.
6. **Run development servers**
   - Web: `npm run dev:web`
   - API: `npm run dev:api`
   - Tests: `npm run test --workspace web`, `npm run test --workspace api`

### Available Scripts
- `npm run lint` — Run linting across workspaces (Next.js + Fastify codebases).
- `npm run build` — Build all workspaces.
- `npm run dev:web` — Start Next.js development server on port 3000.
- `npm run dev:api` — Start Fastify API on port 4000.
- `npm run seed --workspace @cms/database` — Populate the database with baseline roles, users, and sample data.
- `npm run test --workspace web` / `npm run test --workspace api` — Execute unit and integration tests.

### Authentication & Authorization
- The web app uses NextAuth (credentials + Google) with the Prisma adapter. Ensure `NEXTAUTH_SECRET` is identical in root `.env`, `apps/web/.env.local`, and `apps/api/.env`.
- Credentials sign-in validates hashed passwords stored in the `User.passwordHash` column; see `packages/database/src/seed.ts` for generated defaults.
- API services verify NextAuth JWTs via the `/auth/me` endpoint. Send `Authorization: Bearer <token>` or pass session cookies to access protected routes.
- Demo mode is active by default (`NEXTAUTH_USE_PRISMA=false`); set it to `true`, run migrations, and reseed once PostgreSQL is available.

### Continuous Integration
GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push and pull requests targeting `main` and `develop`, performing:
- Dependency install
- Lint (Next.js + Fastify ESLint rules)
- Build for API and Web workspaces

### Documentation
- Solution architecture: `docs/architecture.md`
- Delivery roadmap: `docs/roadmap.md`

### Environment & Configuration
- Global environment variables live in `.env`, with service-specific overrides in `apps/web/.env.local` and `apps/api/.env`.
- The API workspace loads configuration via `apps/api/src/config/env.ts`, validating required keys (`DATABASE_URL`, `JWT_SECRET`, etc.) using Zod before boot.
- Prisma schema and shared client live in `packages/database`; commands (`db:push`, `migrate`, `seed`) should be executed via workspace scripts to ensure consistency.

### Contributing
1. Create a feature branch.
2. Ensure `npm run build --workspaces` succeeds.
3. Open a pull request targeting the `develop` branch with relevant context and testing notes.

### Next Steps
- Flesh out Prisma schema for additional modules (freelancer hub, attendance, exam integrity).
- Implement feature-specific services and UI flows per roadmap phases.
- Integrate CI linting for the API workspace and add automated tests.

