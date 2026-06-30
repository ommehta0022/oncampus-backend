# OnCampus Backend API - Deployment Instructions

## ✅ Backend API Complete

The complete production-ready Backend API has been built with:

- ✅ Authentication (Phone OTP via Firebase)
- ✅ User Management & Profiles
- ✅ Group Management (CRUD, Membership, Roles)
- ✅ Join Requests & Approvals
- ✅ Real-time Messaging (HTTP + WebSocket)
- ✅ Group Discovery & Search
- ✅ Push Notifications (Firebase FCM)
- ✅ File Storage (Supabase Storage with signed URLs)
- ✅ Rate Limiting & Security
- ✅ Redis Caching & Presence
- ✅ Prisma ORM with PostgreSQL

---

## 📁 Project Structure

```
oncampus-production-backend/
├── src/
│   ├── auth/               # Phone OTP, JWT, Refresh Tokens
│   ├── users/              # Profile, Devices, Push Tokens
│   ├── groups/             # Groups, Membership, Join Requests
│   ├── messages/           # Message CRUD, History
│   ├── discovery/          # Group Search, Institutions
│   ├── websocket/          # Real-time Gateway
│   ├── notifications/      # Push Notifications
│   ├── storage/            # File Upload/Download
│   └── common/
│       ├── prisma/         # Database Service
│       ├── redis/          # Cache & Presence
│       ├── firebase/       # Auth & Push
│       └── supabase/       # Storage & Realtime
├── prisma/
│   └── schema.prisma       # Complete DB Schema
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🔧 Next Steps

### 1. Install Dependencies

```bash
cd oncampus-production-backend
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.production` and fill in your credentials from Phase 1:

```bash
cp .env.example .env.production
```

Required variables:
- Supabase (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY)
- Upstash Redis (REDIS_URL)
- Firebase (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)
- JWT Secrets (generate with: `openssl rand -base64 64`)

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Run Database Migrations

```bash
npm run prisma:migrate
```

### 5. Run Locally

```bash
npm run start:dev
```

API will be available at: `http://localhost:4000/v1`
WebSocket at: `ws://localhost:4000/realtime`

### 6. Deploy to Railway

See deployment section below.

---

## 📚 API Endpoints

### Authentication
- `POST /v1/auth/otp/start` - Start phone OTP
- `POST /v1/auth/otp/verify` - Verify OTP with Firebase token
- `POST /v1/auth/refresh` - Refresh access token
- `POST /v1/auth/logout` - Logout
- `GET /v1/auth/me` - Get current user

### Users
- `GET /v1/users/me` - Get profile
- `PATCH /v1/users/me` - Update profile
- `POST /v1/users/me/avatar` - Upload avatar
- `POST /v1/users/me/push-token` - Register push token
- `GET /v1/users/me/devices` - List devices
- `POST /v1/users/me/devices/:deviceId/revoke` - Revoke device

### Groups
- `POST /v1/groups` - Create group
- `GET /v1/groups` - List user's groups
- `GET /v1/groups/:id` - Get group details
- `PATCH /v1/groups/:id` - Update group
- `DELETE /v1/groups/:id` - Delete group
- `POST /v1/groups/:id/join-requests` - Request to join
- `GET /v1/groups/:id/join-requests` - List pending requests (admins)
- `POST /v1/groups/:id/join-requests/:requestId/approve` - Approve
- `POST /v1/groups/:id/join-requests/:requestId/reject` - Reject
- `DELETE /v1/groups/:id/membership` - Leave group
- `GET /v1/groups/:id/members` - List members
- `PATCH /v1/groups/:id/members/:memberId/role` - Update role
- `DELETE /v1/groups/:id/members/:memberId` - Remove member

### Messages
- `POST /v1/groups/:id/messages` - Send message
- `GET /v1/groups/:id/messages?after=&limit=` - Get messages
- `PATCH /v1/groups/:id/messages/:messageId` - Edit message
- `DELETE /v1/groups/:id/messages/:messageId` - Delete message

### Discovery
- `GET /v1/discovery/groups?city=&category=&q=` - Search groups
- `GET /v1/discovery/institutions?city=` - List institutions
- `GET /v1/discovery/users?q=` - Search users

### Storage
- `POST /v1/storage/signed-upload-url` - Get upload URL
- `GET /v1/storage/signed-download-url?bucket=&filePath=` - Get download URL

### WebSocket Events (ws://host/realtime)
- `group.join` - Join group room
- `group.leave` - Leave group room
- `message.send` - Send message
- `typing.start` - Start typing indicator
- `typing.stop` - Stop typing indicator

---

## 🔒 Security Features

- Phone OTP authentication via Firebase
- JWT access tokens (15min expiry)
- Refresh token rotation with reuse detection
- Device-bound sessions
- Rate limiting (Redis-based)
- Idempotency keys for messages
- Group membership authorization
- Role-based permissions (owner/admin/mod/member)
- Signed upload URLs (Supabase)
- Input validation (class-validator)
- CORS & Helmet security headers

---

## 📊 Database Schema

Complete Prisma schema with:
- Users & Authentication
- Institutions & Verification
- Groups & Membership
- Join Requests
- Messages
- Devices & Push Tokens
- Refresh Tokens
- Reports & Moderation
- Audit Logs
- Analytics Events

---

## 🚀 Ready for Deployment

The backend is production-ready with:
- All Phase 1 features implemented
- Security best practices
- Rate limiting
- Error handling
- Logging
- Scalable architecture

Next: Deploy to Railway and wire up Flutter app!
