# Deploying Soulfables to EC2

Target: a single Ubuntu instance in `eu-north-1` (Stockholm), serving on
its public IP over HTTP. The database stays where it is — Supabase is
hosted, so nothing about the data moves and no database runs on this box.

There are two machines in what follows. **Your machine** holds the code
and the secrets. **The instance** runs the site and is never given a
secret directly — it reads them from AWS Parameter Store using an IAM
role, so nothing sensitive is typed into a terminal you might screenshot
or left in a file that gets copied.

---

## What you are building

```
        your machine                      AWS eu-north-1
   ┌────────────────────┐         ┌──────────────────────────────┐
   │  code              │ ──1──▶  │  EC2 · Ubuntu 24.04          │
   │  .env.local        │         │    nginx :80                 │
   └─────────┬──────────┘         │      └── next :3000 (local)  │
             │                    └──────────────┬───────────────┘
             │                                   │ reads at deploy
             └────────2────────▶  Parameter Store ┘
                                  /soulfables/production/*
                                                  │
                                                  ▼
                                          Supabase (unchanged)
```

1. `deploy/upload.sh` — the code
2. `deploy/secrets.sh` — the settings, encrypted

---

## Step 1 — An IAM role the instance can wear

The instance needs permission to read its own settings and nothing else.

1. **IAM → Policies → Create policy → JSON**
2. Paste the contents of [`deploy/iam-policy.json`](../deploy/iam-policy.json).
3. Name it `SoulfablesReadSettings`, create.
4. **IAM → Roles → Create role → AWS service → EC2 → Next**
5. Tick `SoulfablesReadSettings`, name the role `SoulfablesInstanceRole`, create.

The policy is scoped to `/soulfables/production/*`. An instance holding it
can read this deployment's settings, cannot write them, cannot read
another environment's, and can use the KMS key only to decrypt a
parameter on its way out of SSM.

---

## Step 2 — Launch the instance

**EC2 → Instances → Launch instances**, region **eu-north-1**.

| Field | Value | Why |
|---|---|---|
| Name | `soulfables` | |
| AMI | **Ubuntu Server 24.04 LTS** | The provisioning script is `apt`-based. |
| Instance type | **t3.small** (or `t3.micro`) | Next's build is the heaviest thing this box does. `t3.micro` has 1 GB and needs the swap file the script adds; `t3.small` builds comfortably. |
| Key pair | **Create new** → RSA → `.pem` | Downloads once. Keep it; it cannot be re-downloaded. |
| Storage | **20 GiB gp3** | The 8 GiB default fills up: `node_modules` and two builds is most of it. |

**Network settings → Edit → Create security group:**

| Type | Port | Source | |
|---|---|---|---|
| SSH | 22 | **My IP** | Not `0.0.0.0/0`. An open SSH port is found by scanners within minutes. |
| HTTP | 80 | Anywhere `0.0.0.0/0` | |

Leave HTTPS closed for now — nothing is listening on 443 until there is a
domain and a certificate.

**Advanced details → IAM instance profile → `SoulfablesInstanceRole`.**

Launch.

### Then: an Elastic IP

**EC2 → Elastic IPs → Allocate → Associate** with the instance.

Do this before deploying, not after. A default public IP is released when
the instance stops, and `NEXT_PUBLIC_SITE_URL` is compiled into the
JavaScript at build time — so a changed address means a rebuild, not a
restart, and until you do it sign-in redirects send people to an address
that is now somebody else's server.

---

## Step 3 — Get in

```bash
chmod 400 ~/Downloads/soulfables.pem
ssh -i ~/Downloads/soulfables.pem ubuntu@YOUR-ELASTIC-IP
```

If it hangs, the security group's SSH rule is not your current address.

---

## Step 4 — Send the code

There is no git remote on this repository yet, so the code goes up from
your machine. **From the repository root, on your machine:**

```bash
HOST=YOUR-ELASTIC-IP KEY=~/Downloads/soulfables.pem bash deploy/upload.sh
```

This deliberately does not send `.env.local`, `node_modules` or `.next` —
the secrets go a different way, and the other two contain Windows binaries
that would not run on Linux.

