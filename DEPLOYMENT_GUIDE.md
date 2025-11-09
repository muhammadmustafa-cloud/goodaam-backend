# 🚀 Deployment Guide - Faisalabad Godam System

## 📋 Pre-Deployment Checklist

### ✅ Security Checklist
- [ ] Change `JWT_SECRET` to a strong random string (minimum 32 characters)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` with your frontend domain(s)
- [ ] Use strong database password
- [ ] Enable HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Review and test rate limiting
- [ ] Enable database backups

### ✅ Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Server Configuration
NODE_ENV=production
PORT=8000

# Database Configuration
DATABASE_URL="postgresql://user:password@host:5432/godam_db?schema=public"

# JWT Configuration (CHANGE THIS!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-this
JWT_EXPIRES_IN=7d

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Security
TRUST_PROXY=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### ✅ Frontend Environment Variables

Create a `.env.local` file in the `godam-frontend/` directory:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
NODE_ENV=production
```

## 🗄️ Database Setup

### 1. Run Migrations

```bash
cd backend
npx prisma migrate deploy
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. (Optional) Seed Database

```bash
npm run db:seed
```

## 🔧 Backend Deployment

### Option 1: Using PM2 (Recommended for VPS)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start index.js --name godam-backend

# Save PM2 configuration
pm2 save
pm2 startup

# Monitor
pm2 monit
```

### Option 2: Using Docker

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 8000
CMD ["node", "index.js"]
```

```bash
docker build -t godam-backend .
docker run -d -p 8000:8000 --env-file .env godam-backend
```

### Option 3: Using Render/Railway/Heroku

1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Deploy automatically on push

## 🎨 Frontend Deployment

### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd godam-frontend
vercel

# Set environment variables in Vercel dashboard
```

### Option 2: Using Docker

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔒 Security Best Practices

### 1. SSL/HTTPS
- Use Let's Encrypt for free SSL certificates
- Force HTTPS redirects
- Use HSTS headers

### 2. Database Security
- Use connection pooling
- Enable SSL for database connections
- Regular backups
- Use read-only users for reports

### 3. API Security
- All routes are protected with authentication
- Rate limiting is enabled
- CORS is configured
- Input sanitization is active
- Helmet.js security headers are enabled

### 4. Monitoring
- Set up error logging (Winston)
- Monitor API response times
- Set up alerts for errors
- Monitor database performance

## 📊 Health Checks

### Backend Health Check
```bash
curl https://your-backend-domain.com/health
```

### Expected Response:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

## 🐛 Troubleshooting

### Database Connection Issues
- Check `DATABASE_URL` format
- Verify database is accessible
- Check firewall rules
- Verify credentials

### CORS Issues
- Add frontend domain to `ALLOWED_ORIGINS`
- Check if credentials are enabled
- Verify CORS middleware is loaded

### Authentication Issues
- Verify `JWT_SECRET` is set
- Check token expiration
- Verify token is sent in Authorization header

### Rate Limiting Issues
- Adjust `RATE_LIMIT_MAX_REQUESTS` if needed
- Check if behind reverse proxy (set `TRUST_PROXY=true`)

## 📝 Post-Deployment

1. Test all API endpoints
2. Test authentication flow
3. Verify CORS is working
4. Check error logging
5. Monitor performance
6. Set up backups
7. Document any custom configurations

## 🔄 Updates & Maintenance

### Updating Backend
```bash
git pull
npm install
npx prisma migrate deploy
npx prisma generate
pm2 restart godam-backend
```

### Updating Frontend
```bash
git pull
npm install
npm run build
# Restart your frontend server
```

## 📞 Support

For issues or questions, check:
- Error logs: `backend/logs/`
- PM2 logs: `pm2 logs godam-backend`
- Database logs: Check your database provider

---

**⚠️ Important**: Never commit `.env` files to version control!

