# 🚀 Quick Start Guide (Local Development)

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Create .env File

Create `backend/.env` file:

```env
NODE_ENV=development
PORT=8000
DATABASE_URL="postgresql://user:password@localhost:5432/godam_db"
JWT_SECRET=dev-secret-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002
```

## Step 3: Run Database Migrations

```bash
cd backend
npx prisma migrate dev
# OR if migrations already exist:
npx prisma migrate deploy
npx prisma generate
```

## Step 4: Start Server

```bash
npm run dev
```

## Step 5: Register First User

```bash
POST http://localhost:8000/api/v1/auth/register
Content-Type: application/json

{
  "name": "Admin",
  "email": "admin@example.com",
  "password": "admin123",
  "role": "ADMIN"
}
```

## Step 6: Login

```bash
POST http://localhost:8000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}
```

You'll get a token - use it in all API requests:

```
Authorization: Bearer <your-token>
```

## ✅ Done!

Your server should now be running on `http://localhost:8000`

---

**Note**: For production, change `JWT_SECRET` to a strong random string!

