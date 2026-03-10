# Deployment Guide

## Architecture

```
                   ┌─────────────┐
  Clients ────────>│   Server    │ (Express + Socket.io)
                   │  port 3000  │
                   └──────┬──────┘
                          │ Redis pub/sub
                   ┌──────┴──────┐
                   │  Voice SFU  │ (mediasoup)
                   │ UDP 10000+  │
                   └─────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         PostgreSQL    PgBouncer    Redis
         port 5432     port 6432   port 6379
```

## Environment Variables

### Required in `.env`

```bash
# Database
DATABASE_URL=postgresql://USER:PASS@pgbouncer:6432/sprava
DATABASE_DIRECT_URL=postgresql://USER:PASS@postgres:5432/sprava
POSTGRES_USER=sprava
POSTGRES_PASSWORD=<strong-password>

# Auth
JWT_SECRET=<random-64-bytes-hex>
JWT_REFRESH_SECRET=<random-64-bytes-hex>

# hCaptcha
HCAPTCHA_SECRET=<your-hcaptcha-secret>

# Email
SENDGRID_API_KEY=<your-key>
SENDGRID_FROM_EMAIL=no-reply@yourdomain.com
APP_URL=https://api.yourdomain.com

# DO Spaces (S3-compatible storage)
DO_SPACES_KEY=<key>
DO_SPACES_SECRET=<secret>
DO_SPACES_BUCKET=<bucket-name>
DO_SPACES_REGION=<region>
DO_SPACES_CDN_URL=https://<bucket>.<region>.cdn.digitaloceanspaces.com

# Voice SFU — REQUIRED for production
MEDIASOUP_ANNOUNCED_IP=<SERVER_PUBLIC_IP>
```

`MEDIASOUP_ANNOUNCED_IP` must be the public IP of the server. This is the IP that WebRTC clients will use to send/receive media. Without it, voice chat will not work.

## Production Deployment (Linux)

### 1. Clone and configure

```bash
git clone <repo> && cd sprava-v2
cp .env.example .env
# Edit .env with production values
```

### 2. Remove the dev override

`docker-compose.override.yml` is for local macOS dev only. Make sure it does NOT exist on the production server:

```bash
rm -f docker-compose.override.yml
```

### 3. Start services

```bash
docker compose up -d
```

### 4. Run migrations

```bash
docker compose exec server npx prisma migrate deploy
```

### Voice SFU network (production)

On Linux, the SFU uses `network_mode: host` — it binds directly to the host network. This is required for mediasoup because:

- No Docker NAT overhead on UDP packets
- Full port range (10000-59999) available without mapping 50k ports
- ICE candidates use the real host IP

Firewall rules needed:

```bash
# Allow RTC UDP traffic
sudo ufw allow 10000:59999/udp

# Allow API + WebSocket
sudo ufw allow 3000/tcp
```

## Local Development (macOS)

### Why it's different

`network_mode: host` does NOT work on macOS — Docker Desktop runs inside a Linux VM, so "host" network is the VM's network, not your Mac's.

### Dev setup

The `docker-compose.override.yml` file (auto-loaded by docker compose) handles this:

| Setting | Production (Linux) | Dev (macOS) |
|---------|-------------------|-------------|
| SFU network | `network_mode: host` | `bridge` + port mapping |
| SFU Redis | `redis://127.0.0.1:6379` | `redis://host.docker.internal:6379` |
| Announced IP | Server public IP | `127.0.0.1` |
| RTC ports | 10000-59999 | 40000-40100/UDP |

### Start infra

```bash
# Start Postgres, Redis, Voice SFU
docker compose up -d

# Start server (outside Docker, for hot reload)
pnpm --filter server dev

# Start desktop app
cd apps/desktop/sprava-v2 && pnpm tauri dev
```

### Testing voice with two clients

```bash
# Terminal 1: first Tauri instance (started above)
# Terminal 2: second Tauri instance sharing the same Vite dev server
cd apps/desktop/sprava-v2 && cargo run --manifest-path src-tauri/Cargo.toml
```

Log in with two different accounts, join the same voice channel.

## Troubleshooting

### Voice not working (no audio between users)

1. **Check SFU is running**: `docker compose logs voice-sfu`
2. **Check `MEDIASOUP_ANNOUNCED_IP`**: must be reachable by clients
   - Production: server's public IP
   - Dev macOS: `127.0.0.1`
3. **Check UDP ports are open**: `sudo ufw status` or equivalent
4. **Restart SFU to clear stale producers**: `docker compose restart voice-sfu`

### Voice SFU timeout errors

The server logs `SFU_TIMEOUT` — means the gateway can't reach the SFU via Redis:

- Check Redis is running: `docker compose logs redis`
- Check SFU Redis URL matches (bridged vs host networking)

### macOS: SFU can't connect to Redis

If using the override file, SFU uses `redis://host.docker.internal:6379` (macOS Docker Desktop resolves this to the host). If NOT using the override, it tries `127.0.0.1:6379` which works on Linux host networking. Make sure `docker-compose.override.yml` exists locally on macOS.
