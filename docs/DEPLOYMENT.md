# Deployment Guide

This guide covers deploying the Football Minutes application to various platforms.

## Deployment Architecture

The application supports **multiple deployment targets**:

| Platform | Method | Best For |
|----------|--------|----------|
| **Vercel** | Serverless Functions | Zero-config, auto-scaling, global CDN |
| **Railway** | Express Server | Easy setup, PostgreSQL included |
| **Heroku** | Express Server | Traditional PaaS, well-documented |
| **Docker** | Container | Self-hosted, full control |
| **VPS** | Node.js + PM2 | Self-hosted, cost-effective |

## Pre-Deployment Checklist

- [ ] Database migrations run successfully
- [ ] Tests pass: `npm test -- --run`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Linter passes: `npm run lint`
- [ ] Environment variables configured
- [ ] Session secret generated (32+ chars random string)

---

## Vercel Deployment

### Setup

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Set Secrets**:
   ```bash
   vercel secrets add football_minutes_database_url "postgresql://..."
   vercel secrets add football_minutes_session_secret "your-secret-here"
   ```

3. **Configure Environment Variables** in Vercel Dashboard:
   - `DATABASE_URL` → @football_minutes_database_url
   - `FFM_SESSION_SECRET` → @football_minutes_session_secret
   - `VITE_USE_API` → true
   - `VITE_API_BASE_URL` → /api
   - `VITE_TEAM_ID` → your-team-uuid
   - `VITE_SESSION_SECRET` → same as FFM_SESSION_SECRET

4. **Deploy**:
   ```bash
   vercel --prod
   ```

### Configuration

The `vercel.json` is already configured:

```json
{
  "buildCommand": "npm run build",
  "prebuildCommand": "npm run db:migrate",
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3.0.0"
    }
  }
}
```

### Notes

- Vercel uses serverless functions from `/api` folder
- Static frontend served from `/dist`
- Automatic HTTPS and CDN
- Environment variables set per project

---

## Railway Deployment

### Setup

1. **Install Railway CLI** (optional):
   ```bash
   npm install -g @railway/cli
   ```

