# Deploying AI Tutor (Oracle Cloud Always Free + DuckDNS)

This puts the whole app on one free Oracle Cloud server, at an address like
`https://aitutor-yourname.duckdns.org`, with HTTPS set up automatically. Cost: nothing, within
Oracle's Always Free limits. Time: about an hour, most of it waiting for the first build.

What runs on the server (all in Docker, from `docker-compose.prod.yml`):

| Service | Job |
|---|---|
| `web` | Caddy: the website, HTTPS certificates (renewed automatically), forwards `/api` to the API |
| `api` | The FastAPI backend; runs database migrations when it starts |
| `video-worker` | Renders videos (Manim + FFmpeg) |
| `postgres`, `redis` | Database and queue: private, not reachable from the internet |
| `backup` | A database backup every day, 14 kept, in `backups/` |

Only ports 80 and 443 are open to the internet.

> **Never paste keys or passwords into chats, issues or commits.** Type them into `.env` on the
> server only. If a key was ever shared, make a new one first (Groq: console.groq.com/keys,
> Gnani: your Gnani dashboard).

---

## 1. Create the Oracle server

1. Sign up at **oracle.com/cloud/free**. Oracle asks for a card to verify you; Always Free
   resources aren't charged. Pick your **home region** carefully (it can't be changed later);
   a less busy region makes free servers easier to get.
2. In the console: **Compute → Instances → Create instance**.
   - **Image:** Canonical **Ubuntu 24.04** (the `aarch64` one).
   - **Shape:** Change shape → **Ampere** → `VM.Standard.A1.Flex`, **2 OCPUs, 12 GB memory**
     (the Always Free maximum).
   - **Networking:** keep "Assign a public IPv4 address" on.
   - **SSH keys:** "Generate a key pair for me" → **download the private key** and keep it safe.
   - **Boot volume:** 100 GB is plenty (Always Free includes 200 GB in total).
   - Create. If it says *Out of capacity*, try another availability domain or try again later.
3. **Make the address permanent:** Instance → Attached VNICs → the VNIC → IPv4 addresses →
   the ⋯ menu → Edit → **Reserved public IP** → create one. Note the address (e.g. `152.70.x.x`).

## 2. Open ports 80 and 443

Two places, both needed:

1. **Oracle's firewall:** Networking → Virtual cloud networks → your VCN → Security Lists →
   Default → **Add ingress rules**: source `0.0.0.0/0`, TCP, destination port `80`; then the
   same for `443`.
2. **The server's own firewall** (Oracle's Ubuntu images block these by default). Connect first
   (step 4), then run:

   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

## 3. Get the free DuckDNS name

1. Sign in at **duckdns.org** (with GitHub or Google).
2. Add a subdomain, e.g. `aitutor-yourname`, and set its **current ip** to the server's
   reserved address from step 1.3. Your site will be `aitutor-yourname.duckdns.org`.
3. Check it from your PC: `nslookup aitutor-yourname.duckdns.org` should show that address.

## 4. Prepare the server

Connect from your PC (Windows PowerShell works):

```bash
ssh -i path\to\ssh-key.key ubuntu@YOUR_SERVER_IP
```

Then on the server:

```bash
sudo apt-get update && sudo apt-get -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit        # log out and back in, so the docker group applies
```

## 5. Get the code

The GitHub repository is private, so give the server read-only access with a *deploy key*:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

On GitHub: the repository → **Settings → Deploy keys → Add deploy key**, paste that line,
leave "Allow write access" **off**. Then on the server:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
EOF
git clone git@github.com:BhupathiViswaDevVarshithRaj/Ai-Tutor.git
cd Ai-Tutor
```

## 6. Settings and keys

```bash
sh deploy/setup-env.sh aitutor-yourname.duckdns.org you@example.com
nano .env
```

`setup-env.sh` makes `.env` with strong random `SECRET_KEY` and database password generated on
the server. In `nano`, fill in:

- `GROQ_API_KEY` (and `GROQ_VIDEO_API_KEY` if you use a second key)
- `GNANI_API_KEY`
- `MEDIA_CONTACT`: a website or email Wikimedia can contact you at (their rules for apps that
  fetch pictures; the project's GitHub page is used if you leave it empty)
- Optionally `SMTP_*`, so password-reset emails are really sent

Save with Ctrl+O, Enter, Ctrl+X. `.env` stays on the server only (it's readable by you alone).

## 7. Start it

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes roughly 20–40 minutes on 2 cores (the video worker compiles graphics
libraries); later updates are much faster. Then:

```bash
docker compose -f docker-compose.prod.yml ps        # all services "Up", api "healthy"
curl https://aitutor-yourname.duckdns.org/api/v1/health/ready
```

Open **https://aitutor-yourname.duckdns.org** and create your account. Caddy gets the HTTPS
certificate on the first visit (it needs ports 80/443 open and the DuckDNS name pointing here).

## Updating

```bash
cd ~/Ai-Tutor
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Database migrations run by themselves when the API restarts.

## Backups

- A compressed database backup is made when the stack starts and every 24 hours after, in
  `~/Ai-Tutor/backups/`; 14 days are kept.
- **Copy them off the server now and then** (a backup on the same disk doesn't survive losing
  the server). From your PC:
  `scp -i path\to\ssh-key.key ubuntu@YOUR_SERVER_IP:Ai-Tutor/backups/*.dump .`
- Restore (replaces all current data; it asks first):
  `sh deploy/restore.sh backups/aitutor-YYYYMMDD-HHMMSS.dump`
- Videos and pictures (`media` volume) aren't in the database backup; they can be made again.

## Monitoring

- Every service restarts by itself if it stops, and when the server reboots. The API reports
  its health to Docker every 30 seconds.
- Logs: `docker compose -f docker-compose.prod.yml logs -f api` (or `web`, `video-worker`).
  Logs are capped at 30 MB per service, so they can't fill the disk.
- Disk space: `df -h /`. Old videos can be deleted in the app.
- **Get an email if the site goes down:** a free monitor at uptimerobot.com checking
  `https://aitutor-yourname.duckdns.org/api/v1/health` every 5 minutes.

## If the address ever changes

With a reserved IP it shouldn't. If you didn't reserve one, let the server keep DuckDNS up to
date: put `DUCKDNS_SUBDOMAIN=aitutor-yourname` and `DUCKDNS_TOKEN=` (from duckdns.org) in
`.env`, then:

```bash
docker compose -f docker-compose.prod.yml --profile duckdns up -d
```

## Things to know

- **Free-tier limits:** 2 cores and 12 GB of RAM in total. The app fits comfortably; a video
  takes a few minutes to render. Groq's free tier allows 200,000 AI tokens a day for your
  account (about 18 videos, shared with the tutor).
- **Idle servers:** Oracle may reclaim Always Free servers it considers idle. Upgrading the
  account to Pay As You Go keeps free resources free and avoids this; check Oracle's current
  terms first.
- **Microphone:** browsers only allow it over HTTPS, which is why the DuckDNS name matters.

## Troubleshooting

| Problem | Check |
|---|---|
| Site doesn't load at all | Step 2: both firewalls open for 80 and 443; `docker compose ... ps` |
| Browser warns about the certificate | DuckDNS points at the right IP (`nslookup`), then `docker compose ... logs web` |
| "Today's AI allowance is used up" | Groq's daily limit: it refills gradually, or upgrade the Groq account |
| Videos stay "Waiting" | `docker compose ... logs video-worker` |
| Sign-in loops back to the login page | `DOMAIN` in `.env` must be exactly the address you open |
