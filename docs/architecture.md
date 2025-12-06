## Campus Management System (CMS) — Solution Architecture

### 1. Vision & Scope
- Deliver a unified campus platform with three flagship modules: `Freelancer Hub`, `Exam Integrity Suite`, and `Attendance Intelligence`.
- Provide role-targeted experiences for `Admin`, `Lecturer`, and `Student`, backed by secure multi-tenant services.
- Architect for modular scaling: isolate AI workloads, transactional marketplace flows, and real-time monitoring to allow independent growth and deployment.

### 2. High-Level Architecture Overview
- **Client Layer**: Next.js 14 App Router (TypeScript, Tailwind CSS), SSR/ISR mix, PWA enhancements for mobile usage, role-aware layouts.
- **BFF / API Layer**: Next.js API routes for user-facing services; companion Node.js microservices (Fastify/Nest) for compute-heavy and long-running tasks (AI inference, media processing, job orchestration).
- **Data & State Layer**:
  - PostgreSQL via Prisma ORM for relational data (users, courses, gigs, transactions, attendance).
  - Redis for caching, rate limiting, WebSocket presence, and BullMQ queues.
  - Object storage (AWS S3-compatible) for media, evidence snapshots, and generated reports.
- **AI Inference Layer**: Dedicated microservice exposing REST/gRPC endpoints for computer-vision models (face detection, gaze estimation, device detection); optional integration with third-party AI APIs when on-premise resources are unavailable.
- **Observability & Security**: Sentry for error tracking, OpenTelemetry for tracing, Prometheus/Grafana for metrics, structured JSON logging, Vault/Parameter Store for secrets.

### 3. Module Breakdown
#### 3.1 Authentication & Authorization
- NextAuth.js with credentials strategy + Google OAuth.
- JWT + session strategy with rotation, refresh tokens stored encrypted (Prisma adapter).
- RBAC middleware using `next-auth` callbacks and middleware at route level.

#### 3.2 Freelancer Hub
- Entities: `UserProfile`, `Gig`, `Proposal`, `Order`, `EscrowTransaction`, `Review`, `Dispute`.
- Flows:
  - Gig CRUD (students/staff), rich text editor with attachments.
  - Proposal submission; lecturer/student messaging via WebSocket channels.
  - Escrow wallet (simulated) with funding, hold, release; integration-ready for Stripe/Paystack.
  - Review lifecycle: rating submission gated by order completion; dispute escalation triggers admin workflows.
- Search & discovery: Postgres full-text search + Meilisearch/Algolia adapter for advanced filtering.

#### 3.3 Exam Malpractice Detection & Alarm
- Exam session orchestration: create, start, pause, end; capture consent logs.
- Live monitoring: WebRTC stream to proctor console, lightweight client-side inference (face count) for low-latency alerts.
- Offline analysis: chunked video upload to S3, worker queue triggers AI microservice, results stored as `MalpracticeEvent`.
- Alarm policy engine: configurable per course/exam thresholds, multi-channel notifications (in-app, email, SMS/push optional).
- Evidence management: short clip extraction via FFmpeg worker; access governed by RBAC + audit logging.
- Privacy compliance: retention schedules, consent records, secure access logs.

#### 3.4 Attendance Management
- Modes supported:
  - `Biometric`: REST endpoint placeholder expecting device payload; mock simulator for development.
  - `QR`: Dynamic QR with rotating tokens; student mobile app/portal scan; server validation + geofence option.
  - `Digital Presence`: WebRTC heartbeat / activity check for remote sessions (timer-based).
- Lecturer panel: session creation, start/stop attendance, auto-roll-call for enrolled students.
- Reporting: per course, per student, export to CSV/PDF via background job.

### 4. Data Model Highlights
- Prisma schema organized by modules; key tables:
  - `User`, `Profile`, `Role`, `UserRole`, `Course`, `Enrollment`, `Gig`, `Proposal`, `Order`, `Review`.
  - `Transaction`, `Wallet`, `Payout`, `DisputeThread`.
  - `ExamSession`, `ExamConsent`, `MalpracticeEvent`, `EvidenceAsset`.
  - `AttendanceRecord`, `AttendanceSession`, `AttendanceMode`.
  - Audit tables: `AccessLog`, `Notification`.
- Use soft deletes and status enums; enforce foreign keys, cascading rules, and row-level security (Postgres RLS) for sensitive tables.

### 5. Service Topology & Deployment
- **Frontend**: Deployed on Vercel/Netlify; consuming internal APIs via HTTPS.
- **API Gateway/BFF**: Next.js server deployed in container (Render/Heroku/AWS ECS) with autoscaling.
- **AI Service**: Containerized FastAPI/Triton service, GPU-ready but CPU fallback with smaller models.
- **Worker Tier**: Node.js workers (BullMQ) for video processing, report generation, notification dispatch.
- **Database**: Managed PostgreSQL (Supabase/RDS/GCP SQL) with read replicas; Redis via Upstash/Elasticache.
- **Storage**: S3 bucket with lifecycle policies; signed URLs for upload/download.
- **CI/CD**: GitHub Actions orchestrating lint/test/build, Docker image pushes, deployment triggers.

### 6. Security & Compliance
- HTTPS everywhere, HSTS, secure cookies, CSRF for forms.
- Input validation via Zod on API boundaries; rate limiting with Redis.
- Encrypt PII and sensitive columns using Prisma field-level encryption or PG crypto.
- Audit logging for admin actions, malpractice evidence access, dispute resolutions.
- Data retention policy (e.g., exam footage auto purge after 30 days).
- Compliance documentation for consent, privacy, and incident response.

### 7. Notifications & Communications
- In-app notification center backed by Postgres + WebSocket push.
- Email via Resend/SendGrid; templated using React Email.
- Optional push via OneSignal/Firebase for critical alerts.
- Escalation rules for malpractice severity; Slack/Microsoft Teams webhook integration for admin alerts.

### 8. Testing & Quality Assurance
- Unit tests: Jest + React Testing Library for UI; Jest/Supertest for API.
- Integration tests: Prisma test DB with migrations.
- E2E: Playwright covering auth, gig lifecycle, attendance check-in, exam flag review.
- Load testing scenarios for exam streaming and concurrent gig usage (k6/Artillery).
- Security scans: ESLint, dependency scanning (npm audit), OWASP ZAP pipeline stage.

### 9. Roadmap Milestones (High-Level)
1. **Foundation Sprint**: Auth, RBAC, base layout, Prisma schema bootstrap.
2. **Freelancer Hub MVP**: Gig CRUD, proposals, escrow simulation, reviews.
3. **Attendance MVP**: QR & digital modes, lecturer dashboards, reports export.
4. **Exam Integrity Alpha**: Consent, session management, basic detection (face count) with manual review.
5. **AI Enhancement Sprint**: Integrate advanced models, automate alarm thresholds, evidence clips.
6. **Polish & Compliance**: Audit logs, privacy tooling, documentation, CI/CD hardening.

### 10. Open Questions & Assumptions
- Biometric hardware API specifics pending; will maintain abstraction layer.
- Campus payment gateway TBD; escrow simulation uses internal wallet until finalized.
- AI model hosting preferences (managed cloud vs. on-prem) to be confirmed with stakeholders.
- Need clarity on institutional privacy policies to tailor data retention defaults.


