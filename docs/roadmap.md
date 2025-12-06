## CMS Delivery Roadmap & Implementation Plan

### Phase 0 — Project Foundations (Week 0-1)
- **Deliverables**: Repository structure, coding standards, CI skeleton, environment configuration templates.
- **Tasks**:
  - Finalize infrastructure choices (hosting, storage, AI service platform).
  - Set up GitHub Actions workflow for lint/test/build.
  - Define environment variable strategy and secrets management baseline.
  - Prepare seed data plan and migration workflow.
- **Checkpoints**:
  - Repo bootstrapped with `apps/web`, `apps/api`, shared configs.
  - CI pipeline running sanity checks on pull requests.
  - Documentation for local setup published (`README`, `.env.example`).

### Phase 1 — Core Platform & RBAC (Week 1-3)
- **Deliverables**: Auth flows, base UI shell, role-aware navigation, foundational data models.
- **Tasks**:
  - Integrate NextAuth (credentials + Google SSO) with Prisma user store.
  - Implement RBAC middleware, session policies, and protected layouts.
  - Scaffold Prisma schema (users, roles, courses, wallets).
  - Build shared UI components (navigation, alerts, dashboards skeleton).
- **Checkpoints**:
  - Auth signup/login flows covered by integration tests.
  - Role-specific dashboards accessible with feature flags.
  - Database migrations automated via Prisma migrate.

### Phase 2 — Freelancer Hub MVP (Week 3-6)
- **Deliverables**: Gig marketplace with proposals, messaging stub, escrow wallet simulation.
- **Tasks**:
  - CRUD APIs and UI for gigs with search/filter capability.
  - Proposal submission flow, order lifecycle, review systems.
  - Implement campus wallet + escrow hold/release logic.
  - Notifications for gig events (in-app + email).
- **Checkpoints**:
  - E2E test: student posts gig → lecturer hires → work completes → review.
  - Admin dispute dashboard stub created.
  - Reporting endpoints for transactions prepared (CSV export).

### Phase 3 — Attendance Intelligence (Week 6-9)
- **Deliverables**: QR + digital attendance, lecturer dashboards, report exports.
- **Tasks**:
  - Attendance session management APIs; integrate with course schedules.
  - QR token generator/validator with geolocation guard toggle.
  - Digital presence tracking for remote sessions (heartbeat/websocket).
  - Attendance analytics UI + CSV/PDF generation jobs.
- **Checkpoints**:
  - Automated tests for QR scan flow and digital presence.
  - Attendance overview available in admin and lecturer dashboards.
  - Documentation for biometric API stub published.

### Phase 4 — Exam Integrity Alpha (Week 9-12)
- **Deliverables**: Consent-driven exam sessions, live monitoring console, initial AI flags.
- **Tasks**:
  - Build exam session orchestration (create, start, pause, end) with consent logging.
  - Implement WebRTC streaming (student → proctor) with viewer controls.
  - Integrate basic AI heuristics (face count, gaze variance) via inference service.
  - Alarm workflow with severity levels and notifications to admin/lecturer/student.
- **Checkpoints**:
  - Malpractice event timeline visible in lecturer/admin dashboards.
  - Storage routines for evidence assets + retention jobs.
  - Privacy notices and consent flow validated by stakeholders.

### Phase 5 — AI & Automation Enhancements (Week 12-15)
- **Deliverables**: Advanced detection models, automated evidence clips, escalation rules.
- **Tasks**:
  - Integrate device detection, mobile object detection, and sound anomaly models.
  - FFmpeg workers for evidence clip extraction and snapshot generation.
  - Implement configurable threshold policies per course/exam.
  - Add appeal workflow for students with admin review tools.
- **Checkpoints**:
  - Performance benchmarks for AI pipeline documented.
  - Alert fatigue metrics tracked; ability to tune thresholds confirmed.
  - Access logs for evidence review working.

### Phase 6 — Hardening & Compliance (Week 15-17)
- **Deliverables**: Security hardening, audit logs, retention tooling, documentation.
- **Tasks**:
  - Conduct OWASP review; remediate findings.
  - Implement audit logging for admin actions, malpractice evidence access.
  - Configure data retention automation (30-day purge, overrides).
  - Finalize documentation: deployment playbooks, privacy policy, incident response.
- **Checkpoints**:
  - Security tests integrated into CI.
  - Compliance checklist signed off by stakeholders.
  - Disaster recovery scenario rehearsed (backup/restore test).

### Phase 7 — UAT, Testing, & Launch (Week 17-19)
- **Deliverables**: UAT sign-off, performance testing, production readiness.
- **Tasks**:
  - Populate staging with sample data; run guided UAT sessions (Admin/Lecturer/Student).
  - Execute load testing (exam streaming, gig marketplace concurrency).
  - Finalize monitoring dashboards and alerting rules.
  - Prepare launch checklist and rollback plan.
- **Checkpoints**:
  - UAT feedback triaged and addressed.
  - Production deployment dry run completed.
  - Launch communications drafted (user guides, release notes).

### Phase 8 — Post-Launch Iteration (Week 19+)
- **Deliverables**: Support onboarding, roadmap for enhancements, analytics review.
- **Tasks**:
  - Monitor adoption metrics, collect feedback loops.
  - Plan Phase 2 features (biometric hardware integration, payments gateway, AI tuning).
  - Establish maintenance cadence and SLA agreements.
- **Checkpoints**:
  - Post-launch retrospective with stakeholders.
  - Enhancement backlog prioritized and scheduled.
  - Support documentation and escalation paths in place.

### Cross-Cutting Workstreams
- **DevOps**: Infrastructure-as-Code (Terraform/Pulumi), environment provisioning, secrets rotation.
- **Quality Engineering**: Automated test coverage targets, QA gating, manual regression protocols.
- **Data & Analytics**: Business intelligence dashboards for attendance trends, gig economy metrics, exam integrity insights.
- **Privacy & Compliance**: Consent management, data subject access workflows, retention audits.

### Resource Planning (Indicative)
- **Frontend**: 2 engineers (Next.js, Tailwind, design systems).
- **Backend/API**: 2 engineers (Fastify/Nest, Prisma, queues).
- **AI/ML**: 1 engineer (model integration, inference service).
- **DevOps/SRE**: 1 engineer (CI/CD, infrastructure).
- **QA/Automation**: 1 engineer shared across phases.
- **Product/UX**: 1 designer + PM oversight for user research and requirement validation.


