---
title: Local node testing
description: "Run a local Miden node and point Rust, Web SDK, and React SDK clients at it for application testing."
sidebar_position: 2
---

# Local node testing

Use a local node when a test needs real node state: public accounts, block commits, transaction submission, network notes, or RPC error details. For unit tests and most CI, use the Web SDK mock client instead; it is faster and does not need a node.

## Supported paths

| Need | Use |
| --- | --- |
| Browser or app testing against a local network | The node repo Docker Compose stack |
| Rust client integration tests | `TEST_MIDEN_NETWORK=localhost` against a running local node |
| Private note delivery | A separate Miden Note Transport node |
| Future one-command local dev | Track [node#1874](https://github.com/0xMiden/node/issues/1874) and [midenup#180](https://github.com/0xMiden/midenup/issues/180) |

Docker Compose is the supported default path for running the current local node stack. The miden-client repo also has a `make start-node` helper for its own integration tests, but that helper runs the test node directly with Cargo and is not the operator-facing Docker workflow.

## Prerequisites

- Docker Desktop on macOS, or Docker Engine with the Compose v2 plugin on Linux.
- Rust only if you run the Rust client integration tests or install the `miden-client` CLI locally.
- A browser that supports WebAssembly, Web Workers, and gRPC-web requests.

On Linux, make sure your user can run Docker commands without `sudo`, or prefix the Docker commands below with `sudo`.

## Start a local node

Clone the node repo into a directory named `miden-node`. The account export command below assumes this Compose project name, which gives the genesis volume the name `miden-node_node-data`.

```bash
git clone https://github.com/0xMiden/node.git miden-node
cd miden-node

make docker-build-node
make docker-build-monitor
make compose-genesis
make compose-up
```

The stack starts the store, validator, block producer, RPC component, network transaction builder, telemetry, and network monitor. The RPC endpoint is:

```text
http://localhost:57291
```

Check the containers:

```bash
docker compose -f docker-compose.yml -f compose/telemetry.yml -f compose/monitor.yml ps
```

Follow node logs:

```bash
make compose-logs
```

Stop the node without deleting chain data:

```bash
make compose-down
```

Reset the chain to a fresh genesis:

```bash
make compose-genesis
make compose-up
```

For the full node operator workflow, see the [node usage guide](../../../core-concepts/node/operator/usage.md#using-docker-compose).

## Export the genesis account

The local genesis process writes account files into the Compose volume. Copy the default genesis account into the repo root when you need to import it into a client:

```bash
docker run --rm \
  -v miden-node_node-data:/data:ro \
  -v "$PWD":/out \
  alpine:3.20 \
  cp /data/accounts/account.mac /out/account.mac
```

Then configure the CLI for localhost and import the account:

```bash
miden-client init --local --network localhost
miden-client import account.mac
miden-client sync
miden-client account --list
```

If you created a custom genesis config with more wallets or faucets, import each generated `.mac` file that your test needs.

## Web SDK configuration

`rpcUrl: "localhost"` resolves to `http://localhost:57291`. Pass `proverUrl: "local"` to prove inside the browser or Node process, and set a dedicated `storeName` so localhost state does not mix with testnet state in IndexedDB.

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.create({
  rpcUrl: "localhost",
  proverUrl: "local",
  autoSync: false,
  storeName: "miden-local-dev",
});

await client.sync();
```

For private note delivery, run a Miden Note Transport node separately and pass its raw URL. The Web SDK has `testnet` and `devnet` shorthands for note transport, but no `localhost` shorthand.

```typescript
const client = await MidenClient.create({
  rpcUrl: "localhost",
  proverUrl: "local",
  noteTransportUrl: "http://localhost:57292",
  autoSync: false,
  storeName: "miden-local-dev",
});
```

## React SDK configuration

Use the same endpoints through `MidenProvider`:

```tsx
import { MidenProvider } from "@miden-sdk/react";
import type { ReactNode } from "react";

export function LocalMidenApp({ children }: { children: ReactNode }) {
  return (
    <MidenProvider
      config={{
        rpcUrl: "localhost",
        prover: "local",
        noteTransportUrl: "http://localhost:57292",
        autoSyncInterval: 15_000,
      }}
    >
      {children}
    </MidenProvider>
  );
}
```

If the frontend itself runs inside Docker, `localhost` is the frontend container. Use `http://host.docker.internal:57291` on Docker Desktop, or put the frontend and node RPC service on the same Compose network and use the service name.

## Rust client smoke test

The miden-client integration test binary uses the same local network preset:

```bash
git clone https://github.com/0xMiden/miden-client.git
cd miden-client

TEST_MIDEN_NETWORK=localhost \
  cargo run --package miden-client-integration-tests --release --locked -- \
  --contains client_builder \
  --jobs 1
```

For broader local runs, use the same `TEST_MIDEN_NETWORK=localhost` environment variable with the repo test targets. Set `TEST_MIDEN_RPC_URL`, `TEST_MIDEN_PROVER_URL`, or `TEST_MIDEN_NOTE_TRANSPORT_URL` only when you need to override one component.

## Browser and proxy notes

- The node RPC server enables gRPC-web and CORS, so browser clients can call `http://localhost:57291` directly.
- Do not proxy RPC as JSON. If your dev server or reverse proxy sits between the app and node, preserve gRPC-web requests and response headers.
- Private note transport is not part of the node Compose stack. Run the note transport service separately or import private notes out of band.
- When switching between testnet, devnet, and localhost, use a different `storeName` or clear the browser IndexedDB database used by the SDK.

## Debug local failures

Start with the local logs:

```bash
make compose-logs
```

Then sync the client and inspect local transaction state:

```bash
miden-client sync
miden-client tx --list
```

For network notes, query the node for the note processing status:

```bash
miden-client network-note-status <NOTE_ID>
```

The status output includes the processing state, attempt count, latest error, and last attempt block when the node has those details.
