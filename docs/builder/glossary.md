---
title: Glossary
description: "Key terms and definitions used throughout the Miden docs — grouped by area (accounts, notes, protocol, Guardian, cryptography)."
pagination_next: null
---

# Glossary

Key terms and definitions used throughout the Miden docs. Grouped thematically — if you're not sure where something lives, use your browser's find (⌘F / Ctrl+F).

<CardGrid cols={3}>
  <Card title="Accounts" href="#accounts" eyebrow="Jump to">
    Account, AccountCode, AccountComponent, AccountId, AccountStorage, MultiSig, AccountBuilder.
  </Card>
  <Card title="Notes & assets" href="#notes--assets" eyebrow="Jump to">
    Note, Note script, Note tag, Note ID, Nullifier, Asset, AssetVault.
  </Card>
  <Card title="Protocol & VM" href="#protocol--vm" eyebrow="Jump to">
    Block, Batch, Kernel, Prover, Miden Assembly, Felt, Word.
  </Card>
  <Card title="Guardian & multisig" href="#guardian--multisig" eyebrow="Jump to">
    Miden Guardian, Canonicalization, Delta, Delta Proposal, Threshold Signature.
  </Card>
</CardGrid>

## Accounts

### Account

An account is a data structure that represents an entity (user account, smart contract) on the Miden blockchain — analogous to smart contracts.

### Account builder

Account builder provides a structured way to create and initialize new accounts on the Miden network with specific properties, permissions, and initial state.

### AccountCode

The executable code associated with an account.

### AccountComponent

A modular unit of code representing a piece of an account's functionality. Each `AccountCode` is composed of multiple `AccountComponent`s.

### AccountId

A value that uniquely identifies each account on Miden.

### AccountIdVersion

Represents the different versions of account identifier formats supported by Miden.

### AccountStorage

A key-value store associated with an account. Made up of storage slots.

### MultiSig

A multi-signature account on Miden that requires a configurable threshold (N-of-M) of authorized signers to approve transactions before execution. MultiSig workflows are coordinated through [Miden Guardian](./miden-guardian/index.md).

## Notes & assets

### Note

A fundamental data structure that represents an offchain asset or a piece of information that can be transferred between accounts. Miden's UTXO-like model is designed around notes. **Output notes** are new notes created by a transaction; **input notes** are those consumed (spent) by a transaction.

### Note script

A program that defines the rules and conditions under which a note can be consumed.

### Note tag

An identifier or metadata associated with notes that provides additional filtering capabilities.

### Note ID

A unique identifier assigned to each note to distinguish it from other notes.

### Nullifier

A cryptographic commitment that marks a note as spent, preventing it from being consumed again.

### Asset

A digital resource with value that can be owned, transferred, and managed within the Miden blockchain.

### AssetVault

The container used for managing assets within accounts. Provides a way to store and transfer assets associated with each account.

## Protocol & VM

### Block

A fundamental data structure that groups multiple batches together and forms the blockchain's state.

### Batch

A collection of transactions grouped together, to be aggregated into blocks — improves network throughput.

### Kernel

A fundamental module of the Miden VM that acts as a base layer, providing core functionality and security guarantees for the protocol.

### Prover

Responsible for generating zero-knowledge proofs that attest to the correctness of program execution without revealing the underlying data.

### Miden Operator

An entity that runs the node infrastructure powering the Miden network. Operators verify transaction proofs, record created notes and consumed-note nullifiers in the state databases, build the batches and blocks that progress the chain, and execute network transactions on behalf of users (for example, consuming a note against a public DEX contract).

### Miden Assembly

An assembly language specifically designed for the Miden VM — a low-level language with specialized instructions optimized for zero-knowledge proof generation.

### Felt

A Felt (Field Element) is the primitive cryptographic data type used by the Miden VM. It represents an element in the finite (Goldilocks) field: `p = 2^64 − 2^32 + 1`.

### Word

A data structure that represents the basic unit of computation and storage in Miden. Composed of four `Felt`s.

## Guardian & multisig

### Miden Guardian

Infrastructure built by OpenZeppelin for managing private account state on Miden. Guardian provides a server and client SDKs for backing up, syncing, and coordinating state across devices and parties without trust assumptions. See the [Miden Guardian documentation](./miden-guardian/index.md).

### Canonicalization

The background process by which [Miden Guardian](./miden-guardian/index.md) promotes candidate deltas to canonical status by verifying them against the Miden network.

### Delta

A Delta represents the changes between two states `s` and `s'`. Applying a Delta `d` to `s` produces `s'`.

### Delta Proposal

A coordination mechanism in [Miden Guardian](./miden-guardian/index.md) that allows multiple signers to propose, review, and co-sign state changes before they are promoted to a canonical delta.

### Threshold Signature

A cryptographic scheme where a minimum number of signers (the threshold) out of a total group must sign for a transaction to be valid. Used in Miden's MultiSig accounts.
