# Deploying Soulfables to EC2

**Live at http://13.53.49.185** — instance `i-02fff24055818aa9b`,
Ubuntu 26.04, t3.micro, eu-north-1.

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
That will keep happening — see **Getting in without a port** below for
the way that stops it.

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
| **String** (already public) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `EMAIL_FROM`, `PAYMENT_PROVIDER`, `PAYMENT_CLIENT_ID`, `PAYMENT_ENV` |

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

## Getting in without a port — Session Manager

The SSH rule in the security group is pinned to one IP address, and
yours changes: every time it does, you are locked out until you edit the
rule. Session Manager removes the rule altogether. The instance's SSM
agent (already installed and running on Ubuntu) makes an *outbound*
connection to AWS; you connect through that. Nothing listens on the
internet, so there is nothing to pin to an address.

Two console steps, then a laptop install.

### 1. Let the instance talk to Systems Manager

IAM → Roles → `SoulfablesInstanceRole` → **Add permissions → Attach
policies** → tick **`AmazonSSMManagedInstanceCore`** → Add.

That is an AWS-managed policy: the agent's registration, heartbeat and
session channel, and nothing about the parameters — those stay covered by
`SoulfablesReadSettings`. Within a few minutes the instance appears under
**Systems Manager → Fleet Manager**, and **EC2 → Instance → Connect →
Session Manager** opens a shell in the browser. That alone ends the
lockouts: a browser shell needs no key, no port and no IP rule.

### 2. Let *you* open sessions from this machine

Deploys send the code from your laptop over SSH, so the laptop needs to
open sessions too. That means an IAM user with an access key — the one
thing on this page that is a credential, so it gets its own narrow
policy:

IAM → Policies → Create policy → JSON → paste
[`deploy/iam-session-policy.json`](../deploy/iam-session-policy.json) →
name it `SoulfablesOpenSession`. Then IAM → Users → Create user →
`soulfables-deployer` → attach `SoulfablesOpenSession` directly → create.
Open the user → **Security credentials → Create access key → Command
Line Interface** → keep the two values for the next step.

The policy lets that user start a session on this one instance, and end
its own sessions, and nothing else. It cannot read the parameters,
change the instance, or see any other resource.

### 3. On your machine

```bash
winget install -e --id Amazon.AWSCLI
winget install -e --id Amazon.SessionManagerPlugin
```

Open a new terminal so both are on the path, then:

```bash
aws configure
```

It asks for the access key id, the secret, a region (`eu-north-1`) and an
output format (`json`). Type the key values yourself — they belong in
`~/.aws/credentials`, which this command writes, and nowhere else.

`~/.ssh/config` already has a `soulfables` host that goes through Session
Manager instead of a public port. From then on:

```bash
ssh soulfables
HOST=soulfables bash deploy/upload.sh
```

Same key, same user, same scripts. Only the road is different.

### 4. Close the port

Once `ssh soulfables` works: EC2 → Security Groups → the instance's
group → **Inbound rules → Edit → delete the SSH (22) rule**. Nothing now
needs it, and the address it was pinned to is out of date anyway.

---

## Reading stories aloud — Amazon Polly

Every published story has a narration by default. A story is read by a
generated voice when it is published and again when its words change;
and the server, about thirty seconds after it starts and every six hours
after that, reads any published story that still has none (the ones
from before the voice existed, or whose reading failed). A story's admin
page can also ask for a reading (**Narration → Read it aloud**), and
Settings → The House can read all the missing ones at once or switch the
whole behaviour off. The voice is Amazon Polly, chosen because the House
already lives on AWS: no new secret, just a permission on the instance
role. The player tells readers a synthetic voice is reading.

1. IAM → Policies → `SoulfablesReadSettings` → **Edit** → JSON → replace
   with [`deploy/iam-policy.json`](../deploy/iam-policy.json) (it now
   carries `polly:SynthesizeSpeech`) → Save. Nothing else changes; the
   instance picks the permission up within a minute.
2. Optional settings in Parameter Store: `TTS_VOICE` (default `Amy`,
   British; `Brian`, `Joanna`, `Matthew` also offered) and `TTS_REGION`
   (default `eu-west-1`, where the neural voices are).

