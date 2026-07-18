# QS Assets — Linux Appliance Installation Guide

The appliance is a single-node deployment of the full QS Assets stack
(PostgreSQL/PostGIS, Redis, NestJS API, Next.js web UI, Caddy TLS proxy) driven
by Docker Compose and managed by systemd. It is the recommended way to run QS
Assets on-premises on a dedicated Linux VM or server.

```
Browser ── https://<appliance>/          ┐
                                         │  Caddy (:443, TLS)
        /api/v1/*, /socket.io ── api:4100│
        everything else ──────── web:3100┘
                                    │
             postgres:5432 (internal)   redis (127.0.0.1:6379)
```

Related documents: [ONPREM-INSTALL.md](../ONPREM-INSTALL.md) (legacy/manual
options), [DEPLOY.md](../DEPLOY.md), [SECURITY.md](../SECURITY.md).

---

## Sizing

| Profile | Nodes discovered | CPU | RAM | Disk |
|---|---|---|---|---|
| Evaluation / small LAN | up to ~500 | 2 cores | 4 GB | 20 GB |
| Standard | up to ~5,000 | 4 cores | 8 GB | 50 GB |
| Enterprise | 10,000+ | 8+ cores | 16–32 GB | 100 GB NVMe (RAID-1) |

The installer warns (but does not refuse) below 4 GB RAM or 20 GB free disk.
Disk usage is dominated by the PostgreSQL volume (`qsassets_pgdata`); budget
for growth plus backups.

**Prerequisites:** a systemd-based Linux distribution (Ubuntu 22.04+, Debian
12+, RHEL 9+), Docker Engine with the `docker compose` v2 plugin, `openssl`,
and root access. Architectures: x86_64 or aarch64.

---

## Install

### 1. Get and verify the bundle

Download `qsassets-appliance-<version>.tar.gz` (and its `.sha256`) from the
GitHub release, or build one yourself with
`./scripts/release/build-appliance-bundle.sh`.

```bash
sha256sum -c qsassets-appliance-v1.0.0.tar.gz.sha256
tar -xzf qsassets-appliance-v1.0.0.tar.gz
cd qsassets-appliance-v1.0.0
./verify-bundle.sh          # verifies every file against SHA256SUMS
```

### 2. Run the installer

```bash
sudo ./qsassets-install.sh \
  --owner-email owner@yourcompany.com \
  --owner-password 'ChooseAStrongOwnerPass!' \
  --admin-password 'ChooseAStrongAdminPass!' \
  --server-ip 192.168.1.50 \
  --yes
```

All flags are optional: the server IP is autodetected and any omitted
password is generated and printed once (and stored in the env file). The
installer:

1. Checks root, Docker, architecture, RAM (≥4 GB) and disk (≥20 GB).
2. Generates `/etc/qsassets/qsassets.env` (mode 600) with `openssl rand`
   secrets — DB password, JWT secrets, vault encryption key.
3. Copies the compose file, Caddyfile and `qsassets` CLI to `/opt/qsassets`.
4. Installs and enables the `qsassets.service` systemd unit.
5. Loads bundled container images if present (offline bundle), otherwise
   builds/pulls them, then starts the stack and waits for the API health
   check.

### 3. First login

