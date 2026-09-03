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
# Node sizes its heap from physical memory and ignores swap entirely, so
# on a 1 GB instance it caps at about 467 MB and the type-checker dies
# with "Ineffective mark-compacts near heap limit" — which reads like a
# bug in the code rather than a machine that is too small. The swap file
# provisioning adds is what makes a larger ceiling safe; without it this
# would trade a clean failure for the OOM killer.
NODE_OPTIONS="--max-old-space-size=1536" npm run build

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