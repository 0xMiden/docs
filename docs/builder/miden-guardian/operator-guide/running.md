---
title: Running
sidebar_position: 1
---

# Running Miden Guardian

Miden Guardian exposes:

- HTTP API on port `3000`
- gRPC API on port `50051`

Both ports are hard-coded in the server binary and are not currently overridable via environment variable. Embedders calling the builder API directly can configure them in code.

## Get the code

The Guardian server, client SDKs, multisig client libraries, and specification live in the [OpenZeppelin Guardian repository](https://github.com/OpenZeppelin/guardian).

Clone the repository and run the commands on this page from its root:

```bash
git clone https://github.com/OpenZeppelin/guardian.git
cd guardian
```

## Run with Docker Compose

```bash
docker compose up --build -d
```

Confirm the server is up by fetching its public key:

```bash
curl http://localhost:3000/pubkey
```

Expected shape:

```json
{ "commitment": "0x..." }
```

`/pubkey` is unauthenticated and is the canonical "is the server up + which key am I trusting" probe. Pass `?scheme=ecdsa` to also receive the ECDSA public key:

```bash
curl 'http://localhost:3000/pubkey?scheme=ecdsa'
```

```json
{ "commitment": "0x...", "pubkey": "0x..." }
```

Stop the server:

```bash
docker compose down
```

## Run from source

Requirements:

- Rust `1.93+`
- Docker, if using local Postgres

Filesystem storage is the default local mode. The three paths are independent — there is no single root-path override:

```bash
mkdir -p /tmp/guardian/storage /tmp/guardian/metadata /tmp/guardian/keystore

GUARDIAN_STORAGE_PATH=/tmp/guardian/storage \
GUARDIAN_METADATA_PATH=/tmp/guardian/metadata \
GUARDIAN_KEYSTORE_PATH=/tmp/guardian/keystore \
cargo run -p guardian-server --bin server
```

If those env vars are omitted, the server falls back to `/var/guardian/storage`, `/var/guardian/metadata`, and `/var/guardian/keystore` respectively.

Run with local Postgres (requires the `postgres` feature):

```bash
docker compose -f docker-compose.postgres.yml up -d

DATABASE_URL=postgres://guardian:guardian_dev_password@localhost:5432/guardian \
cargo run -p guardian-server --features postgres --bin server
```

## HTTP API surface

| Endpoint                      | Auth              |
| ----------------------------- | ----------------- |
| `GET /`                       | Unauthenticated   |
| `GET /pubkey`                 | Unauthenticated   |
| `POST /configure`             | Signed headers    |
| `POST /delta`                 | Signed headers    |
| `GET /delta`                  | Signed headers    |
| `GET /delta/since`            | Signed headers    |
| `GET /state`                  | Signed headers    |
| `POST /delta/proposal`        | Signed headers    |
| `GET /delta/proposal`         | Signed headers    |
| `GET /delta/proposal/single`  | Signed headers    |
| `PUT /delta/proposal`         | Signed headers    |
| `/dashboard/accounts*`        | Dashboard session |

Signed requests carry three headers: `x-pubkey`, `x-signature`, and `x-timestamp`. Timestamps must be within ±5 minutes of server time and strictly greater than the last value the server saw for that public key — see [Authentication failures](./troubleshooting#authentication-failures) if requests are being rejected.
