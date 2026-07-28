---
title: Bridging
description: Choose and integrate an Agglayer or Epoch bridge flow in a Miden application.
sidebar_position: 1
---

# Bridging

Miden applications can move assets between Miden testnet and Ethereum Sepolia
through two different integration models:

- **Agglayer** exposes the canonical bridge primitives. Your application builds
  the source-chain transaction or note and tracks the bridge lifecycle.
- **Epoch** exposes a quote-and-solve SDK. Your application creates an intent
  and the Epoch allocator and solver coordinate the destination leg.

:::warning Testnet only
The deployments, assets, addresses, timings, and service endpoints in this
section are for testnet development. Do not treat them as production guarantees.
:::

## Choose an integration

|                    | Agglayer                                                                 | Epoch                                                                    |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Typical testnet time | 10–20 minutes                                                           | 1–3 minutes                                                              |
| Asset in the current reference | Sepolia ETH ↔ Miden ETH                                      | Epoch test USDC on Sepolia ↔ Miden USDC                                  |
| Developer surface  | Miden Web SDK, wallet adapter, EVM bridge contract, bridge indexer       | Epoch intent SDK, Miden wallet callback, EVM wallet client                |
| Settlement model   | Canonical bridge                                                          | Allocator and solver                                                      |
| Application owns   | Source transaction, bridge identifiers, lifecycle and recovery UI       | Intent envelope, wallet callbacks, sponsor/nonce persistence and status UI |
| Best fit           | Direct Agglayer interoperability and canonical bridge semantics          | Faster USDC movement and quote-and-solve abstraction                      |

The timing ranges are observations from the current testnet integrations, not
service-level agreements. Source-chain confirmation, bridge observation,
exit-root or proof propagation, solver availability, destination settlement,
and Miden note synchronization can all change the final duration.

### Choose Agglayer when

- Your application needs canonical Agglayer interoperability.
- ETH is the asset your current integration needs to move.
- You want to control and expose each source, bridge, and destination state.
- A 10–20 minute bridge lifecycle fits the product experience.

### Choose Epoch when

- Your application prioritizes a 1–3 minute testnet experience.
- Epoch test USDC matches the application flow.
- You want the SDK to handle quoting, Compact deposits, and solver
  coordination.
- You accept Epoch's allocator and solver as additional trust and availability
  boundaries.

Do not choose only by headline time. Compare the asset, fee model, trust
boundary, recovery responsibility, and API surface your application must own.

## Model completion correctly

A cross-chain transfer is not one status. Persist enough information to resume
tracking after navigation or reload and expose these states separately:

1. Source signature requested.
2. Source transaction submitted.
3. Source finality reached.
4. Bridge message or intent observed.
5. Destination transaction submitted.
6. Destination settlement reached.
7. Destination funds are spendable.

The last two steps are not always the same:

- **Agglayer, Sepolia → Miden:** the bridge can deliver a note before the asset
  is spendable. The recipient must consume the note in the Miden wallet.
- **Agglayer, Miden → Sepolia:** the current Gateway service auto-claims the
  ready exit on Sepolia. Completion means that claim transaction settled.
- **Epoch:** completion means the destination-chain status row settled. Do not
  stop polling merely because an intermediate source or allocator row succeeded.

## Privacy boundary

Bridging crosses a public interoperability boundary. Even when the Miden
account and its later activity are private, your application should tell users
which source and destination transaction hashes, asset amounts, recipient
encodings, and provider routing data become observable.

## Next

- [Integrate Agglayer](./agglayer.md)
- [Integrate Epoch](./epoch.md)