2. **Create New Project** on [railway.app](https://railway.app):
   - Connect GitHub repository
   - Add PostgreSQL database service

3. **Configure Environment Variables**:
   ```
   DATABASE_URL=(auto-set by Railway PostgreSQL)
   FFM_SESSION_SECRET=your-random-secret-32+chars
   VITE_USE_API=true
   VITE_API_BASE_URL=/api
   VITE_TEAM_ID=your-team-uuid
   VITE_SESSION_SECRET=your-random-secret-32+chars
   NODE_ENV=production
   PORT=(auto-set by Railway)
   ```

4. **Deploy**:
   - Push to GitHub → Railway auto-deploys
   - Or use CLI: `railway up`

### Configuration

Railway automatically:
- Detects `Procfile` and runs `npm start`
- Runs migrations via `release` command
- Sets `PORT` environment variable
- Provides PostgreSQL `DATABASE_URL`

---

## Heroku Deployment

### Setup

1. **Install Heroku CLI**:
   ```bash
   curl https://cli-assets.heroku.com/install.sh | sh
   ```

2. **Create App**:
   ```bash
   heroku create your-app-name
   heroku addons:create heroku-postgresql:mini
   ```

3. **Set Config Vars**:
   ```bash
   heroku config:set FFM_SESSION_SECRET="your-secret"
   heroku config:set VITE_USE_API=true
   heroku config:set VITE_API_BASE_URL=/api
   heroku config:set VITE_TEAM_ID=your-team-uuid
   heroku config:set VITE_SESSION_SECRET="your-secret"
   heroku config:set NODE_ENV=production
   ```

4. **Deploy**:
   ```bash
   git push heroku main
   ```

5. **Run Migrations**:
   ```bash
   heroku run npm run db:migrate
   ```

### Configuration

Heroku uses:
- `Procfile` to start server (`npm start`)
- Auto-sets `DATABASE_URL` from PostgreSQL addon
- Auto-sets `PORT` environment variable
- `package.json` engines field for Node version

---

## Docker Deployment

### Build Image

```bash
docker build -t football-minutes .
```

### Run Locally

```bash
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e FFM_SESSION_SECRET="your-secret" \
  -e VITE_USE_API=true \
  -e VITE_API_BASE_URL=/api \
  -e VITE_TEAM_ID=your-team-uuid \
  -e VITE_SESSION_SECRET="your-secret" \
  football-minutes
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/football_minutes
      FFM_SESSION_SECRET: your-secret-here
      VITE_USE_API: "true"
      VITE_API_BASE_URL: /api
      VITE_TEAM_ID: your-team-uuid
      VITE_SESSION_SECRET: your-secret-here
      NODE_ENV: production
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: football_minutes
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Run with:
```bash
docker-compose up -d
docker-compose exec app npm run db:migrate
```

### Push to Registry

```bash
# Docker Hub
docker tag football-minutes your-username/football-minutes:latest
docker push your-username/football-minutes:latest

# GitHub Container Registry
docker tag football-minutes ghcr.io/your-username/football-minutes:latest
docker push ghcr.io/your-username/football-minutes:latest
```

---

## VPS / Self-Hosted Deployment

### Prerequisites

- Ubuntu 22.04 or similar
- Node.js 20+ installed
- PostgreSQL 15+ installed
- Nginx (for reverse proxy)
- PM2 (for process management)

### Setup

1. **Install Dependencies**:
   ```bash
   # Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # PostgreSQL 15
   sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
   wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
   sudo apt-get update
   sudo apt-get install -y postgresql-15

   # PM2
   sudo npm install -g pm2

   # Nginx
   sudo apt-get install -y nginx
   ```

2. **Create Database**:
   ```bash
   sudo -u postgres psql
   CREATE DATABASE football_minutes;
   CREATE USER ffm_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE football_minutes TO ffm_user;
   \q
   ```

3. **Clone and Build**:
   ```bash
   cd /opt
   sudo git clone https://github.com/davidroche7/Football-Minutes-Beta.git
   cd Football-Minutes-Beta
   sudo npm install

   # Create .env
   sudo nano .env
   # (Add production environment variables)

   # Run migrations
   sudo npm run db:migrate

   # Build
   sudo npm run build
   ```

4. **Configure PM2**:
   ```bash
   sudo pm2 start npm --name "football-minutes" -- start
   sudo pm2 save
   sudo pm2 startup
   ```

5. **Configure Nginx**:
   ```bash
   sudo nano /etc/nginx/sites-available/football-minutes
   ```

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/football-minutes /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **Setup SSL with Let's Encrypt**:
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Maintenance

```bash
# View logs
pm2 logs football-minutes

# Restart app
pm2 restart football-minutes

# Update app
cd /opt/Football-Minutes-Beta
sudo git pull
sudo npm install
sudo npm run build
pm2 restart football-minutes

# Monitor
pm2 monit
```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `FFM_SESSION_SECRET` | Session signing secret (32+ chars) | `a1b2c3d4e5f6...` |

### Frontend Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_USE_API` | Enable API mode | `true` |
| `VITE_API_BASE_URL` | API base URL | `/api` |
| `VITE_TEAM_ID` | Team UUID | Required if using API |
| `VITE_SESSION_SECRET` | Session secret (match backend) | Required if using API |
| `VITE_ACTOR_ROLES` | Default roles | `coach,analyst` |

### Server Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3001` |
| `API_PORT` | API port (dev only) | `3001` |
| `CORS_ORIGIN` | CORS origin | `*` in prod |
| `DB_POOL_MAX` | Max DB connections | `10` |

---

## Post-Deployment

### 1. Verify Health

```bash
# Check health endpoint
curl https://your-domain.com/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-10-23T...",
  "database": "connected"
}
```

### 2. Run Smoke Tests

- ✅ Can access homepage
- ✅ Can log in
- ✅ Can create a player
- ✅ Can create a fixture
- ✅ Can view stats
- ✅ API calls succeed (check browser Network tab)

### 3. Monitor

Set up monitoring for:
- Server uptime
- API response times
- Database connection errors
- Memory usage
- Disk space

### 4. Backups

Configure automated database backups:

```bash
# PostgreSQL backup script
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

---

## Troubleshooting

### Build Fails

1. Check Node.js version: `node --version` (should be 20+)
2. Clear build cache: `rm -rf dist node_modules && npm install`
3. Run build locally first: `npm run build`

### Database Connection Issues

1. Verify `DATABASE_URL` format
2. Check database allows connections from app server
3. Verify SSL settings match database requirements
4. Test connection: `psql $DATABASE_URL`

### 500 Errors

1. Check server logs (varies by platform)
2. Verify all environment variables set
3. Check database migrations ran
4. Verify session secret is set

### CORS Errors

1. Check `CORS_ORIGIN` environment variable
2. Verify `VITE_API_BASE_URL` is correct
3. Use `/api` for same-origin deployments

---

## Scaling Considerations

### Horizontal Scaling

- Use load balancer (AWS ALB, Google Cloud Load Balancer)
- Share session state (Redis) if using multiple instances
- Use managed PostgreSQL (RDS, Cloud SQL, Supabase)

### Database

- Connection pooling (pgBouncer)
- Read replicas for analytics queries
- Regular VACUUM and ANALYZE

### Caching

- Add Redis for session storage
- Cache API responses (GET endpoints)
- CDN for static assets

---

## Security Checklist

- [ ] HTTPS enabled
- [ ] Session secret is random and secure
- [ ] Database credentials rotated
- [ ] CORS properly configured
- [ ] Rate limiting enabled (add middleware)
- [ ] SQL injection protection (using parameterized queries)
- [ ] XSS protection (React escapes by default)
- [ ] CSRF protection (implemented in API)
- [ ] Security headers (add helmet.js)
- [ ] Regular dependency updates (`npm audit`)

---

## Support

For deployment issues:
1. Check platform-specific documentation
2. Review [DEVELOPMENT.md](./DEVELOPMENT.md) for local testing
3. Open an issue on GitHub with:
   - Platform (Vercel/Railway/Docker/etc.)
   - Error messages
   - Steps to reproduce
