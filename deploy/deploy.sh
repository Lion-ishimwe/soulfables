#!/usr/bin/env bash
#
# Deploy Soulfables. Run on the instance, as the service user:
#
#   sudo -u soulfables bash /srv/soulfables/deploy/deploy.sh
#
# Pulls, reads the secrets out of Parameter Store, builds, restarts.
# Run it as often as you like — it is the whole deployment.

set -euo pipefail

APP_DIR=${APP_DIR:-/srv/soulfables}
SSM_PATH=${SSM_PATH:-/soulfables/production}
REGION=${AWS_REGION:-eu-north-1}
BRANCH=${BRANCH:-master}
ENV_FILE="$APP_DIR/.env.production"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

cd "$APP_DIR"

# ---------------------------------------------------------------------
# Get the code, however it arrives.
#
# Two ways in, because the repository has no remote yet: either a git
# origin exists and we pull from it, or the code was pushed up by
# deploy/upload.sh and is already sitting here. Guessing wrong in the
# second case would mean git resetting away the files that were just
# uploaded, so this checks rather than assumes.
# ---------------------------------------------------------------------
if git rev-parse --git-dir >/dev/null 2>&1 && git remote | grep -q .; then
  log "Fetching $BRANCH"
  git fetch --quiet origin "$BRANCH"
  git reset --hard --quiet "origin/$BRANCH"
  log "Now at $(git log --oneline -1)"
else
  log "No git remote — deploying the files already in $APP_DIR"
  [[ -f package.json ]] || { echo "No package.json here. Upload the code first: bash deploy/upload.sh" >&2; exit 1; }
fi

# ---------------------------------------------------------------------
# Secrets, from Parameter Store.
#
# Written before the build, not after, because Next inlines every
# NEXT_PUBLIC_* value into the JavaScript it produces. Those are decided
# at build time and cannot be changed by restarting with a different
# environment — a deploy that built without them would ship a bundle
# pointing at no database, and would do it silently.
#
# umask so the file cannot exist even briefly in a state anything else
# on the box could read.
# ---------------------------------------------------------------------
log "Reading secrets from ${SSM_PATH}"
umask 077

if ! aws ssm get-parameters-by-path \
      --path "$SSM_PATH" --recursive --with-decryption \
      --region "$REGION" --output json > /tmp/sf-params.$$; then
  echo "Could not read Parameter Store. Is the IAM role attached to this instance?" >&2
  rm -f /tmp/sf-params.$$
  exit 1
fi

# JSON, parsed by a script, rather than tab-separated text parsed by the
# shell. A value containing a newline splits a text record in two, which
# turned seven parameters into eight settings and wrote a nameless line
# the env file could not source. See deploy/write-env.py.
if ! count=$(python3 "$APP_DIR/deploy/write-env.py" "$ENV_FILE" < /tmp/sf-params.$$); then
  rm -f /tmp/sf-params.$$
  exit 1
fi
rm -f /tmp/sf-params.$$

chmod 600 "$ENV_FILE"
log "${count} settings loaded"

# Fail loudly and early if the three that matter are absent, rather than
# building a site that renders "no database connection" to the world.
set -a; source "$ENV_FILE"; set +a
for required in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  if [[ -z "${!required:-}" ]]; then
    echo "Missing ${required} in Parameter Store. Refusing to build a broken site." >&2
    exit 1
  fi
done

# Everything, including devDependencies — this box builds, it does not
# just run. tailwindcss, postcss and typescript all live in devDeps, and
# --omit=dev would install cleanly and then fail the build a minute later
# with "Cannot find module 'tailwindcss'", which reads like a broken
# repository rather than a wrong flag.
log "Installing dependencies"
npm ci

log "Building"
# ---------------------------------------------------------------------
# Build beside the live site, not on top of it.
#
# The running service serves apps/web/.next. Building straight into it
# used to mean several minutes per deploy during which the site served a
# half-written build: open tabs threw "a client-side exception has
# occurred", and forms posted to server actions that no longer existed.
# So the build goes into .next-build (next.config.mjs reads
# NEXT_DIST_DIR) and is swapped into place with a rename, which takes no
# time at all. The previous build's static files are carried across so a
# tab opened before the deploy keeps finding its scripts until it
# reloads; hashed names mean nothing collides.
#
# Node sizes its heap from physical memory and ignores swap entirely, so
# on a 1 GB instance it caps at about 467 MB and the type-checker dies
# with "Ineffective mark-compacts near heap limit" — which reads like a
# bug in the code rather than a machine that is too small. The swap file
# provisioning adds is what makes a larger ceiling safe; without it this
# would trade a clean failure for the OOM killer.
# ---------------------------------------------------------------------
WEB="$APP_DIR/apps/web"
rm -rf "$WEB/.next-build"
# The compiler's cache lives inside the build directory; carrying it
# over is the difference between a two-minute build and a six-minute one.
if [[ -d "$WEB/.next/cache" ]]; then
  mkdir -p "$WEB/.next-build"
  cp -r "$WEB/.next/cache" "$WEB/.next-build/cache"
fi
NEXT_DIST_DIR=.next-build NODE_OPTIONS="--max-old-space-size=1536" npm run build

log "Swapping the build in"
if [[ -d "$WEB/.next/static" ]]; then
  cp -rn "$WEB/.next/static/." "$WEB/.next-build/static/" 2>/dev/null || true
fi
rm -rf "$WEB/.next-previous"
[[ -d "$WEB/.next" ]] && mv "$WEB/.next" "$WEB/.next-previous"
mv "$WEB/.next-build" "$WEB/.next"

log "Restarting"
sudo systemctl restart soulfables

# Give it a moment, then prove it actually came up. A deploy that reports
# success while the service is crash-looping is worse than one that fails.
sleep 4
if ! systemctl is-active --quiet soulfables; then
  echo
  echo "The service did not start. Last 30 lines:" >&2
  journalctl -u soulfables -n 30 --no-pager >&2
  exit 1
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000/ || echo 000)
if [[ "$code" != "200" ]]; then
  echo "Service is running but the home page answered ${code}." >&2
  journalctl -u soulfables -n 30 --no-pager >&2
  exit 1
fi

log "Live — home page answered 200"