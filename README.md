# Photo Share

A picture-sharing web application with Cloudflare R2 storage, Google OAuth authentication, and automated Docker deployment.

## Features

- Upload and share pictures with descriptions and tags
- Timeline view (chronological) of your pictures
- Home feed (reverse chronological) of all users' pictures
- Tag filtering and search
- Like/dislike functionality
- Image compression (original, compressed, thumbnail)
- Google OAuth authentication with email whitelist
- Daily automated backups to Cloudflare R2
- Docker containerization
- GitHub Actions deployment to VPS

## Tech Stack

- **Runtime:** Bun
- **Frontend:** React 19 + TypeScript + Tailwind CSS 4.1
- **Backend:** Bun.serve() with native routing
- **Database:** SQLite (bun:sqlite) stored outside container
- **Storage:** Cloudflare R2 (buckets: `photos`, `db-backups`)
- **Auth:** Google OAuth with email whitelist
- **Container:** Docker + Docker Compose
- **CI/CD:** GitHub Actions

## Development

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Start dev server with hot reload
bun --hot src/index.ts

# Build production assets
bun run build

# Run tests
bun test
```

## Production Deployment

### VPS Setup (One-Time)

```bash
# On your VPS
cd /opt
git clone https://github.com/youruser/photo-share.git
cd photo-share
mkdir -p data
cp .env.example .env
# Edit .env with production secrets
docker-compose up -d
```

### Automated Deployment

Push to main branch and GitHub Actions will automatically:
1. Build the application
2. SSH into your VPS
3. Pull latest code
4. Rebuild and restart Docker containers

## Environment Variables

See `.env.example` for required configuration:
- R2 storage credentials
- Google OAuth credentials
- Email whitelist for authentication
- Session secret

## Project Structure

```
photo-share/
├── src/
│   ├── index.ts              # Bun server with API routes
│   ├── index.html            # HTML entry point
│   ├── frontend.tsx          # React entry point
│   ├── App.tsx               # Main React component
│   ├── db.ts                 # SQLite database
│   ├── r2.ts                 # Cloudflare R2 client
│   ├── auth.ts               # Google OAuth
│   ├── compression.ts        # Image compression
│   ├── backup.ts             # Daily backups
│   ├── types.ts              # TypeScript types
│   └── components/           # React components
├── Dockerfile                # Container definition
├── docker-compose.yml        # Docker Compose config
└── .github/workflows/        # CI/CD pipeline
```

## License

Private project - all rights reserved.
