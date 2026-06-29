---
title: "What is a Miden Smart Contract"
sidebar_position: 1
description: "Miden's execution model, account structure, note system, and transaction lifecycle."
---

# What is a Miden Smart Contract

:::info Concepts apply to both authoring paths
This page describes Miden's execution model — accounts, notes, transactions, and lifecycle. The concepts apply regardless of whether you author contracts in MASM (the mainnet path) or the Rust SDK (in active development). Code examples on this page use Rust; for the MASM path, see [MASM Smart Contracts](./masm/index.md).
:::

Miden is a zero-knowledge layer 2 where transactions execute on the client and only a cryptographic proof is submitted to the network. Every entity — wallets, contracts, faucets — is an account with code, storage, a vault, and a nonce. Assets move between accounts through notes, which act as programmable UTXOs. This page describes the execution model, account structure, note system, and transaction lifecycle. For a hands-on walkthrough, see the [Miden Bank Tutorial](../tutorials/miden-bank/index.md).

## What makes Miden different

On Ethereum, smart contracts execute on every node. On Miden, **transactions execute locally on the client** — and only a cryptographic proof is submitted to the network.

This means:

- **Privacy by default** — The network sees the proof, not the inputs
- **Parallel execution** — Transactions don't compete for block space
- **Lower fees** — No gas wars; proofs are cheap to verify
- **Client-side proving** — Your machine generates the ZK proof

## The compilation pipeline

Miden runs **MASM** (Miden Assembly) — the VM's native instruction set. There are two authoring paths that produce it:

**MASM directly** (the supported mainnet path):

```
MASM → ZK Circuit → Proof
```

You write MASM directly and build it into a `.masp` package (Miden Assembly Package). This is what mainnet supports for production today. See [MASM Smart Contracts](./masm/index.md).

**Rust** (in active development):

```
Rust → Wasm → MASM → ZK Circuit → Proof
```

The Miden compiler (`cargo-miden`) compiles your `#![no_std]` Rust to WebAssembly, then translates it to MASM. The output is the same `.masp` package, so both paths share the same execution model and the same [Miden Standards](./standards/index.md) library.

When a transaction executes, the Miden VM runs the MASM and produces a zero-knowledge proof of correct execution. The output of `cargo miden build` (Rust) or the MASM build tooling is a `.masp` file containing the compiled MASM and metadata.

## The account model

Every entity on Miden is an **account**. Accounts are smart contracts — even user wallets.

An account has four parts:

| Part | Description |
|------|-------------|
| **Code** | One or more components that define the account's behavior |
| **Storage** | Persistent state — up to 255 slots of `Value` or `StorageMap` |
| **Vault** | The assets (fungible and non-fungible) the account holds |
| **Nonce** | A counter that increments with every state change (replay protection) |

### Components

Components are reusable code modules attached to accounts. Think of them as **traits or mixins**, not monolithic contracts. An account can have multiple components.

```rust
#[component]
struct MyWallet;

#[component]
impl MyWallet {
    pub fn receive_asset(&mut self, asset: Asset) {
        self.add_asset(asset);
    }
}
```

Each component defines its own storage layout and public methods. The `#[component]` macro generates the necessary WIT (WebAssembly Interface Type) definitions for cross-component interoperability.

See [Components](./accounts/components.md) for full details.

## Notes as UTXOs

Assets don't transfer directly between accounts. Instead, they move through **notes** — programmable messages that carry assets and logic.

```
Sender Account → creates Note (with assets + script) → Recipient Account consumes Note
```

Notes are similar to Bitcoin's UTXOs, but with arbitrary programmable logic. A note contains:

- **Assets**: The tokens or NFTs being transferred
- **Script**: Code that executes when the note is consumed (e.g., "only account X can claim this")
- **Inputs**: Custom data the script can read

The most common pattern is **P2ID** (Pay to ID) — a note that can only be consumed by a specific account.

See [Notes](./notes/) for implementation details.

## Transaction flow

A transaction in Miden follows this flow:

```mermaid
flowchart LR
    A[Client builds tx locally] --> B[VM executes MASM]
    B --> C[Proof generated]
    C --> D[Proof submitted to network]
    D --> E[Network verifies proof]
    E --> F[State updated]
```

1. **Build**: The client assembles the transaction — which notes to consume, which account methods to call
2. **Execute**: The Miden VM executes the transaction locally
3. **Prove**: The VM produces a zero-knowledge proof of correct execution
4. **Submit**: Only the proof (and state commitments) go to the network
5. **Verify**: The network verifies the proof and updates state

:::info Privacy
Because execution happens locally, the network never sees your transaction inputs, the account's private state, or the logic that ran. It only sees that the proof is valid and the resulting state commitments.
:::

## What "proof generation fails" means

When you write assertions in Miden contracts:

```rust
assert!(amount > felt!(0));
```

If the assertion fails, the ZK circuit **cannot produce a valid proof**. This means:

- The transaction is rejected **before it ever reaches the network**
- No state changes occur — it's as if the transaction never happened
- The client gets an error explaining which assertion failed

This is fundamentally different from Ethereum's `revert` — there's no onchain transaction that fails. The proof simply doesn't exist if the execution is invalid.

A separate failure mode is the [empty transaction](../tutorials/helpers/pitfalls.md#empty-transaction-no-state-change-no-notes) — a transaction that completes without mutating account state or consuming a note is also rejected, since Miden refuses to admit transactions with no observable effect.

## Account types

Miden supports four account types, set at deployment time. The same types are used regardless of authoring language:

| Type | Description |
|------|-------------|
| `RegularAccountUpdatableCode` | Standard account — code can be updated after deployment |
| `RegularAccountImmutableCode` | Account with fixed code — cannot be changed after deployment |
| `FungibleFaucet` | Token minting account (fungible assets) |
| `NonFungibleFaucet` | NFT minting account (non-fungible assets) |

## Where to go next

**Authoring paths and libraries:**

| Section | When to use |
|---|---|
| [MASM Smart Contracts](./masm/index.md) | Production contracts for mainnet today |
| [Rust SDK](./rust/index.md) | Prototyping today; long-term default once it ships v1 |
| [Miden Standards](./standards/index.md) | Reusable building blocks callable from either path |

**Topic guides** (concepts apply regardless of authoring language):

| Topic | Description |
|---|---|
| [Components](./accounts/components.md) | Reusable code modules with storage and exported interfaces |
| [Storage](./accounts/storage.md) | Up to 255 slots of `Value` or `StorageMap` |
| [Custom Types](./accounts/custom-types.md) | Exported structs/enums for public APIs |
| [Account Operations](./accounts/account-operations.md) | Read/write account state and vault |
| [Notes](./notes/) | Programmable UTXOs for asset transfers |
| [Transactions](./transactions/) | Transaction context, scripts, and the advice provider |
| [Authentication](./accounts/authentication.md) | RPO-Falcon512 signatures and replay protection |
| [Cross-Component Calls](./cross-component-calls.md) | Inter-component communication |
| [Types](./types.md) | Felt, Word, Asset — the VM's native types |
| [Patterns](./patterns.md) | Access control, rate limiting, spending limits, anti-patterns |

Ready to start building? The [Miden Bank Tutorial](../tutorials/miden-bank/index.md) is a hands-on walkthrough (currently written against the Rust SDK; the concepts translate to MASM).
