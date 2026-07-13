---
title: "Miden Standards"
description: "Use standard Miden account components, notes, faucets, and policies from Rust or Miden Assembly."
---

# Miden Standards

Miden Standards are reusable building blocks for common smart-contract behavior: wallet interfaces, authentication components, token faucets, note scripts, and policy modules.

Use them when you want your account, note, or transaction flow to interoperate with the rest of the Miden ecosystem instead of defining every interface from scratch.

:::caution Current docs are unstable
The current docs track the unstable standards line. The v0.14 snapshot has a different standards surface in a few important places, especially faucet and policy APIs. Use the version selector if you are building against v0.14.
:::

This section is a builder guide, not the canonical standards specification. It explains which standard to reach for, how it fits into the smart-contract model, and where to switch to reference docs when you need exact procedure names, storage schemas, or script roots.

## How standards fit into smart contracts

Smart Contracts is the domain. Rust and Miden Assembly are authoring paths inside that domain.

| Layer | Role |
|------|------|
| Rust | Compose standard account components and construct standard notes through Rust APIs. |
| Miden Assembly | Import and call standard MASM modules directly when writing low-level account, note, transaction, or library code. |
| Miden Standards | Shared account components, note scripts, faucet policies, and helper modules used by both authoring paths. |

## What this section covers

<CardGrid cols={3}>
  <Card title="Account components" href="./account-components" eyebrow="Compose accounts">
    Use standard wallet, authentication, access-control, faucet, and metadata components.
  </Card>
  <Card title="Standard notes" href="./standard-notes" eyebrow="Move assets">
    Choose P2ID, P2IDE, SWAP, PSWAP, mint, and burn note scripts.
  </Card>
  <Card title="Faucets and policies" href="./faucets-and-policies" eyebrow="Issue tokens">
    Build token faucets and choose mint, burn, send, and receive policy modules.
  </Card>
</CardGrid>

## When to use standards

Use a standard component or note when:

- You want other accounts, note scripts, clients, or tooling to recognize your account interface.
- Your behavior matches an existing pattern, such as holding assets, receiving a P2ID transfer, minting a fungible token, or verifying a single signature.
- You need a stable building block before adding custom application logic.

Write custom components or note scripts when:

- The authorization rules are application-specific.
- The note consumption condition is not covered by P2ID, P2IDE, SWAP, mint, or burn notes.
- The account's state model needs custom storage and custom exported methods.

You can mix both approaches. A typical application account starts with standard authentication and wallet components, then adds one or more custom components for protocol-specific logic.

## Related pages

- [Accounts](../accounts/) - components, storage, authentication, and account operations
- [Notes](../notes/) - note model, note scripts, standard note types, and output notes
- [Cross-component calls](../cross-component-calls) - calling component interfaces from scripts and components
- [`miden-standards` source](https://github.com/0xMiden/protocol/tree/next/crates/miden-standards) - current standards implementation
