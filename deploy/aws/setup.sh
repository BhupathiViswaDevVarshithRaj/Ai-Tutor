#!/bin/bash
# setup.sh DOMAIN: prepares the shared AWS server (Ubuntu 24.04, also running PolarBear and PingBuyers) for AI Tutor:
# packages, the aitutor user with uv, its Postgres role and database, Redis, the media folder, the settings file with
# generated secrets, and a Caddy site for DOMAIN. Run as root: `ssh ubuntu@HOST 'sudo bash -s DOMAIN' < deploy/aws/setup.sh`.
# Running it again changes nothing already set up; with a new DOMAIN it moves the site there (then restart aitutor-api).
# The AI and speech keys are added to /etc/aitutor/aitutor.env by hand (see .env.example), then deploy/aws/push.sh.
set -euo pipefail
domain=$1
[[ $domain =~ ^[a-z0-9-]+(\.[a-z0-9-]+)+$ ]] || { echo "not a domain: $domain"; exit 1; }
export DEBIAN_FRONTEND=noninteractive
# needrestart would otherwise restart PolarBear's and PingBuyers' services when a shared library is updated.
export NEEDRESTART_SUSPEND=1
apt-get update -q
nice -n 19 apt-get install -y -q redis-server postgresql-16-pgvector ffmpeg libcairo2-dev libpango1.0-dev pkg-config \
  build-essential fonts-noto-core rsync curl openssl

id aitutor >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/aitutor --shell /bin/bash aitutor
chmod 755 /opt/aitutor
install -d -m 755 -o root -g root /opt/aitutor/backend /opt/aitutor/web
install -d -m 750 -o aitutor -g aitutor /var/lib/aitutor /var/lib/aitutor/media /var/lib/aitutor/cache
[ -x /opt/aitutor/.local/bin/uv ] || sudo -iu aitutor bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh -s -- -q'

sudo -u postgres psql -tAc "select 1 from pg_database where datname = 'aitutor'" | grep -q 1 || need_db=1
env=/etc/aitutor/aitutor.env
install -d -m 750 -o root -g aitutor /etc/aitutor
if [ ! -f $env ]; then
  db_password=$(openssl rand -hex 24)
  install -m 640 -o root -g aitutor /dev/null $env
  cat >$env <<EOF
APP_ENV=production
SECRET_KEY=$(openssl rand -hex 48)
CORS_ORIGINS=https://$domain
FRONTEND_URL=https://$domain
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=aitutor
POSTGRES_USER=aitutor
POSTGRES_PASSWORD=$db_password
REDIS_URL=redis://127.0.0.1:6379/0
MEDIA_ROOT=/var/lib/aitutor/media
EOF
  verb=create
  sudo -u postgres psql -tAc "select 1 from pg_roles where rolname = 'aitutor'" | grep -q 1 && verb=alter
  # Through stdin, so the password never shows in the process list.
  echo "$verb role aitutor login password '$db_password'" | sudo -u postgres psql -q
fi
sed -i -E "s#^(CORS_ORIGINS|FRONTEND_URL)=.*#\1=https://$domain#" $env
# Every account on this server can reach 127.0.0.1, and the video queue unpickles its jobs: Redis needs a password.
if ! grep -q '^requirepass ' /etc/redis/redis.conf; then
  redis_password=$(openssl rand -hex 24)
  echo "requirepass $redis_password" >>/etc/redis/redis.conf
  sed -i -E "s#^REDIS_URL=.*#REDIS_URL=redis://:$redis_password@127.0.0.1:6379/0#" $env
  systemctl restart redis-server
fi
[ -z "${need_db:-}" ] || sudo -u postgres createdb -O aitutor aitutor
# pgvector isn't a trusted extension, so the superuser makes all three; the first migration then finds them in place.
sudo -u postgres psql -q -d aitutor -c 'create extension if not exists vector' -c 'create extension if not exists citext' \
  -c 'create extension if not exists pgcrypto'

# The site lives in its own file, imported by the shared Caddyfile; it is checked alone before anything shared changes.
site=$(mktemp)
cat >"$site" <<EOF
$domain {
	encode zstd gzip

	# The microphone is allowed for this site only (voice features need it); fonts come from Google Fonts.
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), geolocation=(), microphone=(self)"
		Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' wss://$domain https://fonts.googleapis.com https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
		-Server
	}

	# Streamed tutor replies are flushed at once; the voice WebSocket passes through.
	handle /api/* {
		reverse_proxy 127.0.0.1:7420 {
			flush_interval -1
		}
	}

	handle {
		root * /opt/aitutor/web
		@assets path /assets/*
		header @assets Cache-Control "public, max-age=31536000, immutable"
		header /index.html Cache-Control "no-cache"
		try_files {path} /index.html
		file_server
	}
}
EOF
caddy validate --config "$site" --adapter caddyfile >/dev/null
install -m 644 "$site" /etc/caddy/aitutor.caddy
rm -f "$site"
grep -qxF 'import /etc/caddy/aitutor.caddy' /etc/caddy/Caddyfile || printf '\nimport /etc/caddy/aitutor.caddy\n' >>/etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl reload caddy
echo "setup done; caddy serves https://$domain"
