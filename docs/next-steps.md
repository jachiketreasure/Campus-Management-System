## Next Up — Freelancer Hub Enhancements

With authentication, attendance, and exam-consent foundations in place, the roadmap calls for expanding the Freelancer Hub into a student-friendly marketplace. Here are the recommended focus areas and tasks for the next implementation phase.

### 1. Gig Creation & Management (Student Role)
- **UI**: Add “Post a Gig” workflow (modal or dedicated page) from the student dashboard, allowing rich descriptions, attachments, and preview.
- **API**: Extend gig service routes to support student-created gigs (reuse existing `/gigs` POST/PATCH`).
- **Validation**: Enforce categories, delivery windows, and status transitions (draft → active → archived).
- **Demo Mode**: Seed additional sample gigs and allow creation in in-memory store.

### 2. Proposal Review & Messaging (Lecturer Role)
- **Lecturer UI**: Enhance proposal list with filtering, quick accept/reject actions, and message stub for follow-up questions.
- **Student UI**: Surface proposal statuses per gig, including system notifications when accepted/rejected.
- **API**: Extend proposals service with status updates (accept/reject/withdraw), and ensure notifications are triggered.

### 3. Wallet & Escrow Experience
- **Student Dashboard**: Add wallet balance card; show transactions from `/wallet`.
- **Lecturer/Admin**: Provide view of pending escrow holds, “Release payment” button (admin only), and dispute escalations.
- **API**: Wire wallet service to update balances when orders complete, ensure demo data reflects status changes.

### 4. Notifications & Activity Feed
- **Backend**: Hook gigs/proposals/wallet events into notifications service.
- **Frontend**: Add notification center panel in dashboards; show badge counts.
- **Testing**: Extend API tests verifying notification creation and retrieval.

### 5. Reporting (Preparation for Phase 2 Checkpoints)
- **API**: Plan endpoints for exporting transaction reports (CSV) and gig summaries.
- **UI**: Provide placeholder “Download report” buttons and background job spinner (data to be wired next sprint).

## Future Phases Preview
- **Exam Integrity Sprint**: Implement live monitoring console, AI flag stubs, evidence viewer (per `docs/exam-integrity-plan.md`).
- **Attendance Enhancements**: Build QR check-in UI (student mobile), session creation modal, biometric integration stubs.
- **Reporting & Analytics**: Central dashboard for admin, attendance charts, exam flag metrics.

To continue, pick one focus area (e.g., gig creation flow) and create new tasks. Once that’s chosen, we’ll scaffold UI pages, API endpoints, and tests accordingly.