A long story is about ten cents. The file goes in the private
`protected-media` bucket and the player fetches it through a short-lived
signed address, so it cannot be hot-linked. A person's recording can be
uploaded from the same panel instead, and replaces the generated one.

---

## Taking money — PayPal

The shop takes payment through PayPal, on the business's PayPal account
in Europe. Five settings, all in Parameter Store under
`/soulfables/production/`:

| Name | Value | Kind |
|---|---|---|
| `PAYMENT_PROVIDER` | `paypal` | String |
| `PAYMENT_ENV` | `sandbox` while testing, `live` when real | String |
| `PAYMENT_CLIENT_ID` | the app's **Client ID** | String |
| `PAYMENT_API_KEY` | the app's **Secret** | SecureString |
| `PAYMENT_WEBHOOK_SECRET` | the webhook's **ID** (not a secret; PayPal verifies signatures itself) | SecureString |

### 1. Practice first, with the sandbox

1. [developer.paypal.com](https://developer.paypal.com) → **Apps & Credentials** → keep the **Sandbox** toggle on → **Create App**. Name it `Soulfables`. Copy the Client ID and Secret.
2. On the same page, **Sandbox accounts**: PayPal made a *business* account (the seller) and a *personal* one (a buyer with pretend money). Note the buyer's email and password — you will pay with it.
3. **Webhooks** → Add webhook → URL `https://YOUR-DOMAIN/api/webhooks/payment` → events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`. Copy the **Webhook ID**.
4. Put the five values in Parameter Store, `PAYMENT_ENV=sandbox`, and deploy.
5. Buy something with the sandbox buyer. The order should show as paid on the thank-you page and the book should appear in the library.

> **Webhooks need HTTPS.** PayPal will not send to a plain `http://` address, so on the bare IP the webhook is silent. The shop still works: the buyer's return captures the payment server-side and settles the order without a webhook. What the webhook adds is the buyer who approved the payment and then closed the tab — with a domain and a certificate (see *Adding the domain later*), that case is covered too.

### 2. Then live

Switch the dashboard toggle to **Live**, create the app and the webhook again — live credentials are separate — replace the three values, set `PAYMENT_ENV=live`, deploy. Settings → The House shows which counter is open and whether real money moves.

### What the code does

`lib/payments/paypal.ts` is the whole of it. Checkout creates a PayPal order and sends the buyer to approve it; PayPal returns them to `/api/payments/paypal/return`, which captures the payment and settles the order on PayPal's answer; the webhook does the same for anyone who never came back. Nothing the browser carries is trusted for anything but finding the order. Amounts come from the database on every step.

---

## When something is wrong

| Symptom | Cause |
|---|---|
| `deploy.sh` says it cannot read Parameter Store | The IAM role is not attached. EC2 → Instance → Actions → Security → Modify IAM role. |
| Build dies with `Killed` and no error | Out of memory. `free -h` — the swap file should be there; if not, re-run `provision.sh`. |
| Site loads but the admin says "no database connection" | It was built before the settings existed. Re-run `deploy.sh`. |
| Sign-in sends you to `localhost` | `NEXT_PUBLIC_SITE_URL` is wrong. Push the right one and **rebuild** — it is baked in, so a restart will not do it. |
| `502 Bad Gateway` | Node is not up. `journalctl -u soulfables -n 50`. |
| A PayPal buyer sees "The payment page could not be opened" | The Client ID or Secret is wrong, or `PAYMENT_ENV` does not match the credentials (sandbox keys against live, or the reverse). `journalctl -u soulfables` shows PayPal's answer. |
| "The server is not allowed to speak yet" when reading a story aloud | The instance role lacks `polly:SynthesizeSpeech`. Update `SoulfablesReadSettings` from `deploy/iam-policy.json`. |
| Paid on PayPal but the thank-you page keeps waiting | The return route could not capture. Check the log for `[paypal] capture on return failed`. The webhook, once HTTPS exists, catches these. |
| The instance never shows in Fleet Manager | The agent retries every half hour. Hurry it: `sudo snap restart amazon-ssm-agent`, then `sudo journalctl -u snap.amazon-ssm-agent.amazon-ssm-agent -n 20`. A `400` there means the role still lacks `AmazonSSMManagedInstanceCore`. |
| `ssh soulfables` says `TargetNotConnected` | Same thing from the other side — the agent is not registered yet. |
| `ssh soulfables` says `aws: command not found` | The CLI is not on the path of the shell that ssh spawns. Open a new terminal; on Git Bash check `which aws`. |

---

## What this deployment does not do yet

Stated plainly, because each is a decision rather than an oversight:

- **No HTTPS until the domain is pointed here.** A certificate authority
  will not issue for a bare IP, so sign-in cookies and passwords cross
  the network in the clear. Acceptable for a private preview and **not**
  acceptable once real readers have accounts. The cure is the domain,
  below; everything on the server is ready for it.
- **One instance, no redundancy.** If it stops, the site is down.
- **No automated deploys.** Every release is the two commands above.
- **SSH on a public port, pinned to one address** — until the Session
  Manager steps above are done, after which the port is closed.
- **No backups configured here.** The data lives in Supabase, which has
  its own; nothing on this box is precious.
- **No monitoring or alerting.**

## Putting the House on soulfables.co, over HTTPS

The domain is registered at GoDaddy. The server is already prepared:
certbot is installed, and the nginx site names `soulfables.co` and
`www.soulfables.co` while still answering on the bare IP. Four steps
remain, in this order — a certificate cannot be issued before the name
resolves here.

**1. Point the domain at the Elastic IP (GoDaddy).**

[GoDaddy → DNS management](https://dcc.godaddy.com/control/dnsmanagement?domainName=soulfables.co)
for `soulfables.co`. Delete the existing `A` record for `@` (a new domain
carries one pointing at GoDaddy's parking page) and any parking `CNAME`
for `www`, then add:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | `13.53.49.185` | 600 |
| A | `www` | `13.53.49.185` | 600 |

Two `A` records rather than a `CNAME` for `www`, because both names go on
the same certificate and an `A` record is the plainer thing to reason
about. Leave `MX` and `TXT` records alone if email runs through them.
Propagation is usually minutes:

```bash
nslookup soulfables.co 8.8.8.8
```

**2. Open port 443 (AWS console).**

EC2 → Security Groups → `sg-07deb8ccd608541b7` (`launch-wizard-1`) →
**Edit inbound rules** → **Add rule** → Type **HTTPS**, Source
**Anywhere-IPv4** (`0.0.0.0/0`), description `HTTPS`. Save.

Port 80 stays open: it carries the certificate challenge and, afterwards,
the redirect to HTTPS. The deploy user's IAM policy deliberately cannot
edit security groups, so this one is done by hand.

**3. Ask for the certificate.**

```bash
sudo certbot --nginx -d soulfables.co -d www.soulfables.co --redirect
```

Certbot asks for an address for expiry warnings and for agreement to the
Let's Encrypt subscriber terms, proves the domain over port 80, then
edits `/etc/nginx/sites-available/soulfables` in place: a 443 listener,
the certificate paths, and a permanent redirect from port 80. It installs
a timer that renews twice a day, so there is nothing to diarise.
`deploy.sh` never touches nginx, so those edits survive every deployment.

**4. Tell the House its own address.**

Canonical URLs, the sitemap, share images, sign-in links and payment
returns all come from `NEXT_PUBLIC_SITE_URL`, which is compiled into the
build. From the repository root on your machine:

```bash
SITE_URL=https://soulfables.co bash deploy/secrets.sh push
HOST=soulfables bash deploy/upload.sh
ssh soulfables 'sudo -u soulfables bash /srv/soulfables/deploy/deploy.sh'
```

Then, outside this repository:

- **Supabase → Authentication → URL Configuration**: set the Site URL to
  `https://soulfables.co` and add `https://soulfables.co/**` to the
  redirect allow-list, or sign-in links will keep pointing at the IP.
- **PayPal → Webhooks**: the webhook URL can now be
  `https://soulfables.co/api/webhooks/payment`. PayPal refuses plain
  HTTP, which is why it was silent until now.
- **Email (Resend)**: verify `soulfables.co` as a sending domain, so
  `hello@soulfables.co` is not filtered as a forgery.
