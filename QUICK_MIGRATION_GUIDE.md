# 🚀 Quick Migration Guide - API Endpoint

## Endpoint Created
✅ `POST https://goodaam-backend.onrender.com/api/migrations/apply-all`

## How to Use (3 Simple Steps)

### Step 1: Get Your Admin Token

**Login via API:**
```bash
POST https://goodaam-backend.onrender.com/api/auth/login
Body:
{
  "email": "admin@godam.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

**Copy the `token` value!**

### Step 2: Run Migration

**Using Postman:**
1. Create new POST request
2. URL: `https://goodaam-backend.onrender.com/api/migrations/apply-all`
3. Headers:
   - `Authorization`: `Bearer YOUR_TOKEN_HERE`
   - `Content-Type`: `application/json`
4. Click "Send"

**Using cURL:**
```bash
curl -X POST https://goodaam-backend.onrender.com/api/migrations/apply-all \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Using Browser Console (if logged in):**
```javascript
// Get token from wherever your app stores it
const token = localStorage.getItem('token'); // or sessionStorage, etc.

fetch('https://goodaam-backend.onrender.com/api/migrations/apply-all', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Migration Result:', data);
  if (data.success) {
    alert('✅ Migration completed successfully!');
  } else {
    alert('❌ Migration failed: ' + data.message);
  }
});
```

### Step 3: Verify Migration

**Check Status:**
```bash
GET https://goodaam-backend.onrender.com/api/migrations/status
Headers:
  Authorization: Bearer YOUR_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "weightColumns": {
      "weightFromJacobabad": true,
      "faisalabadWeight": true
    },
    "laadNumberUnique": false,
    "saleFields": {
      "laadNumber": true,
      "truckNumber": true,
      "address": true
    }
  }
}
```

## What This Migration Does

✅ Adds `weightFromJacobabad` column to `LaadItem` table
✅ Adds `faisalabadWeight` column to `LaadItem` table
✅ Removes unique constraint from `Laad.laadNumber`
✅ Adds `laadNumber` to `Sale` table
✅ Adds `truckNumber` to `Sale` table
✅ Adds `address` to `Sale` table
✅ Creates indexes for better performance

## Security

- ✅ Requires authentication (must be logged in)
- ✅ Requires ADMIN role (only admin users can run)
- ✅ Safe to run multiple times (uses IF NOT EXISTS)

## Troubleshooting

**Error: "Unauthorized"**
- Make sure you're logged in as ADMIN user
- Check that token is valid and not expired

**Error: "Forbidden"**
- Your user must have ADMIN role
- Check user role in database

**Error: "Migration failed"**
- Check database connection
- Verify database user has ALTER TABLE permissions

## After Migration

1. ✅ Test laad creation API - should work now!
2. ✅ Test process sale API - should work with new fields!
3. ✅ Check migration status to verify all columns exist

---

**That's it! One API call and you're done! 🎉**

