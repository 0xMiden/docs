---
title: Local node testing
description: "Run a v0.14 local Miden node and point Rust, Web SDK, and React SDK clients at it for application testing."
sidebar_position: 2
---

# Local node testing

Use a local node when a test needs real node state: public accounts, block commits, transaction submission, network notes, or RPC error details. For unit tests and most CI, use the Web SDK mock client instead; it is faster and does not need a node.

## Supported paths in v0.14

| Need | Use |
| --- | --- |
| Browser or app testing against a local network | `miden-node bundled bootstrap` and `miden-node bundled start` |
| Rust client integration tests | `TEST_MIDEN_NETWORK=localhost` against a running local node |
| Private note delivery | A separate Miden Note Transport node |
| Future one-command local dev | Track [node#1874](https://github.com/0xMiden/node/issues/1874) and [midenup#180](https://github.com/0xMiden/midenup/issues/180) |

Docker Compose is not the v0.14 default local-node path in the versioned node docs. The supported v0.14 workflow is the bundled node command shown below. Current unreleased docs use the newer node repo Docker Compose stack.

## Prerequisites

- A Rust toolchain recent enough for the selected `miden-node` v0.14 release.
- macOS: Xcode Command Line Tools.
- Linux: a C/C++ toolchain plus `llvm`, `clang`, `bindgen`, `pkg-config`, OpenSSL headers, and SQLite headers.
- A browser that supports WebAssembly, Web Workers, and gRPC-web requests.

On macOS, install the Command Line Tools with:

```bash
xcode-select --install
```

On Ubuntu or Debian, install the common native dependencies with:

```bash
sudo apt install llvm clang bindgen pkg-config libssl-dev libsqlite3-dev
```

## Start a local node

Install a v0.14 node binary:

```bash
cargo install miden-node --locked --version ^0.14
```

Create a fresh data directory and bootstrap genesis:

```bash
mkdir -p miden-local/data miden-local/accounts
cd miden-local

miden-node bundled bootstrap \
  --data-directory data \
  --accounts-directory accounts
```

Start the node:

```bash
miden-node bundled start \
  --data-directory data \
  --rpc.url http://0.0.0.0:57291
```

The RPC endpoint is:

```text
http://localhost:57291
```

To reset the chain, stop the node and remove the generated data:

```bash
rm -rf data accounts
```

Then run the bootstrap and start commands again. For the full node operator workflow, see the [v0.14 node usage guide](../../../core-concepts/node/operator/usage.md#operation).

## Import a local account

The bootstrap command writes genesis account files into `accounts/`. Import the account file your test needs:

```bash
miden-client init --local --network localhost
miden-client import accounts/account.mac
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

- The v0.14 node RPC server enables gRPC-web and CORS, so browser clients can call `http://localhost:57291` directly.
- Do not proxy RPC as JSON. If your dev server or reverse proxy sits between the app and node, preserve gRPC-web requests and response headers.
- Private note transport is not part of the node process. Run the note transport service separately or import private notes out of band.
- When switching between testnet, devnet, and localhost, use a different `storeName` or clear the browser IndexedDB database used by the SDK.

## Debug local failures

Start with the node terminal logs. For more detail, restart the node with `RUST_LOG=debug`:

```bash
RUST_LOG=debug miden-node bundled start \
  --data-directory data \
  --rpc.url http://0.0.0.0:57291
```

Then sync the client and inspect local transaction state:

```bash
miden-client sync
miden-client tx --list
```

In v0.14, network-note diagnostics are still limited compared with the current unreleased status endpoint. Use the node logs plus the note ID and transaction ID when debugging a note that remains committed but is not consumed.