Open `https://<server-ip>/`. Accept the self-signed certificate warning (see
[TLS](#tls) below), log in with the owner or tenant-admin credentials, then
activate your NeurQ product license under **Settings → Product License**
(`DEPLOYMENT_MODE=onprem` requires a license before discovery/scans/agent
enrollment work).

---

## Day-2 operations (`qsassets` CLI)

The installer links the management CLI to `/usr/local/bin/qsassets`:

```bash
qsassets status                      # systemd + containers + API health
qsassets logs api -f                 # tail a service (api|web|postgres|redis|caddy)
sudo qsassets backup                 # pg_dump + config → /var/lib/qsassets/backups
sudo qsassets restore <backup.tar.gz>
sudo qsassets upgrade <bundle-dir | bundle.tar.gz>
sudo qsassets support-bundle         # redacted diagnostics tarball for support
sudo qsassets uninstall [--purge]
```

The stack itself is systemd-managed: `systemctl {start|stop|restart} qsassets`.

### Backups

`qsassets backup` produces a `tar.gz` containing a custom-format `pg_dump`,
the env file (secrets included — store it securely!) and the compose/Caddy
config. Schedule it with a cron entry or systemd timer, e.g.:

```
0 2 * * * /usr/local/bin/qsassets backup /var/lib/qsassets/backups
```

Losing `VAULT_ENCRYPTION_KEY` from `/etc/qsassets/qsassets.env` makes
credentials stored in the vault unrecoverable — back that file up.

---

## Upgrade

```bash
sha256sum -c qsassets-appliance-v1.1.0.tar.gz.sha256
sudo qsassets upgrade qsassets-appliance-v1.1.0.tar.gz
```

`upgrade` verifies the bundle's `SHA256SUMS` (refusing to proceed on
mismatch), takes an automatic backup, loads new images if bundled, installs
the updated compose/Caddy/systemd/CLI files, bumps `QSASSETS_VERSION` in the
env file, and restarts the stack. Database migrations run automatically when
the API container starts (`prisma migrate deploy`).

Rollback: re-run `qsassets upgrade` with the previous bundle, then
`qsassets restore` the pre-upgrade backup if a migration changed the schema.

---

## Offline / air-gapped installs

Use the **offline** bundle (`qsassets-appliance-offline-<version>.tar.gz`),
which embeds docker-saved images for the API, web UI, PostgreSQL, Redis and
Caddy under `images/`. The installer `docker load`s them automatically; no
registry access is needed. To guarantee that nothing is ever pulled,
uncomment the `pull_policy: never` lines on the `api`/`web` services in
`/opt/qsassets/docker-compose.appliance.yml`.

To build an offline bundle on a connected machine:

```bash
./scripts/release/build-appliance-bundle.sh --with-images --platform linux/amd64
```

For license activation without internet access, use an offline `.lic` file
instead of `LICENSE_SERVER_URL`.

---

## TLS

By default Caddy serves `https://<ip>` with a certificate from its **internal
self-signed CA** — encrypted out of the box, but browsers warn until you do
one of the following:

1. **Trust the appliance CA** (small teams): export the root certificate and
   distribute it via your MDM/GPO:

   ```bash
   docker cp qsassets-caddy:/data/caddy/pki/authorities/local/root.crt qsassets-root.crt
   ```

2. **Let's Encrypt** (appliance has a DNS name reachable from the internet):
   in `/etc/qsassets/qsassets.env` set
   `QSASSETS_SITE_ADDRESS=assets.example.com`, remove the `tls internal` line
   from `/opt/qsassets/Caddyfile`, update `CORS_ORIGIN`, then
   `systemctl reload qsassets`.

3. **Bring your own certificate** (enterprise CA): mount the cert and key
   into the Caddy container and replace `tls internal` with
   `tls /etc/caddy/certs/tls.crt /etc/caddy/certs/tls.key`.

---

## Networking & discovery

| Port | Direction | Purpose |
|---|---|---|
| 443/tcp+udp | inbound | Web UI + API via Caddy (HTTP/3 on UDP) |
| 80/tcp | inbound | Redirect to HTTPS |
| 4100/tcp | inbound | Direct API access for discovery agents |
| ICMP, 22, 161/162, 135/445, 5985/5986 | outbound | Agentless discovery sweeps |

L3 discovery (ping/TCP/SNMP/SSH/WMI sweeps) works with the default bridged
networking. **Layer-2 (ARP) discovery of the local segment requires the API
container to share the host network stack** — see the host-network profile
notes at the top of `/opt/qsassets/docker-compose.appliance.yml`.

Redis is bound to `127.0.0.1` only; PostgreSQL is not published to the host
at all.

---

## Uninstall

```bash
sudo qsassets uninstall            # stop + remove, KEEP data volumes and env file
sudo qsassets uninstall --purge    # also delete the database, volumes and /etc/qsassets
```

Take a `qsassets backup` first if there is any chance you'll want the data
back.

---

## Troubleshooting

- `qsassets status` — one-shot view of systemd, containers, and API health.
- `qsassets logs api -f` — the API logs migration and startup errors here.
- API stuck unhealthy on first boot: usually the database still initializing
  or a rejected weak password (`OWNER_PASSWORD`/`TENANT_ADMIN_PASSWORD` must
  be ≥12 chars; JWT/vault secrets ≥32 chars — the installer's generated
  values always satisfy this).
- `qsassets support-bundle` — collects redacted config, logs and system info
  to share with support.
