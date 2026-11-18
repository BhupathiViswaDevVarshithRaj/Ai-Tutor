#!/bin/bash
# push.sh HOST: ships the committed code (HEAD) to the server prepared by setup.sh. Builds the web app on this Mac,
# copies it, the backend and the systemd units over, installs the Python packages and restarts the API (which runs the
# database migrations first) and the video worker. HOST is the sudo login, e.g. ubuntu@52.64.194.175.
set -euo pipefail
host=$1
repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git -C "$repo" archive HEAD | tar -x -C "$work"
(cd "$work/frontend" && npm ci --no-audit --no-fund --loglevel=error && npm run build)

# This Mac's rsync can't set owners, so files land in the admin's staging folder and the server's rsync places them.
ssh "$host" 'mkdir -p ~/aitutor-stage/units'
rsync -az --delete --exclude /.venv/ "$work/backend/" "$host:aitutor-stage/backend/"
rsync -az --delete "$work/frontend/dist/" "$host:aitutor-stage/web/"
rsync -az --delete "$work/deploy/aws/"*.service "$host:aitutor-stage/units/"

ssh "$host" 'sudo bash -s' <<'EOF'
set -euo pipefail
stage=$(getent passwd "$SUDO_USER" | cut -d: -f6)/aitutor-stage
rsync -a --delete --chown=root:root "$stage/backend/" /opt/aitutor/backend/
rsync -a --delete --chown=root:root "$stage/web/" /opt/aitutor/web/
install -m 644 -o root -g root "$stage"/units/*.service /etc/systemd/system/
sudo -u aitutor -H bash -c 'cd /opt/aitutor && { [ -x venv/bin/python ] || .local/bin/uv venv -q --python 3.11 venv; } &&
  nice -n 19 .local/bin/uv pip install -q --python venv/bin/python -r backend/pyproject.toml --extra video'
systemctl daemon-reload
systemctl enable -q aitutor-api aitutor-worker
systemctl restart aitutor-api aitutor-worker
for _ in $(seq 30); do
  curl -fs -m 5 -o /dev/null http://127.0.0.1:7420/api/v1/health/ready && { echo "AI Tutor is up"; exit 0; }
  sleep 2
done
echo "the API did not become ready; see journalctl -u aitutor-api"
exit 1
EOF
