# Class Scheduling System - Setup Notes

## Required Dependencies

### Install QR Code Library
The class details page uses `qrcode.react` to display QR codes. Install it:

```bash
cd apps/web
npm install qrcode.react
```

## Prisma Client Generation

Before using the system, generate the Prisma client:

```bash
cd packages/database
npm run generate
```

If you get a file lock error, close any processes using Prisma and try again.

## Environment Variables

Ensure these are set:
- `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_BASE_URL` - Fastify API base URL (default: http://localhost:4000)

## Navigation Updates

The following navigation items have been added:
- **Lecturer**: "Classes" link in sidebar
- **Student**: "Attendance" link in sidebar

## Features Implemented

### Lecturer Features:
1. ✅ Schedule physical classes (with venue)
2. ✅ Schedule online classes (with meeting link)
3. ✅ View all scheduled classes
4. ✅ View class details with QR code
5. ✅ Regenerate QR codes
6. ✅ Start/close classes
7. ✅ View attendance statistics
8. ✅ See attendance records (QR scans vs code entries)

### Student Features:
1. ✅ Scan QR code for attendance
2. ✅ Enter attendance code manually
3. ✅ View attendance history
4. ✅ See active classes that need attendance
5. ✅ View upcoming classes

### Security Features:
1. ✅ Secure QR token generation with hash verification
2. ✅ QR code expiration when class ends
3. ✅ Attendance code expiration
4. ✅ Time validation (cannot mark before/after class)
5. ✅ Course registration validation
6. ✅ QR code regeneration invalidates old codes

## API Endpoints

All endpoints are proxied through Next.js API routes at `/api/classes/*`:

### Lecturer Endpoints:
- `GET /api/classes` - List all classes
- `POST /api/classes` - Create class (physical or online)
- `GET /api/classes/:sessionId` - Get class details
- `POST /api/classes/:sessionId/regenerate-qr` - Regenerate QR code
- `GET /api/classes/:sessionId/qr-code` - Get QR code data
- `POST /api/classes/:sessionId/start` - Start class
- `POST /api/classes/:sessionId/close` - Close class

### Student Endpoints:
- `GET /api/classes/student/my-classes` - List student's classes
- `POST /api/classes/student/scan-qr` - Scan QR code
- `POST /api/classes/student/enter-code` - Enter attendance code

## Testing Checklist

- [ ] Install qrcode.react dependency
- [ ] Generate Prisma client
- [ ] Test creating physical class
- [ ] Test creating online class
- [ ] Test QR code display and regeneration
- [ ] Test starting/closing classes
- [ ] Test student QR scanning
- [ ] Test student code entry
- [ ] Verify attendance statistics
- [ ] Test time validation (before/after class)
- [ ] Test course registration validation

