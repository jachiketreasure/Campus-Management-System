## UI Wireframes — Campus Management System

### 1. Freelancer Hub (Marketplace)

#### 1.1 Marketplace Landing (`/marketplace`)
- **Hero strip**: summary card with CTA buttons `Post a Gig` and `Browse Categories`.
- **Filters panel** (left column):
  - Search field with debounce.
  - Toggles: `Category`, `Delivery Time`, `Price Range`, `Rating`, `Status`.
  - “Saved filters” chips for quick reuse.
- **Gig cards grid** (3-column layout on desktop, single column on mobile):
  - Card header: owner avatar + name + role badge.
  - Body: gig title, short description (2-line clamp), tags.
  - Footer: price, delivery time, rating stars + count, CTA `View Details`.
- **Right rail** (desktop): “Trending categories” list + quick link to help center.

#### 1.2 Gig Detail (`/marketplace/{gigId}`)
- **Top section**: title, breadcrumbs, rating summary, share button.
- **Primary action bar** (sticky on scroll):
  - `Hire Now` button, `Save`, `Report`.
- **Content layout** (two-column):
  - Left column: gig overview (rich text), attachments gallery, seller profile snapshot, reviews list (with filter + pagination).
  - Right column: pricing summary card (tiers optional), delivery timeline, seller availability.
- **Proposal modal**:
  - Fields: message, custom offer amount, expected delivery, attachments (drag & drop).
  - Inline validation and preview before submit.

#### 1.3 Freelancer Dashboard (`/dashboard/student`)
- **Quick stats** row: Active gigs, Inquiries, Escrow balance, Reviews.
- **Tabs**: `In Progress`, `Awaiting Action`, `Completed`, `Disputes`.
- **Gig list**: timeline view with status pills, CTA buttons (`Submit Deliverable`, `Chat`, `Mark Complete`).
- **Wallet widget**: current balance, recent transactions, `Withdraw` CTA.
- **Notifications panel**: real-time updates (malpractice alerts, new proposals).

#### 1.4 Admin Dispute Center (`/dashboard/admin/disputes`)
- **Filter header**: status dropdown, severity slider, date range, assigned admin.
- **Dispute list**: table with columns (Order ID, Gig, Parties, Status, Created, SLA Timer).
- **Detail drawer** (slides in from right):
  - Chat transcript, evidence links, escrow state.
  - Resolution actions: `Request Info`, `Release Escrow`, `Escalate`.
- **Metrics footer**: average resolution time, open vs resolved count.

### 2. Attendance Management

#### 2.1 Lecturer Attendance Console (`/dashboard/lecturer/attendance`)
- **Header**: course selector, calendar view toggle (`Week`, `Month`), `Create Session` button.
- **Session cards**: status badge (Scheduled/Open/Closed), mode icon (QR/Biometric/Digital), participant count, `Manage` CTA.
- **Create Session modal**:
  - Fields: course, session title, mode picker, scheduled time, location (with optional geofence), auto-close timer.
  - QR mode: preview dynamic QR with refresh timer indicator.
  - Biometric mode: device selection dropdown with integration status.
- **Real-time attendance panel**:
  - Live list of check-ins with timestamp, mode icon, verification status.
  - Quick actions: `Mark Present`, `Undo`, `Flag`.
- **Analytics tab**:
  - Chart: attendance trend over time.
  - Table: per-student attendance percentage, export buttons (CSV/PDF).

#### 2.2 Student Attendance View (`/dashboard/student/attendance`)
- **Summary**: current semester attendance %, next upcoming session card.
- **Session history**: timeline with status (present/absent/late/excused), mode badges, lecturer notes.
- **Action button**: `Generate QR` to present device QR for check-in (when allowed).
- **Appeal modal**: form to dispute an absence with reason and attachments.

### 3. Exam Integrity Suite

#### 3.1 Exam Setup (`/dashboard/lecturer/exams`)
- **Grid of sessions**: card showing course, status (Scheduled/Live/Completed), flags count, participants.
- **Create Exam wizard**:
  - Step 1: Basic info (title, schedule, duration, consent toggle).
  - Step 2: Monitoring options (webcam, screen share, audio, AI models toggles).
  - Step 3: Threshold settings (face count, gaze deviation, device detection, sound triggers).
  - Step 4: Notifications configuration (alert recipients, severity mapping).
- **Consent summary**: list of registered students with consent status and timestamp.

#### 3.2 Proctor Live Console (`/dashboard/lecturer/exams/{examId}/monitor`)
- **Layout**:
  - Main video wall (responsive grid) showing live streams or snapshots.
  - Sidebar: flagged events queue with severity color coding.
  - Header controls: `Pause Monitoring`, `Send Broadcast Message`, `End Session`.
- **Flagged event detail panel**:
  - Snapshot/video clip, AI confidence score, involved student(s), options `Issue Warning`, `Mark as Reviewed`, `Escalate`.
- **Chat pane**: communication between proctors, auto-logged actions.

#### 3.3 Student Exam Interface (`/exams/{examId}`)
- **Consent modal**: clearly states recording/monitoring scope with `Agree`/`Decline`.
- **Proctoring status bar**: connection state, instructions, countdown timer, alerts.
- **Warning notifications**: top-right toasts when flagged (with guidance).
- **Appeal button**: accessible after exam to open incident report.

#### 3.4 Admin Review Center (`/dashboard/admin/malpractice`)
- **Filter bar**: course, severity, status, AI model, date range.
- **Incident list**: table with sortable columns (Student, Event Type, Confidence, Status, Last Updated).
- **Case workspace**:
  - Evidence carousel (video, images, audio waveforms, logs).
  - Timeline of events with annotations.
  - Decision panel: `Dismiss`, `Confirm`, `Request Additional Evidence`, set retention override.
- **Audit log tab**: who accessed evidence, timestamps, actions taken.

### 4. Shared Design Notes
- Tailwind-based utility styling with responsive breakpoints: `sm`, `md`, `lg`, `xl`.
- Accessible color palette centered on slate neutrals with accent colors:
  - Primary: slate-900, accent badges in emerald (success), amber (warning), rose (critical).
- Surfaces:
  - `bg-white` for panels, `bg-slate-50` for section wrappers, shadows for depth.
- Typography: Geist Sans for headings, Geist Mono for code/admin metrics.
- Components:
  - Buttons: primary (filled), secondary (outlined), tertiary (ghost).
  - Badges: severity (low/medium/high/critical) color coded.
  - Cards: consistent padding (`p-5`), rounded corners (`rounded-xl`).
- Responsive behavior:
  - Side navigation collapses into top nav on mobile with slide-over menu.
  - Data tables switch to stacked cards with key-value pairs on small screens.
- Feedback patterns:
  - Toasts for success/error, modals for destructive confirmations, inline validation messages.
- Iconography: use Lucide icon set for consistency (e.g., `Users`, `Clock`, `Shield`, `AlertTriangle`).
- Design tokens defined in `packages/ui/tokens.ts` (colors, spacing, typography) ensure consistency across apps.

