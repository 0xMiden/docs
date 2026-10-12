---
title: Bridging
description: Choose a third-party bridge integration for a Miden application.
sidebar_position: 1
---

# Bridging

Miden applications can use third-party interoperability providers to move
assets between Miden testnet and Ethereum Sepolia.

These are provider integrations available to Miden developers, not
Miden-owned bridge products or APIs.

<Callout variant="warn" title="Testnet only">
The assets, deployments, timings, and endpoints described here are for testnet
development. Confirm current support in the provider's documentation before
building or funding an integration.
</Callout>

## Choose an integration

<CardGrid cols={2}>
  <Card title="Agglayer bridge" href="./agglayer" eyebrow="10–20 min · Sepolia ETH">
    Integrate directly with Agglayer's bridge lifecycle and the Miden-specific
    account and note flow.
  </Card>
  <Card title="Epoch intents" href="./epoch" eyebrow="1–3 min · Test USDC">
    Request a quote, authorize the source asset, and let Epoch coordinate
    destination fulfillment.
  </Card>
</CardGrid>

| | Agglayer | Epoch |
| --- | --- | --- |
| Typical testnet time | 10–20 minutes | 1–3 minutes |
| Current reference asset | Sepolia ETH ↔ Miden ETH | Epoch test USDC on Sepolia ↔ Miden USDC |
| Integration model | Agglayer bridge transaction and lifecycle | Quote-and-solve intent SDK |
| Provider boundary | Agglayer and its Miden-side integration service | Epoch allocator and solver |
| Best fit | Direct Agglayer interoperability | Faster intent-based USDC movement |

The timing ranges are observations, not service-level agreements. Source
finality, provider observation, proof or solver availability, destination
settlement, and Miden note synchronization can all affect the final duration.

Choose by asset support, provider trust boundary, recovery model, and the
states your application must expose—not timing alone.

## Model completion correctly

A cross-chain transfer is not one status. Your application should distinguish:

<Steps>

**Source authorization and submission** — the user approves and submits the
source-chain action.

**Provider acceptance** — Agglayer observes the bridge action or Epoch accepts
the intent.

**Destination settlement** — the provider completes its destination-chain
transaction.

**Funds become spendable** — the destination wallet discovers and, on Miden,
consumes the delivered note.

</Steps>

On Miden, delivery can create a note that the recipient's wallet still needs
to discover and consume. Do not report spendable funds only because the
provider reports a successful destination transaction.

## Documentation boundary

<Callout variant="info" title="Miden integration guide, provider API reference">
These pages explain how each provider fits into a Miden application and
identify the Miden-specific integration details. Continue in the provider's
documentation for current SDK methods, deployment addresses, supported assets,
fees, recovery operations, and production guidance.
</Callout>
