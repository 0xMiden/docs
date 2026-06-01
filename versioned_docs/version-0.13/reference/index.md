---
sidebar_label: Introduction
sidebar_position: 0
---

<!--
ARCHITECTURE NOTE:
This landing page is the ONLY Reference content in docs/.
Full Reference documentation (Protocol, VM, Compiler, Node) lives in versioned_docs/
and is populated by ingestion from external source repositories.
DO NOT add protocol documentation files here.
-->

# Miden Reference

This section provides a comprehensive technical reference for the Miden architecture, covering the protocol design, virtual machine, compiler toolchain, and node infrastructure.

:::info Version Note
Full Reference documentation is available in **released versions only**. Please select a version from the dropdown (e.g., 0.12, 0.11) to access the complete documentation.
:::

## Architecture Overview

Miden is a zero-knowledge rollup that fundamentally rethinks blockchain architecture. Instead of a single global state updated sequentially, Miden uses an **actor model** where each account is an independent state machine that executes transactions locally and generates validity proofs.

### Core Design Principles

| Principle | How Miden Achieves It |
|-----------|----------------------|
| **Privacy** | Accounts and notes store only cryptographic commitments on-chain; full data remains with users |
| **Parallelism** | Single-account transactions enable concurrent execution without contention |
| **Scalability** | Client-side proving offloads computation; proof aggregation reduces on-chain verification |
| **Programmability** | Turing-complete VM supports arbitrary smart contract logic in accounts and notes |


1. **Local Execution** – Users execute transactions on their devices, consuming input notes and updating account state
2. **Proof Generation** – The client generates a STARK proof attesting to valid state transitions
3. **Note Creation** – Transactions produce output notes carrying assets and data to recipients
4. **Verification** – The node verifies proofs, updates state commitments, and makes notes available

---

## Protocol (miden-base)

The protocol layer defines Miden's data structures, state model, and transaction semantics.

### Accounts

Accounts are programmable entities that hold assets and execute code:

- **ID** – Unique 64-bit identifier derived from initial code and storage
- **Code** – Immutable smart contract logic defining the account's interface
- **Storage** – Key-value store with up to 256 slots for persistent data
- **Vault** – Container holding fungible and non-fungible assets
- **Nonce** – Monotonically increasing counter preventing replay attacks

Account code is composed from **components** – modular building blocks that add capabilities like wallet functionality, token standards, or custom logic.

### Notes

Notes are programmable messages that transfer assets between accounts:

- **Script** – Code executed when the note is consumed
- **Inputs** – Public data available to the consuming transaction
- **Assets** – Tokens transferred to the recipient
- **Metadata** – Sender, tag (for discovery), and auxiliary data

Notes can be **public** (all data on-chain) or **private** (only a commitment stored). Private notes require off-chain communication between sender and recipient.

### State Model

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

- **Stack-based** – Operates on a push-down stack of 64-bit prime field elements
- **Turing-complete** – Supports loops, conditionals, and recursive procedures
- **Deterministic** – Same inputs always produce same outputs (with controlled nondeterminism for advice)

### Core Components

| Component | Function |
|-----------|----------|
| **Decoder** | Fetches and decodes instructions, manages control flow |
| **Stack** | 16 directly accessible elements, unlimited depth via memory |
| **Memory** | Random-access read/write storage |
| **Chiplets** | Specialized circuits for cryptographic and bitwise operations |

### Chiplets

Chiplets are co-processors that accelerate common operations:

- **Hash Chiplet** – Rescue Prime Optimized hashing, Merkle tree operations
- **Bitwise Chiplet** – AND, XOR, and other bitwise operations on 32-bit integers
- **Memory Chiplet** – Efficient random-access memory with read/write tracking
- **Kernel ROM** – Secure execution of privileged kernel procedures

### Miden Assembly (MASM)

MASM is the native instruction set with:

- **Field operations** – Arithmetic on prime field elements
- **U32 operations** – 32-bit integer arithmetic, bitwise, and comparison
- **Cryptographic operations** – Hashing, Merkle proofs, signature verification
- **Control flow** – Conditionals, loops, and procedure calls
- **Memory operations** – Load/store to local and global memory

---

## Compiler

The compiler toolchain enables writing Miden programs in high-level languages.

### Components

- **cargo-miden** – Cargo extension for building Miden projects
- **midenc** – Core compiler from WebAssembly to Miden Assembly
- **Debugger** – Interactive debugging with breakpoints and state inspection

### Compilation Pipeline

```
   Rust       →    WebAssembly    →    Miden IR    →    MASM
 (source)         (Wasm binary)      (compiler IR)    (assembly)
```

The compiler supports:

- **Account components** – Reusable smart contract modules
- **Note scripts** – Logic executed when notes are consumed
- **Transaction scripts** – Custom transaction execution logic

---

## Node (miden-node)

The node is the network infrastructure that receives transactions and produces blocks.

### Responsibilities

- Receive and validate proven transactions via gRPC
- Aggregate transaction proofs into batches
- Produce blocks with aggregated proofs
- Maintain state databases and serve sync requests

### gRPC API

The node exposes endpoints for:

- **Account queries** – Get account details, proofs, and storage
- **Note queries** – Retrieve notes by ID or script
- **Block queries** – Fetch block headers and contents
- **Sync operations** – Synchronize client state with the network
- **Transaction submission** – Submit proven transactions

---

## Further Reading

- **[Build Documentation](../builder/)** – Practical guides for building on Miden
- **[Get Started](../builder/get-started/)** – Get started with your first transaction
- **[FAQ](../builder/faq)** – Common questions answered
