---
sidebar_label: Introduction
sidebar_position: 0
pagination_next: null
pagination_prev: null
---

<!--
ARCHITECTURE NOTE:
This landing page is the ONLY Reference content in docs/.
Full Reference documentation (Protocol, VM, Compiler, Node) lives in versioned_docs/
and is populated by ingestion from external source repositories.
DO NOT add protocol documentation files here.
-->

# Miden Reference

A technical reference for Miden's architecture: the protocol, the zkVM, the compiler toolchain, and the node.

## Explore by topic

<CardGrid cols={2}>
  <Card title="Protocol" href="#protocol" eyebrow="Data model">
    Accounts, notes, state model, and transaction semantics.
  </Card>
  <Card title="Miden VM" href="#virtual-machine-miden-vm" eyebrow="Execution">
    STARK-based zkVM, chiplets, and Miden Assembly.
  </Card>
  <Card title="Compiler" href="#compiler" eyebrow="Toolchain">
    Rust → WebAssembly → Miden IR → MASM compilation pipeline.
  </Card>
  <Card title="Node" href="#node" eyebrow="Network">
    gRPC API, batch aggregation, and block production.
  </Card>
</CardGrid>

---

## Architecture overview

Miden is a zero-knowledge rollup that rethinks blockchain architecture. Instead of a single global state updated sequentially, Miden uses an **actor model** where each account is an independent state machine that executes transactions locally and generates validity proofs.

### Core design principles

| Principle | How Miden achieves it |
|-----------|----------------------|
| **Privacy** | Accounts and notes store only cryptographic commitments on-chain; full data remains with users |
| **Parallelism** | Single-account transactions enable concurrent execution without contention |
| **Scalability** | Client-side proving offloads computation; proof aggregation reduces on-chain verification |
| **Programmability** | A Turing-complete VM supports arbitrary smart contract logic in accounts and notes |

<Steps>

**Local execution** — Users execute transactions on their devices, consuming input notes and updating account state.

**Proof generation** — The client generates a STARK proof attesting to valid state transitions.

**Note creation** — Transactions produce output notes carrying assets and data to recipients.

**Verification** — The node verifies proofs, updates state commitments, and makes notes available.

</Steps>

---

## Protocol

The protocol layer defines Miden's data structures, state model, and transaction semantics.

### Accounts

Accounts are programmable entities that hold assets and execute code:

- **ID** — unique identifier derived from initial code and storage
- **Code** — smart contract logic defining the account's interface
- **Storage** — key-value store with up to 256 slots for persistent data
- **Vault** — container holding fungible and non-fungible assets
- **Nonce** — monotonically increasing counter preventing replay attacks

Account code is composed from **components** — modular building blocks that add capabilities like wallet functionality, token standards, or custom logic.

### Notes

Notes are programmable messages that transfer assets between accounts:

- **Script** — code executed when the note is consumed
- **Inputs** — public data available to the consuming transaction
- **Assets** — tokens transferred to the recipient
- **Metadata** — sender, tag (for discovery), and auxiliary data

Notes can be **public** (all data on-chain) or **private** (only a commitment stored). Private notes require off-chain communication between sender and recipient.

### State model

Miden maintains three core databases:

| Database | Structure | Purpose |
|----------|-----------|---------|
| **Accounts** | Sparse Merkle Tree | Maps account IDs to state commitments |
| **Notes** | Merkle Mountain Range | Append-only log of created notes |
| **Nullifiers** | Sparse Merkle Tree | Tracks consumed notes to prevent double-spending |

This separation enables efficient state proofs and supports both public and private modes for accounts and notes.

### Transactions

Transactions are single-account operations that:

1. Consume zero or more input notes
2. Execute account code and optionally a transaction script
3. Update account state (storage, vault, nonce)
4. Produce zero or more output notes

The single-account model means transactions don't contend for shared state, enabling **parallel execution** across the network.

---

## Virtual Machine (miden-vm)

The Miden VM is a STARK-based virtual machine optimized for zero-knowledge proof generation.

### Architecture

- **Stack-based** — operates on a push-down stack of 64-bit prime field elements
- **Turing-complete** — supports loops, conditionals, and recursive procedures
- **Deterministic** — same inputs always produce same outputs (with controlled nondeterminism for advice)

### Core components

| Component | Function |
|-----------|----------|
| **Decoder** | Fetches and decodes instructions, manages control flow |
| **Stack** | 16 directly accessible elements, unlimited depth via memory |
| **Memory** | Random-access read/write storage |
| **Chiplets** | Specialized circuits for cryptographic and bitwise operations |

### Chiplets

Chiplets are co-processors that accelerate common operations:

- **Hash chiplet** — Rescue Prime Optimized hashing, Merkle tree operations
- **Bitwise chiplet** — AND, XOR, and other bitwise operations on 32-bit integers
- **Memory chiplet** — efficient random-access memory with read/write tracking
- **Kernel ROM** — secure execution of privileged kernel procedures

### Miden Assembly (MASM)

MASM is the native instruction set with:

- **Field operations** — arithmetic on prime field elements
- **U32 operations** — 32-bit integer arithmetic, bitwise, and comparison
- **Cryptographic operations** — hashing, Merkle proofs, signature verification
- **Control flow** — conditionals, loops, and procedure calls
- **Memory operations** — load/store to local and global memory

---

## Compiler

The compiler toolchain enables writing Miden programs in high-level languages.

### Components

- **cargo-miden** — Cargo extension for building Miden projects
- **midenc** — core compiler from WebAssembly to Miden Assembly
- **Debugger** — interactive debugging with breakpoints and state inspection

### Compilation pipeline

```text
   Rust       →    WebAssembly    →    Miden IR    →    MASM
 (source)         (Wasm binary)      (compiler IR)    (assembly)
```

The compiler supports:

- **Account components** — reusable smart contract modules
- **Note scripts** — logic executed when notes are consumed
- **Transaction scripts** — custom transaction execution logic

---

## Node

The node is the network infrastructure that receives transactions and produces blocks.

### Responsibilities

- Receive and validate proven transactions via gRPC
- Aggregate transaction proofs into batches
- Produce blocks with aggregated proofs
- Maintain state databases and serve sync requests

### gRPC API

The node exposes endpoints for:

- **Account queries** — get account details, proofs, and storage
- **Note queries** — retrieve notes by ID or script
- **Block queries** — fetch block headers and contents
- **Sync operations** — synchronize client state with the network
- **Transaction submission** — submit proven transactions

---

import SectionLinks from '@site/src/components/SectionLinks';

<SectionLinks
  title="Build on Miden"
  links={[
    { href: '../builder/get-started', label: 'Get started', description: 'Install tools, create a wallet, and run your first transaction' },
    { href: '../builder/smart-contracts', label: 'Smart contracts', description: 'Reference for building contracts in Rust with the Miden SDK' },
    { href: '../builder/', label: 'Builder documentation', description: 'Tutorials, tools, and guides for developers' },
  ]}
/>
