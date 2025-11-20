# Database Migration via API (No Premium Access Required)

Since you don't have premium access on Render, you can run migrations via API endpoint.

## Method 1: Using API Endpoint (Easiest)

### Step 1: Get Admin Token

1. Login to your application
2. Copy the JWT token from browser (check localStorage or network tab)

### Step 2: Run Migration via API

**Using Postman or any HTTP client:**

```bash
POST https://goodaam-backend.onrender.com/api/migrations/apply-all
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json
```

**Using cURL:**

```bash
curl -X POST https://goodaam-backend.onrender.com/api/migrations/apply-all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Using Browser Console (if you're logged in):**

```javascript
fetch('https://goodaam-backend.onrender.com/api/migrations/apply-all', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'), // or wherever token is stored
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(console.log);
```

### Step 3: Check Migration Status

```bash
GET https://goodaam-backend.onrender.com/api/migrations/status
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
```

## Method 2: Direct Database Access

If you have database connection string, use any PostgreSQL client:

### Option A: pgAdmin (Desktop App)
1. Download pgAdmin
2. Connect using your database URL
3. Run SQL from `backend/prisma/migrations/MANUAL_UPDATE_WEIGHT_COLUMNS.sql`

### Option B: Online PostgreSQL Client
1. Go to https://www.pgadmin.org/ or https://dbeaver.io/
2. Connect to your database
3. Run the SQL

### Option C: Node.js Script (Local Machine)
1. Set DATABASE_URL environment variable:
   ```bash
   export DATABASE_URL="your-production-database-url"
   ```
2. Run migration script:
   ```bash
   cd backend
   node scripts/apply-production-migrations.js
   ```

## Method 3: Render Environment Variables + Startup Script

1. **Add environment variable** in Render dashboard:
   - Key: `RUN_MIGRATIONS`
   - Value: `true`

2. **Modify your startup script** to check this variable and run migrations on startup (one-time)

## Method 4: Using Render's Build Command

In Render dashboard, you can add a build command that runs migrations:

```bash
npm install && npm run db:migrate:production && npm start
```

**Note**: This runs migration on every deploy, so only use if needed.

## Recommended: Method 1 (API Endpoint)

This is the easiest and safest:
- ✅ No premium access needed
- ✅ Can run from anywhere
- ✅ Secure (requires admin authentication)
- ✅ Can check status before/after

## Security Note

The migration endpoints are protected by:
- ✅ Authentication required (must be logged in)
- ✅ Admin authorization (only ADMIN users can run)

Make sure you're logged in as an ADMIN user before running migrations.