> **Worth doing soon:** push this repository to GitHub (private is fine).
> Then `deploy.sh` pulls on its own, the instance can be rebuilt from
> nothing without your laptop, and the CI workflow already in
> `.github/workflows/ci.yml` starts running. Until then every deploy needs
> your machine.

---

## Step 5 — Provision, once

**On the instance:**

```bash
sudo bash /srv/soulfables/deploy/provision.sh
```

Installs Node 20, nginx and the AWS CLI, adds swap if the instance is
small, creates the `soulfables` service account, and installs the systemd
unit and the reverse proxy. Safe to re-run.

---

## Step 6 — Put the settings in Parameter Store

**On your machine**, from the repository root. Nothing here is printed:

```bash
SITE_URL=http://YOUR-ELASTIC-IP bash deploy/secrets.sh push
bash deploy/secrets.sh check
```

`check` prints each name and how many characters its value has — enough to
tell a real key from an empty one without putting the key on screen.

What goes up, read from your `.env.local`:

| Stored as | Keys |
|---|---|
| **SecureString** (encrypted) | `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, and the payment/email keys when you have them |
| **String** (already public) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `EMAIL_FROM`, `PAYMENT_PROVIDER` |

`SUPABASE_DB_URL` is **not** sent. It is the direct database connection
and the running site never uses it — migrations are run from a developer
machine. A public web server should not hold a key to a door it never
opens.

---

## Step 7 — Deploy

**On the instance:**

```bash
sudo -u soulfables bash /srv/soulfables/deploy/deploy.sh
```

It reads the settings from Parameter Store *before* building — Next
compiles every `NEXT_PUBLIC_*` value into the bundle, so a build without
them ships a site pointing at no database and does it silently. Then it
installs, builds, restarts, and checks the home page really answers 200
before reporting success.

Open `http://YOUR-ELASTIC-IP`.

---

## Running it after that

```bash
# deploy again (after uploading new code)
sudo -u soulfables bash /srv/soulfables/deploy/deploy.sh

# what it is doing
sudo journalctl -u soulfables -f

# stop / start / restart
sudo systemctl restart soulfables

# is it up?
systemctl is-active soulfables && curl -I http://127.0.0.1:3000
```

Migrations still run from your machine, against Supabase, exactly as they
do now — they have nothing to do with this server:

```bash
node database/scripts/remote.mjs           # what is pending
node database/scripts/remote.mjs --apply   # apply it
```

---

## When something is wrong

| Symptom | Cause |
|---|---|
| `deploy.sh` says it cannot read Parameter Store | The IAM role is not attached. EC2 → Instance → Actions → Security → Modify IAM role. |
| Build dies with `Killed` and no error | Out of memory. `free -h` — the swap file should be there; if not, re-run `provision.sh`. |
| Site loads but the admin says "no database connection" | It was built before the settings existed. Re-run `deploy.sh`. |
| Sign-in sends you to `localhost` | `NEXT_PUBLIC_SITE_URL` is wrong. Push the right one and **rebuild** — it is baked in, so a restart will not do it. |
| `502 Bad Gateway` | Node is not up. `journalctl -u soulfables -n 50`. |

---

## What this deployment does not do yet

Stated plainly, because each is a decision rather than an oversight:

- **No HTTPS.** Serving on a bare IP, so there is no certificate — a
  certificate authority will not issue for an IP address. Sign-in cookies
  and passwords cross the network in the clear. This is acceptable for a
  private preview and **not** acceptable once real readers have accounts.
  The fix is a domain (below).
- **One instance, no redundancy.** If it stops, the site is down.
- **No automated deploys.** Every release is the two commands above.
- **No backups configured here.** The data lives in Supabase, which has
  its own; nothing on this box is precious.
- **No monitoring or alerting.**

### Adding the domain later

Once a domain points at the Elastic IP:

```bash
sudo sed -i 's/server_name _;/server_name soulfables.co www.soulfables.co;/' \
  /etc/nginx/sites-available/soulfables
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d soulfables.co -d www.soulfables.co
```

Certbot rewrites the nginx file in place to add TLS and the redirect from
port 80. Then open **443** in the security group, push the new
`SITE_URL=https://soulfables.co`, and deploy again so the new address is
compiled in.
