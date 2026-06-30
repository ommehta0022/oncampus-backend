# OnCampus Production Backend

## Railway Deployment

### Build Command:
```
npm install && npm run prisma:generate && npm run build
```

### Start Command:
```
npm run start:prod
```

### Environment Variables (Set in Railway Dashboard):
```
NODE_ENV=production
PORT=4000
DATABASE_URL=<from-supabase>
REDIS_URL=<from-upstash>
SUPABASE_URL=<from-supabase>
SUPABASE_ANON_KEY=<from-supabase>
SUPABASE_SERVICE_KEY=<from-supabase>
JWT_SECRET=<generate-with-openssl>
JWT_REFRESH_SECRET=<generate-with-openssl>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FIREBASE_PROJECT_ID=<from-firebase>
FIREBASE_PRIVATE_KEY=<from-firebase>
FIREBASE_CLIENT_EMAIL=<from-firebase>
CORS_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com
```

### Health Check:
- Path: `/v1/health` (to be added)
- Port: 4000

### Notes:
- Railway will auto-assign a public URL
- WebSocket will be available at: wss://your-app.railway.app/realtime
- Database migrations run automatically on deploy
