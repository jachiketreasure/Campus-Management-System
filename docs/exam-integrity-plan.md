## Exam Integrity Alpha — Implementation Plan

### Objectives
- Deliver the first end-to-end proctoring experience covering consent capture, live monitoring, basic AI flagging, and evidence review.
- Ensure flows operate in demo mode (mock data + simulated AI output) while readying the architecture for real integrations.

### 1. Consent Workflow
**Goals**
- Capture explicit student consent before activating any recording or monitoring.
- Store consent status per exam session with audit trail.

**Tasks**
- Backend: add `/exams/{id}/consent` endpoint to record consent/decline.
- Frontend: build modal flow on `student` exam start page with summary of monitoring scope, retention policy, and accept/decline buttons.
- Update Prisma schema (if required) to store consent metadata (IP, timestamp) — already partially present with `ExamConsent` model.
- Expose consent status in lecturer console; block monitoring controls if consent missing.
- Demo mode: auto approve with ability to toggle for testing.

### 2. Exam Session Orchestration & Monitoring
**Goals**
- Manage session lifecycle (create, start, pause, end) with status transitions.
- Provide lecturer console to view session status, participants, and flagged events timeline.
- Display student exam interface with live monitoring indicator and countdown.

**Tasks**
- API:
  - `/exams` POST: create session with schedule, monitoring toggles, thresholds.
  - `/exams/{id}/start|pause|end`: control endpoints with role checks (lecturer/admin).
  - `/exams/{id}/participants`: list active students with consent status and flag counts.
  - WebSocket or polling endpoint for lecturer to receive live updates (initial alpha can poll every few seconds).
- Frontend:
  - Lecturer: exam list, configurator, real-time monitoring dashboard (grid layout placeholder for video streams).
  - Student: exam join page with monitoring status, warnings area, ability to request help.
  - Build stub components for video feeds (use placeholder images in demo).

### 3. AI Flagging (Initial heuristics)
**Goals**
- Integrate basic detection logic (face count, gaze deviation, mobile device detection) generating flags.
- Store events with severity, confidence, evidence references.

**Demo Mode Strategy**
- Background worker/service triggers synthetic flag events at intervals.
- Provide manual endpoint `/exams/{id}/events` to simulate flag creation.

**Tasks**
- Backend:
  - Define service handling `upload-frame` or event ingestion (use stub data for now).
  - Implement flag evaluation rules (thresholds stored per exam via API).
  - Persist events in `MalpracticeEvent` with severity, confidence.
- Frontend:
  - Lecturer monitoring console: display event feed with filtering, ability to mark reviewed or request evidence.
  - Student exam interface: show discrete warning (for medium/high severity) with guidance.
  - Admin console: global view for all exam events (tie into existing `/dashboard/admin`).

### 4. Evidence Capture & Review
**Goals**
- Capture or simulate evidence artifacts (images, short video segments, log extracts).
- Provide review experience for admin/lecturer with ability to change event status.

**Tasks**
- Backend:
  - Support storing evidence metadata (links to S3 or placeholder in demo).
  - API to fetch evidence assets per event, mark reviewed/resolved/dismissed.
  - Audit log entry whenever evidence viewed/resolved.
- Frontend:
  - Lecturer/Admin review panel with timeline and evidence viewer (image/video placeholders in demo).
  - Add action buttons for `Resolve`, `Dismiss`, `Escalate`.

### 5. Notifications & Alerts
**Goals**
- Alert stakeholders in real-time when high severity events occur.
- In demo mode, simulate in-app notifications and optional toast messages.

**Tasks**
- Backend: extend notifications service to create entries for flagged events.
- Frontend: show toast and dashboard alerts for lecturer/admin; display flag summary to student.
- Future: integrate push/email once infrastructure ready.

### 6. Privacy & Retention
**Goals**
- Ensure consent + retention policies are visible, documented, and enforced.

**Tasks**
- Update consent modal with retention info.
- Backend job (future) to purge evidence after retention window.
- Provide admin settings UI to configure thresholds + retention (tie into plan for Phase 6).

### 7. Deliverables & Milestones
1. **Sprint A**: Consent flow + exam creation + student exam UI (without AI).
2. **Sprint B**: Monitoring console + demo AI flag generator + notifications.
3. **Sprint C**: Evidence viewer + admin review workflow.
4. **Sprint D**: Polish + documentation + integration tests / E2E.

### 8. Dependencies & Risks
- WebRTC/Video handling requires infrastructure research; initial stubs should be explicit about placeholders.
- AI inference service design (microservice vs. external API) should be scoped early for future phases; for alpha, produce deterministic synthetic flags.
- Storage costs/security for evidence once real system is in place.

### 9. Testing Strategy
- Unit tests for consent endpoints, event creation, and status transitions.
- Integration tests covering exam lifecycle and flag ingestion.
- E2E tests (Playwright) simulating student consent, exam start, flag review actions.

### 10. Demo Mode Considerations
- Provide seeded exam sessions, consent entries, and fake flags.
- Include environment toggles to turn off video/mock detection (e.g., `EXAM_DEMO_MODE=true`).
- Document manual triggers for synthetic flag events to support demos.

