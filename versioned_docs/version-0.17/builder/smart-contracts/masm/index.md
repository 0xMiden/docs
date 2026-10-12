---
title: "MASM Smart Contracts"
description: "Author Miden smart contracts directly in Miden Assembly (MASM) — the supported path for mainnet production."
sidebar_position: 0
---

# MASM Smart Contracts

This section is the practical guide to authoring Miden smart contracts directly in **Miden Assembly (MASM)** — the path Miden mainnet supports for production deployments today. The Rust SDK is in active development and will become the default authoring path once it ships v1; until then, MASM is what you ship with.

:::info Audience
You're here because you want to deploy a contract to Miden mainnet. MASM is a small, stack-based assembly language — closer to assembly than Rust or Solidity, but it gives you direct, predictable control over the VM and is what the mainnet kernel verifies. The [Reference → Miden VM → Assembly](../../../reference/miden-vm/user_docs/assembly/index.md) section is the full language reference; this section is the Builder-side cookbook for using it.
:::

## When to use MASM vs. the Rust SDK

| Concern | MASM | Rust SDK |
|---|---|---|
| **Mainnet production** | Supported today | In active development |
| **Performance / cycle control** | Direct control over emitted instructions | Compiles via Wasm → MASM; less predictable |
| **Learning curve** | Small instruction set, explicit stack semantics | Familiar Rust ergonomics |
| **Miden Standards** | [Standards modules](../standards/) callable directly | Same standards via Rust bindings |
| **Long-term direction** | Long-lived for system-level / performance-critical code | Will become the default authoring path once mature |

For mainnet shipping today, the choice is straightforward: write MASM. Most production patterns — account components, note scripts, transaction scripts, P2ID and P2IDE flows, faucet policies — are already covered by [Miden Standards](../standards/), so most contracts compose existing standards rather than rolling everything from scratch.

## Where the language reference lives

The full Miden Assembly reference — every instruction, the stack semantics, control flow, cryptographic operations, debugging instructions — lives in [Reference → Miden VM → Assembly](../../../reference/miden-vm/user_docs/assembly/index.md). Treat that as the dictionary. This Builder section is the cookbook: how to structure a project, conventions for accounts, notes, and transactions, deployment, testing, and debugging in the context of building a Miden app.

## Guides

Start with a local MASM project, then add account state and programmable notes. These guides use Rust on the host to assemble and execute MASM; they do not require the Rust guest-contract compiler.

| Guide | Purpose or status |
|---|---|
| [Your first MASM project](./first-project.md) | Assemble and execute a standalone VM program. |
| [MASM account components](./account-components.md) | Package procedures and named account storage. |
| [MASM note scripts](./note-scripts.md) | Read committed note storage and call an account procedure. |
| MASM transaction scripts | In progress |
| Testing with MockChain | In progress |
| Debugging MASM contracts | In progress |

For a larger Rust guest-contract example, see the [Miden Bank tutorial](../../tutorials/miden-bank/). For MASM deployment orchestrated by the Rust client, see [Deploying a Counter Contract](../../tutorials/recipes/rust/counter_contract_tutorial.md). The [assembly reference](../../../reference/miden-vm/user_docs/assembly/index.md) covers the language itself.

## See also

- [Miden Standards](../standards/) — reusable account components, standard notes, faucet policies, callable from MASM.
- [Reference → Miden VM → Assembly](../../../reference/miden-vm/user_docs/assembly/index.md) — full language reference (instructions, stack semantics, control flow).
- [Smart Contracts → Overview](../overview) — execution model and lifecycle (the concepts apply regardless of authoring language).
- [Tools → Playground](../../tools/playground) — interactive browser-based MASM environment for quick experiments.
