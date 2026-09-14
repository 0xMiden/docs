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
| Private note delivery | The node Compose stack with the `note-transport` profile enabled |
| Future one-command local dev | Track [node#1874](https://github.com/0xMiden/node/issues/1874) and [midenup#180](https://github.com/0xMiden/midenup/issues/180) |

Docker Compose is the supported default path for running the current local node stack. The rust-sdk repo also has a `make start-node` helper for its own integration tests, but that helper runs the test node directly with Cargo and is not the operator-facing Docker workflow.

## Prerequisites

- Docker Desktop on macOS, or Docker Engine with the Compose v2 plugin on Linux.
- Rust only if you run the Rust client integration tests or install the `miden-client` CLI locally.
- A browser that supports WebAssembly, Web Workers, and gRPC-web requests.

On Linux, make sure your user can run Docker commands without `sudo`, or prefix the Docker commands below with `sudo`.

## Start a local node

Clone the compatible node release into a directory named `miden-node`. The account export command below assumes this Compose project name, which gives the genesis volume the name `miden-node_node-data`.

```bash
git clone --branch v0.16.0 --depth 1 https://github.com/0xMiden/node.git miden-node
cd miden-node

make local-network-build
make local-network-up
```

The stack starts the sequencer, three validators, transaction prover, network transaction builder, telemetry services, and network monitor. The RPC endpoint is:

```text
http://localhost:57291
```

Check the containers:

```bash
docker compose --profile telemetry --profile monitor ps
```

Follow node logs:

```bash
make local-network-logs
```

Stop the node without deleting chain data:

```bash
make local-network-down
```

Reset the chain to a fresh genesis:

```bash
make local-network-delete
make local-network-up
```

For the full node operator workflow, see the [local network development guide](../../../reference/node/local-network-development).

## Export the genesis account

The local genesis process writes account files into the Compose volume. Copy the faucet operator account into the repo root when you need an existing local account in a client:

```bash
docker run --rm \
  -v miden-node_node-data:/data:ro \
  -v "$PWD":/out \
  alpine:3.20 \
  cp /data/accounts/faucet_operator.mac /out/faucet_operator.mac
```

Then configure the CLI for localhost and import the account:

```bash
miden-client init --local --network localhost
miden-client import faucet_operator.mac
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

For private note delivery, enable the optional Note Transport service included in the node Compose stack:

```bash
docker compose --profile note-transport up -d
```

Then pass its browser-facing gRPC-Web URL. The Web SDK has `testnet` and `devnet` shorthands for note transport, but no `localhost` shorthand.

```typescript
const client = await MidenClient.create({
  rpcUrl: "localhost",
  proverUrl: "local",
  noteTransportUrl: "http://ntl.localhost",
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
        noteTransportUrl: "http://ntl.localhost",
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
git clone --branch v0.16.0 --depth 1 https://github.com/0xMiden/rust-sdk.git miden-rust-sdk
cd miden-rust-sdk

TEST_MIDEN_NETWORK=localhost \
  cargo run --package miden-client-integration-tests --release --locked -- \
  --contains client_builder \
  --jobs 1
```

For broader local runs, use the same `TEST_MIDEN_NETWORK=localhost` environment variable with the repo test targets. Set `TEST_MIDEN_RPC_URL`, `TEST_MIDEN_PROVER_URL`, or `TEST_MIDEN_NOTE_TRANSPORT_URL` only when you need to override one component.

## Browser and proxy notes

- The node RPC server enables gRPC-web and CORS, so browser clients can call `http://localhost:57291` directly.
- Do not proxy RPC as JSON. If your dev server or reverse proxy sits between the app and node, preserve gRPC-web requests and response headers.
- When switching between testnet, devnet, and localhost, use a different `storeName` or clear the browser IndexedDB database used by the SDK.

## Debug local failures

Start with the local logs:

```bash
make local-network-logs
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
