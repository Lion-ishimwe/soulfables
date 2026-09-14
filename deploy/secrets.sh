#!/usr/bin/env bash
#
# Move the production settings into AWS Parameter Store.
#
# Run from YOUR machine, in the repository root — not on the server:
#
#   bash deploy/secrets.sh list                 # what is stored now (names only)
#   SITE_URL=http://13.51.x.x bash deploy/secrets.sh push
#   bash deploy/secrets.sh check                # confirm the server can read them
#
# Reads .env.local, which is gitignored and never leaves your machine
# except as an encrypted parameter. Values are never printed — not on
# push, not on list — because the most common way a service key escapes
# is a terminal someone screenshots.

set -euo pipefail

SSM_PATH=${SSM_PATH:-/soulfables/production}
REGION=${AWS_REGION:-eu-north-1}
ENV_FILE=${ENV_FILE:-.env.local}

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { echo "$*" >&2; exit 1; }

command -v aws >/dev/null || die "The AWS CLI is not installed. https://aws.amazon.com/cli/"

# ---------------------------------------------------------------------
# What goes up, and how it is stored.
#
# SecureString is encrypted with a KMS key and only decrypted by
# something holding the IAM permission to do it. String is plain, and is
# used only for values that are already public: the Supabase URL and anon
# key are compiled into the JavaScript every visitor downloads, so
# encrypting them would be theatre.
#
# SUPABASE_DB_URL is deliberately absent. It is the superuser connection
# to the database and the running site has no use for it — migrations are
# run from a developer's machine. Putting it on a public web server would
# be handing out a key to a door that server never needs to open.
# ---------------------------------------------------------------------
SECURE=(SUPABASE_SERVICE_ROLE_KEY AI_API_KEY EMAIL_PROVIDER_API_KEY PAYMENT_API_KEY PAYMENT_WEBHOOK_SECRET)
PLAIN=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_SITE_URL EMAIL_FROM PAYMENT_PROVIDER PAYMENT_CLIENT_ID PAYMENT_ENV AI_MODEL AI_PROVIDER)

is_secure() { local n=$1; for s in "${SECURE[@]}"; do [[ $s == "$n" ]] && return 0; done; return 1; }

read_env() {
  [[ -f $ENV_FILE ]] || die "$ENV_FILE not found. Run this from the repository root."
  local key=$1
  # Last match wins, trailing CR stripped — this file is edited on Windows.
  grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r'
}

case "${1:-}" in

  push)
    [[ -n "${SITE_URL:-}" ]] || die "Set SITE_URL first, so the app knows its own address:
    SITE_URL=http://YOUR-EC2-IP bash deploy/secrets.sh push

  It is used for redirects and for the links in emails. Getting it wrong
  sends people signing in back to localhost."

    log "Writing to ${SSM_PATH} in ${REGION}"
    pushed=0 skipped=()

    for key in "${SECURE[@]}" "${PLAIN[@]}"; do
      if [[ $key == NEXT_PUBLIC_SITE_URL ]]; then
        value=$SITE_URL
      else
        value=$(read_env "$key" || true)
      fi

      if [[ -z ${value:-} ]]; then skipped+=("$key"); continue; fi

      type=String
      is_secure "$key" && type=SecureString

      aws ssm put-parameter \
        --name "${SSM_PATH}/${key}" \
        --value "$value" \
        --type "$type" \
        --overwrite \
        --region "$REGION" >/dev/null

      printf '    %-32s %s\n' "$key" "$type"
      pushed=$((pushed + 1))
    done

    log "${pushed} stored"
    if [[ ${#skipped[@]} -gt 0 ]]; then
      echo "Not set locally, so not stored: ${skipped[*]}"
      echo "That is fine for anything you have not connected yet."
    fi
    ;;

  list)
    log "Stored under ${SSM_PATH}"
    aws ssm get-parameters-by-path --path "$SSM_PATH" --recursive \
      --region "$REGION" \
      --query 'Parameters[].[Name,Type,LastModifiedDate]' --output table
    echo "Values are not shown on purpose."
    ;;

  check)
    # Reads with decryption, prints only the length of each value. Enough
    # to tell "the key is there and looks like a key" from "the key is an
    # empty string", without putting the key on screen.
    log "Checking ${SSM_PATH}"
    aws ssm get-parameters-by-path --path "$SSM_PATH" --recursive --with-decryption \
      --region "$REGION" \
      --query 'Parameters[].[Name,Value]' --output text \
    | while IFS=$'\t' read -r name value; do
        printf '    %-46s %s characters\n' "${name##*/}" "${#value}"
      done
    ;;

  *)
    cat <<'USAGE'
Usage:
  bash deploy/secrets.sh list                          names and types, no values
  SITE_URL=http://IP bash deploy/secrets.sh push       upload from .env.local
  bash deploy/secrets.sh check                         confirm each has a value
USAGE
    exit 1
    ;;
esac