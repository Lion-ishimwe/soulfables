#!/usr/bin/env bash
#
# One-time setup of a fresh Ubuntu EC2 instance for Soulfables.
#
# Run once, as a user with sudo, on the instance itself:
#
#   sudo bash deploy/provision.sh
#
# Installs Node 20, nginx and the AWS CLI, makes a service account that
# owns the application, and puts the systemd unit and reverse proxy in
# place. It does NOT fetch secrets or build anything — that is deploy.sh,
# which you can run as often as you like. This script you run once.
#
# Safe to re-run: every step checks before it acts.

set -euo pipefail

APP_USER=soulfables
APP_DIR=/srv/soulfables
REPO="${REPO:-}"          # optional: git URL to clone on first run
NODE_MAJOR=20

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash deploy/provision.sh" >&2
  exit 1
fi

# ---------------------------------------------------------------------
# Swap.
#
# Next's build is the most memory-hungry thing this box will ever do, and
# on a 1 GB t3.micro it is killed by the OOM reaper part way through —
# which looks like a mysterious "Killed" with no error, not like running
# out of memory. Two gigabytes of swap makes a t3.micro build reliably,
# slowly. On an instance with real memory this is skipped.
# ---------------------------------------------------------------------
if [[ ! -f /swapfile ]] && [[ $(free -m | awk '/^Mem:/{print $2}') -lt 2048 ]]; then
  log "Adding 2G swap (small instance, Next's build needs the headroom)"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Updating packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git nginx unzip

# ---------------------------------------------------------------------
# Node 20, from NodeSource.
#
# Two reasons not to use the distribution's packages.
#
# On older Ubuntu the nodejs package is too old for Next 15, and the
# failure arrives as a syntax error deep in a dependency rather than as
# "your Node is old".
#
# On 26.04 the opposite: nodejs is 22, new enough — but Ubuntu splits npm
# into its own package, so a box can have a perfectly good Node and no
# npm at all. That is why the test below asks for both. Installing
# Ubuntu's npm instead would work and would also pull in fontconfig,
# Wayland and a stack of desktop libraries, which is a lot of weight for
# a 1 GB server that will never draw anything.
#
# NodeSource ships node and npm together, and pins the major to the one
# CI builds with, so the machine that proves a release and the machine
# that serves it are running the same thing.
# ---------------------------------------------------------------------
if ! command -v node >/dev/null || ! command -v npm >/dev/null    || [[ $(node -v | cut -c2- | cut -d. -f1) -lt $NODE_MAJOR ]]; then
  log "Installing Node ${NODE_MAJOR}"
  mkdir -p /etc/apt/keyrings
  # --batch --yes: gpg reaches for /dev/tty to ask about overwriting an
  # existing keyring, and a script run over ssh has no terminal to ask
  # on. Without these it dies with "cannot open '/dev/tty'", which says
  # nothing at all about keys.
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --batch --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list

  # Prefer NodeSource over the distribution, permanently.
  #
  # Ubuntu 26.04 ships nodejs 22, which apt reads as NEWER than
  # NodeSource's 20 — so a plain `apt-get install nodejs` reports "already
  # the newest version", changes nothing, and leaves the box with a Node
  # and no npm. The pin also protects the next `apt upgrade`, which would
  # otherwise swap Node 20 back for the distribution's 22 and take npm
  # away again months from now, on a box nobody is watching.
  cat > /etc/apt/preferences.d/nodesource <<'PIN'
Package: nodejs
Pin: origin deb.nodesource.com
Pin-Priority: 700
PIN

  apt-get update -qq

  # Ask for the exact version rather than the name, and allow the
  # downgrade that the pin implies.
  ns_version=$(apt-cache madison nodejs | awk '/nodesource/{print $3; exit}')
  if [[ -z "$ns_version" ]]; then
    echo "NodeSource has no nodejs ${NODE_MAJOR}.x for this architecture." >&2
    exit 1
  fi
  log "NodeSource offers ${ns_version}"
  apt-get install -y -qq --allow-downgrades "nodejs=${ns_version}"
fi

# Refuse to continue without npm rather than failing later inside the
# build, where "npm: command not found" reads as a broken repository.
command -v npm >/dev/null || { echo "npm is still missing after installing Node." >&2; exit 1; }
log "Node $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------------
# AWS CLI v2, for reading secrets out of Parameter Store.
#
# Ubuntu ships v1 as "awscli"; v2 is the one AWS supports and the one
# whose ssm output shape the deploy script expects.
# ---------------------------------------------------------------------
if ! command -v aws >/dev/null; then
  log "Installing AWS CLI v2"
  tmp=$(mktemp -d)
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o "$tmp/aws.zip"
  unzip -q "$tmp/aws.zip" -d "$tmp"
  "$tmp/aws/install" --update
  rm -rf "$tmp"
fi
log "$(aws --version)"

# ---------------------------------------------------------------------
# The service account.
#
# The application does not run as root and does not run as your login
# user. It owns its own directory and nothing else, so a flaw in a
# dependency reaches the app's files and stops there.
# ---------------------------------------------------------------------
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  log "Creating service user ${APP_USER}"
  # No --create-home: by the time this runs the directory already exists
  # and holds the uploaded code, and useradd asked to create a home that
  # is already there warns rather than succeeding quietly — which under
  # `set -e` would stop provisioning on something that is not a problem.
  # The mkdir and chown below own the directory either way.
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [[ -n "$REPO" ]] && [[ ! -d "$APP_DIR/.git" ]]; then
  log "Cloning ${REPO}"
  sudo -u "$APP_USER" git clone "$REPO" "$APP_DIR"
fi

# The environment file deploy.sh writes. Created empty and locked down
# now, so it never exists world-readable even for a moment.
install -o "$APP_USER" -g "$APP_USER" -m 600 /dev/null "$APP_DIR/.env.production"

log "Installing the systemd unit"
install -m 644 "$(dirname "$0")/soulfables.service" /etc/systemd/system/soulfables.service
systemctl daemon-reload
systemctl enable soulfables >/dev/null

log "Installing the nginx site"
install -m 644 "$(dirname "$0")/nginx.conf" /etc/nginx/sites-available/soulfables
ln -sf /etc/nginx/sites-available/soulfables /etc/nginx/sites-enabled/soulfables
# Ubuntu's default site answers on port 80 and would win on a bare IP.
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ---------------------------------------------------------------------
# Firewall.
#
# The EC2 security group is the real gate and you should set it there
# too; this is the second lock. SSH is left open here because closing it
# from inside a script you are running over SSH is a way to lose an
# instance — restrict it in the security group to your own address.
# ---------------------------------------------------------------------
if command -v ufw >/dev/null; then
  log "Firewall: allowing SSH and HTTP"
  ufw allow OpenSSH >/dev/null
  ufw allow 'Nginx Full' >/dev/null
  ufw --force enable >/dev/null
fi

cat <<'DONE'

Provisioned.

Next, in order:

  1. Put the secrets in Parameter Store — from your OWN machine, not here:
         bash deploy/secrets.sh push

  2. Attach the IAM role to this instance so it may read them
     (deploy/iam-policy.json has the policy).

  3. Deploy:
         sudo -u soulfables bash /srv/soulfables/deploy/deploy.sh

DONE
