## API Contract — CMS Frontend ↔ Backend

All endpoints prefixed with `/api` are served by the Fastify backend (`apps/api`). Unless stated, requests require an authenticated NextAuth session token (JWT) via `Authorization: Bearer <token>` or session cookies. Responses follow JSON:API-style envelopes:

```json
{
  "data": { ... },
  "meta": { ... },
  "errors": [ { "code": "string", "message": "string", "field": "string?" } ]
}
```

Errors use HTTP status codes + `errors` array. Timestamps are ISO 8601 strings in UTC.

---

### 1. Authentication & Session

#### 1.1 `GET /auth/me`
- **Auth**: Required.
- **Response** `200`:
  ```json
  {
    "data": {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "roles": ["ADMIN", "LECTURER", "STUDENT"]
    }
  }
  ```

#### 1.2 `POST /auth/token/refresh` *(future)*
- Exchanges refresh token for new access token once rotating sessions are added.

---

### 2. Users & Roles

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/users` | `GET` | List users (paginated, filter by role/status). | ADMIN |
| `/users/{id}` | `GET` | Fetch user profile (includes roles, wallet summary). | ADMIN / Self |
| `/users/{id}/roles` | `PUT` | Assign roles. | ADMIN |
| `/users/{id}` | `PATCH` | Update profile fields (bio, phone, skills). | Self / ADMIN |

Pagination via `?page[number]=1&page[size]=20`. Sorting `?sort=-createdAt`.

---

### 3. Freelancer Hub

#### 3.1 Gigs
- `GET /gigs` (query params: `search`, `category`, `minPrice`, `maxPrice`, `deliveryTime`, `status`, `ownerId`)
- `POST /gigs`
  ```json
  {
    "title": "string",
    "description": "string",
    "category": "string",
    "price": 50000,
    "currency": "NGN",
    "deliveryTimeDays": 7,
    "tags": ["design"],
    "attachments": ["https://..."]
  }
  ```
- `GET /gigs/{gigId}`
- `PATCH /gigs/{gigId}`
- `DELETE /gigs/{gigId}` (soft delete via `status=ARCHIVED`)

#### 3.2 Proposals & Orders
- `POST /gigs/{gigId}/proposals`
  ```json
  {
    "message": "string",
    "amount": 52000,
    "deliveryTimeDays": 5
  }
  ```
- `POST /proposals/{proposalId}/accept`
- `POST /orders` (direct order without proposal).
- `GET /orders/{orderId}`: includes timeline, escrow status, dispute info.
- `POST /orders/{orderId}/deliverables`: upload final work (S3 signed URL flow).
- `POST /orders/{orderId}/complete`
- `POST /orders/{orderId}/dispute`

#### 3.3 Wallet & Transactions
- `GET /wallet` — fetch current user wallet balance + recent transactions.
- `POST /wallet/topup` — simulate campus payment (admin togglable).
- `POST /wallet/payout` — request withdrawal (admin approval).
- `GET /transactions` — query by `type`, `status`, `date`.

---

### 4. Attendance Management

#### 4.1 Sessions
- `POST /attendance/sessions`
  ```json
  {
    "courseId": "string",
    "title": "string",
    "mode": "QR|BIOMETRIC|DIGITAL",
    "scheduledAt": "2025-11-10T09:00:00Z",
    "metadata": {
      "location": "Main Hall",
      "geofence": { "lat": 6.5244, "lng": 3.3792, "radiusMeters": 100 }
    }
  }
  ```
- `GET /attendance/sessions` (filter by `courseId`, `status`, `mode`, date range).
- `GET /attendance/sessions/{sessionId}`
- `PATCH /attendance/sessions/{sessionId}` (close session, toggle mode).
- `POST /attendance/sessions/{sessionId}/open` / `/close`.

#### 4.2 Check-ins
- `POST /attendance/qr-checkin`
  ```json
  {
    "sessionId": "string",
    "token": "rotating-qr-token",
    "location": { "lat": 6.52, "lng": 3.37 },
    "device": { "id": "string", "platform": "ios" }
  }
  ```
  - **Response** `200` if validated, `400` invalid token, `409` duplicate.
- `POST /attendance/biometric-checkin`
  - Accepts payload from biometric device (stub: `userId`, `sessionId`, `deviceId`, `signature`).
- `POST /attendance/digital-presence`
  - WebRTC heartbeat (student + session).
- `GET /attendance/records` (filters: `courseId`, `studentId`, `status`, date range).
- `POST /attendance/records/{recordId}/appeal`.

#### 4.3 Reporting
- `GET /attendance/reports/course/{courseId}?format=csv|pdf`
- `GET /attendance/reports/student/{studentId}`
- Initiates background job; response includes `reportId`.
- `GET /reports/{reportId}` to poll status. When complete, provides signed download URL.

---

### 5. Exam Integrity

#### 5.1 Exam Sessions
- `POST /exams`
  ```json
  {
    "courseId": "string",
    "title": "Mid-Semester Assessment",
    "scheduledStart": "2025-11-15T09:00:00Z",
    "scheduledEnd": "2025-11-15T11:00:00Z",
    "monitoring": {
      "webcam": true,
      "screenShare": false,
      "audio": true,
      "models": {
        "faceDetection": true,
        "gazeEstimation": true,
        "mobileDetection": true,
        "soundSpike": true
      }
    },
    "thresholds": {
      "maxFaces": 1,
      "gazeDeviation": 35,
      "soundDb": 75
    },
    "consentRequired": true,
    "retentionDays": 30
  }
  ```
- `GET /exams` — filters by `status`, `courseId`, `lecturerId`.
- `GET /exams/{examId}`
- `PATCH /exams/{examId}` — adjust thresholds, end session, etc.
- `POST /exams/{examId}/start` / `/pause` / `/end`.

#### 5.2 Media Uploads & Processing
- `POST /exams/{examId}/frames` — chunked upload (S3 pre-signed URL flow).
- `POST /exams/{examId}/events` — manual flag creation (for manual proctor input).
- Worker emits AI detections to `MalpracticeEvent` table; API exposes via `GET /exams/{examId}/events`.

#### 5.3 Malpractice Events
- `GET /malpractice/events?status=PENDING&severity=HIGH`
- `GET /malpractice/events/{eventId}`
- `POST /malpractice/events/{eventId}/actions`
  ```json
  {
    "action": "RESOLVE|DISMISS|REQUEST_INFO",
    "notes": "string",
    "attachments": ["https://..."]
  }
  ```
- `POST /malpractice/events/{eventId}/appeals` (student initiated).

#### 5.4 Evidence Assets
- `GET /malpractice/events/{eventId}/evidence`
- `POST /malpractice/events/{eventId}/evidence`
  - Accepts metadata; actual files uploaded via signed URLs.
- `DELETE /evidence/{assetId}`
- Access logged to `AuditLog`.

---

### 6. Notifications & Messaging

- `GET /notifications` — filter by `category`, `read`, `since`.
- `POST /notifications/read` — mark as read (`ids: string[]`).
- `POST /notifications/read-all`.
- Real-time updates via WebSocket channel (`/realtime/notifications`).

---

### 7. Administrative & System

- `GET /admin/dashboard` — summary metrics (users, gigs, disputes, attendance compliance).
- `GET /admin/settings` — returns configurable thresholds, retention policies.
- `PATCH /admin/settings` — update AI thresholds, data retention, notifications.
- `GET /admin/audit-logs?entity=MalpracticeEvent&actorId=...`

---

### 8. Authentication Between Frontend and Backend

1. Next.js uses NextAuth JWT session tokens (signed with `NEXTAUTH_SECRET`).
2. When frontend needs backend data:
   - During SSR (RSC) use `getServerSession` → fetch with `Authorization: Bearer ${sessionToken}`.
   - During CSR use `fetch`/`axios` with `credentials: "include"` to forward cookies.
3. Fastify middleware verifies JWT (via `authPlugin`) and populates `request.authUser`.
4. Rate limiting (future) via Redis + IP-based quotas; endpoints return `429` with `Retry-After`.

---

### 9. Background Jobs / Webhooks

| Purpose | Trigger | Endpoint |
|---------|---------|----------|
| Report generation | API request | Webhook to front-end via notifications when ready |
| AI inference results | Worker job | emits to `/exams/{id}/events` endpoint via internal queue |
| Payment simulation | Webhook stub | `/integrations/payments/callback` (future) |

---

### 10. Versioning & Change Control

- Base path `/api/v1` reserved for stability; use Accept header `application/vnd.cms+json;version=1`.
- Breaking changes will introduce `/api/v2`.
- Contracts documented here should be synchronized with OpenAPI spec (planned `docs/openapi.yaml`).

