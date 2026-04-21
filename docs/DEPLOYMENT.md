# Persona Lab Deployment Guide

## Quick Start (Docker)

### 1. Clone and Setup

```bash
cd /workspace/persona-lab

# Copy environment files
cp server/.env.example server/.env
cp miniapp/.env.example miniapp/.env

# Edit environment files with your credentials
vim server/.env
```

### 2. Start with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

Services will be available at:
- Backend API: http://localhost:3000
- Frontend (dev): http://localhost:10086
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 3. Initialize Database

```bash
# Run database migrations
docker-compose exec server npx prisma migrate dev

# Seed initial data (optional)
docker-compose exec server npx prisma db seed
```

---

## Manual Deployment

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+ (optional)
- npm or yarn

### Backend Setup

```bash
cd server

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your database credentials, WeChat keys, etc.

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Build TypeScript
npm run build

# Start server
npm start
# Or for development:
npm run dev
```

### Frontend Setup

```bash
cd miniapp

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API URL

# Development
npm run dev:weapp

# Production build
npm run build:weapp
```

Import the `miniapp/dist` folder into WeChat DevTools.

---

## Cloud Deployment

### Vercel (Frontend)

1. Connect GitHub repository
2. Set build command: `cd miniapp && npm run build:weapp`
3. Set output directory: `miniapp/dist`
4. Add environment variables

### Railway (Backend)

1. Connect GitHub repository
2. Set root directory: `server`
3. Add PostgreSQL database
4. Add environment variables from `.env.example`
5. Deploy

### Alternative: Single VPS

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh

# Clone and setup
git clone <repo> persona-lab
cd persona-lab

# Configure
cp server/.env.example server/.env
# Edit .env

# Deploy
docker-compose up -d
```

---

## Environment Variables

### Required (Server)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# WeChat
WECHAT_APP_ID=wx_xxx
WECHAT_APP_SECRET=xxx
```

### Optional (Server)

```bash
# Redis
REDIS_URL=redis://localhost:6379

# WeChat Pay
WECHAT_PAY_MCHID=xxx
WECHAT_PAY_KEY=xxx

# LLM
LLM_API_KEY=xxx
LLM_MODEL=qwen-plus
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### Logs

```bash
# Docker
docker-compose logs -f server

# Manual
tail -f server/logs/combined.log
tail -f server/logs/error.log
```

### Database

```bash
# Prisma Studio (visual database browser)
npx prisma studio

# Direct SQL
docker-compose exec db psql -U postgres -d persona_lab
```

---

## Backup & Restore

### Database Backup

```bash
# Backup
docker-compose exec db pg_dump -U postgres persona_lab > backup.sql

# Restore
docker-compose exec -T db psql -U postgres persona_lab < backup.sql
```

### Volume Backup

```bash
# Backup PostgreSQL data
tar -czf postgres-backup.tar.gz /var/lib/docker/volumes/persona-lab_postgres_data/_data
```

---

## Troubleshooting

### Common Issues

**Database connection error:**
```bash
# Check if PostgreSQL is running
docker-compose ps db

# Check connection string
docker-compose exec server env | grep DATABASE_URL
```

**Port already in use:**
```bash
# Find process using port 3000
lsof -i :3000

# Or change port in .env
PORT=3001
```

**Prisma migration error:**
```bash
# Reset database (development only!)
npx prisma migrate reset

# Or manually fix
npx prisma db pull
npx prisma generate
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Use HTTPS in production
- [ ] Set strong JWT secrets (32+ chars)
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up firewall rules
- [ ] Regular security updates
- [ ] Backup database regularly

---

## Performance Optimization

### Database

- Add indexes for frequently queried fields
- Use connection pooling
- Enable query logging for slow queries

### Caching

- Enable Redis for session storage
- Cache frequently accessed data
- Use CDN for static assets

### API

- Enable gzip compression
- Use HTTP/2
- Implement request throttling

---

## Support

For issues and questions:
- Check logs: `server/logs/`
- API docs: `/workspace/persona-lab/docs/API.md`
- Project README: `/workspace/persona-lab/README.md`
