#!/bin/sh
# Make the production .env on the server, with strong random secrets generated right here
# (they never travel anywhere). Safe to re-run: an existing .env is never overwritten.
#   sh deploy/setup-env.sh aitutor-yourname.duckdns.org you@example.com
set -eu
cd "$(dirname "$0")/.."
domain="${1:?usage: sh deploy/setup-env.sh <domain> <email>}"
email="${2:?usage: sh deploy/setup-env.sh <domain> <email>}"

if [ -e .env ]; then
  echo ".env already exists; leaving it as it is."
  exit 0
fi

secret() { head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# Comments after values would end up inside them, so drop the "   # ..." part of each line.
sed -e 's/[[:space:]]\{2,\}#.*$//' deploy/env.production.example \
  | sed -e "s|^DOMAIN=.*|DOMAIN=$domain|" \
        -e "s|^ACME_EMAIL=.*|ACME_EMAIL=$email|" \
        -e "s|^SECRET_KEY=.*|SECRET_KEY=$(secret)|" \
        -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(secret)|" \
  > .env
chmod 600 .env
echo "Made .env for https://$domain (secrets generated)."
echo "Now add your API keys:  nano .env   (GROQ_API_KEY, GNANI_API_KEY, MEDIA_CONTACT)"
