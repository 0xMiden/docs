---
title: Network
sidebar_position: 4
description: "Miden testnet endpoints — status, explorer, RPC, faucet, remote prover, and other public services."
---

# Network

Public Miden testnet services — explorer, RPC, faucet, remote prover, and status. The canonical live inventory lives at [status.testnet.miden.io](https://status.testnet.miden.io/); the page below is an editorial overview that won't go stale as new endpoints ship.

<Callout variant="info" title="Devnet">
The same services exist on devnet under the `devnet` subdomain — e.g., `status.devnet.miden.io`, `devnet.midenscan.com`. Swap `testnet` → `devnet` in any URL on this page to point at devnet instead.
</Callout>

<CardGrid cols={2}>
  <Card title="Testnet status ↗" href="https://status.testnet.miden.io/" eyebrow="Authoritative · Live">
    Dashboard showing every public Miden testnet endpoint with live health checks. Bookmark this when something looks off — it's the source of truth for "is the network up."
  </Card>
  <Card title="MidenScan (block explorer) ↗" href="https://testnet.midenscan.com" eyebrow="Explorer · Testnet">
    Search by account ID, transaction ID, note ID, or block height. The verification surface referenced throughout the tutorials.
  </Card>
</CardGrid>

## Developer endpoints

<CardGrid cols={2}>
  <Card title="RPC" eyebrow="Submit · Query">
    gRPC endpoint the node exposes for submitting proven transactions and querying account / note / block state. Clients connect here by default; see [status.testnet.miden.io](https://status.testnet.miden.io/) for the current URL.
  </Card>
  <Card title="Faucet" eyebrow="Test assets">
    Dispenses test assets (testnet MID and fungible test tokens) to the account ID you specify. Check status for the current faucet endpoint.
  </Card>
  <Card title="Remote prover" eyebrow="Delegated proving">
    Off-loads proof generation to a hosted prover when the client doesn't have the compute for client-side proving. Opt in via the client's `proverUrl` option.
  </Card>
  <Card title="Block explorer" href="https://testnet.midenscan.com" eyebrow="MidenScan">
    Same as the top-right card — included here so the developer-endpoint view is complete.
  </Card>
</CardGrid>

<Callout variant="tip" title="Canonical URLs live on the status page">
Hard-coding testnet URLs in client configs is fine for demos, but the Miden ops team moves endpoints as new nodes come online. For anything production-ish, keep your configuration loading the current URLs from [status.testnet.miden.io](https://status.testnet.miden.io/) or the client's default (which tracks the canonical testnet host).
</Callout>

## Typical flow

<Steps>

**Install the toolchain** — `midenup` pulls the client, CLI, and compiler in one step. See [Installation](../get-started/setup/installation.md).

**Point the client at testnet** — default config targets the testnet RPC, so `miden new` projects work out of the box.

**Top up with the faucet** — mint testnet assets to your account ID before attempting transactions.

**Submit + verify** — send a proven transaction via the RPC; watch the account and transaction IDs land on [MidenScan](https://testnet.midenscan.com).

**Offload proving if needed** — the remote prover URL is configurable if client-side proving isn't feasible (mobile, low-power clients).

</Steps>

## Related

<CardGrid cols={2}>
  <Card title="Deploy your first contract" docId="builder/get-started/your-first-smart-contract/deploy" eyebrow="Tutorial">
    End-to-end walkthrough — client → RPC → MidenScan verification.
  </Card>
  <Card title="Miden node" href="/reference" eyebrow="Architecture">
    How the node receives transactions, aggregates batches, and produces blocks.
  </Card>
</CardGrid>
