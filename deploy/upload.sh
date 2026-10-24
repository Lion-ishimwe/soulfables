#!/usr/bin/env bash
#
# Send the code to the instance, for when there is no git remote to pull
# from. Run from YOUR machine, in the repository root:
#
#   HOST=13.51.x.x KEY=~/.ssh/soulfables.pem bash deploy/upload.sh
#
# Streams a tar over SSH rather than using rsync, which Git Bash on
# Windows does not ship. Nothing is written to disk on the way.
#
# Once you have a GitHub remote, stop using this: deploy.sh pulls on its
# own, and then the server can be rebuilt from nothing without your
# laptop being involved.

set -euo pipefail

HOST=${HOST:-}
USER_NAME=${SSH_USER:-ubuntu}
KEY=${KEY:-}
APP_DIR=${APP_DIR:-/srv/soulfables}

[[ -n $HOST ]] || { echo "Set HOST to the instance's public IP." >&2; exit 1; }
[[ -f package.json ]] || { echo "Run this from the repository root." >&2; exit 1; }

SSH=(ssh); [[ -n $KEY ]] && SSH=(ssh -i "$KEY")

echo "==> Sending the repository to ${USER_NAME}@${HOST}:${APP_DIR}"

# --exclude the things that must not travel:
#   .env.local        secrets — they go to Parameter Store, never over scp
#   node_modules      rebuilt on the server for its own platform; native
#                     binaries compiled on Windows do not run on Linux
#   .next             a Windows build artefact, likewise
#   .git              not needed, and large
#   apps/mobile       the phone app: built by Expo's cloud, never by this server
# The archive is written to a file first, so its size is known and the
# transfer can be tried again if the Session Manager tunnel drops: a
# stream that breaks half-way leaves the server with the old files and
# no way to tell. Every node_modules is left out, at any depth: the
# app's alone is well over a hundred megabytes and belongs to Expo.
ARCHIVE=$(mktemp -t soulfables-upload.XXXXXX)
trap 'rm -f "$ARCHIVE"' EXIT
tar -czf "$ARCHIVE" \
  --exclude='node_modules' \
  --exclude='./apps/web/.next' \
  --exclude='./.next' \
  --exclude='./.git' \
  --exclude='./.env.local' \
  --exclude='./.env' \
  --exclude='./apps/mobile' \
  --exclude='*.pem' \
  .
SIZE=$(wc -c < "$ARCHIVE" | tr -d ' ')
echo "    archive: $((SIZE / 1024)) KB"

REMOTE_TMP="/tmp/soulfables-upload.tgz"
sent=0
for attempt in 1 2 3 4; do
  if "${SSH[@]}" "${USER_NAME}@${HOST}" "cat > '${REMOTE_TMP}'" < "$ARCHIVE" \
     && [[ "$("${SSH[@]}" "${USER_NAME}@${HOST}" "wc -c < '${REMOTE_TMP}'" | tr -d ' \r')" == "$SIZE" ]]; then
    sent=1
    echo "    transferred on attempt $attempt"
    break
  fi
  echo "    transfer broke on attempt $attempt; trying again" >&2
  sleep 5
done
[[ $sent == 1 ]] || { echo "Upload failed four times; nothing was changed on the server." >&2; exit 1; }

"${SSH[@]}" "${USER_NAME}@${HOST}" \
    "set -e
     sudo mkdir -p '${APP_DIR}'
     sudo tar -xzf '${REMOTE_TMP}' -C '${APP_DIR}'
     rm -f '${REMOTE_TMP}'
     # The service account does not exist yet on a first upload — it is
     # created by provision.sh, which is itself one of the files being
     # uploaded. So hand ownership over only once there is somebody to
     # hand it to; on the first run provision.sh does that chown.
     if id -u soulfables >/dev/null 2>&1; then
       sudo chown -R soulfables:soulfables '${APP_DIR}'
       echo '    unpacked, owned by soulfables'
     else
       echo '    unpacked (service account not created yet - run provision.sh next)'
     fi"

echo "==> Sent. Now deploy on the instance:"
echo "    ${SSH[*]} ${USER_NAME}@${HOST}"
echo "    sudo -u soulfables bash ${APP_DIR}/deploy/deploy.sh"