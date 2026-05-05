---
name: miden-architecture
description: >
  Miden protocol, SDK, and documentation knowledge. Use when working on Miden
  docs or source repositories, especially protocol, miden-client, node,
  miden-vm, compiler, tutorials, and application templates.
compatibility: Designed for AI coding assistants.
metadata:
  author: 0xMiden
  docs_current: "0.15 (unstable)"
  latest_stable: "0.14"
---

# Miden Protocol Skill

## Version Awareness

- The default docs at `https://docs.miden.xyz/` track the next release and are currently labeled **0.15 unstable**.
- The latest stable versioned docs are at `https://docs.miden.xyz/0.14/`.
- If a user asks about released behavior, check the matching versioned docs and release tag before answering.
- If a user asks about current development, use the default docs and the relevant source repository branch.

## What Is Miden

Miden is a privacy-preserving blockchain where accounts are programmable smart contracts and users execute and prove transactions locally. Accounts communicate asynchronously through programmable notes. Private account and note data stays with the client unless a developer deliberately chooses public or network-visible state.

## Key Mental Model Shifts

- **Transactions involve one account.** Sending assets usually means one transaction creates a note and another transaction consumes it.
- **Notes are programmable messages.** A note carries assets plus script logic that controls how it can be consumed.
- **Privacy is the default.** Private accounts and notes reveal commitments on-chain, not full state.
- **Users prove transactions.** Clients execute transactions, produce proofs, and submit proven state transitions to the network.
- **State is account-centric.** Accounts own storage, vault assets, code, and nonce; account updates can be processed independently.
- **MASM is still relevant.** Rust smart contracts compile down to Miden Assembly, and some low-level account, note, and transaction logic is still authored or debugged in MASM.

## Core Concepts

- **Accounts**: Smart contracts with ID, code, storage, vault, and nonce. Storage modes include private, public, and network account modes.
- **Components**: Reusable account modules for storage, methods, authentication, wallet behavior, and application-specific logic.
- **Notes**: Programmable asset containers. They can be private or public and are consumed by account transactions.
- **Transactions**: Single-account state transitions with note processing, optional transaction scripts, and proof generation.
- **Assets**: Fungible and non-fungible assets. Faucets define and mint assets.
- **Client state**: Local account state, note data, nullifiers, and synchronized network data are required for proving and debugging.
- **Node services**: RPC, block producer, store, and related services handle synchronization, transaction submission, and network note execution.

## Builder Documentation Map

- Get started: https://docs.miden.xyz/builder/get-started/
- Install tools with midenup: https://docs.miden.xyz/builder/get-started/setup/installation
- CLI basics: https://docs.miden.xyz/builder/get-started/setup/cli-basics
- Smart contracts: https://docs.miden.xyz/builder/smart-contracts/
- Accounts: https://docs.miden.xyz/builder/smart-contracts/accounts/introduction
- Notes: https://docs.miden.xyz/builder/smart-contracts/notes/introduction
- Transactions: https://docs.miden.xyz/builder/smart-contracts/transactions/introduction
- Client SDKs: https://docs.miden.xyz/builder/tools/clients/
- Web SDK: https://docs.miden.xyz/builder/tools/clients/web-client/
- React SDK: https://docs.miden.xyz/builder/tools/clients/react-sdk/
- Tutorials: https://docs.miden.xyz/builder/tutorials/
- Migration guide: https://docs.miden.xyz/builder/migration/
- Guardian docs: https://docs.miden.xyz/builder/miden-guardian/

## Core Concepts Map

- Core concepts: https://docs.miden.xyz/core-concepts/
- Protocol: https://docs.miden.xyz/core-concepts/protocol/
- Protocol account model: https://docs.miden.xyz/core-concepts/protocol/account/
- Protocol notes: https://docs.miden.xyz/core-concepts/protocol/note
- Protocol transactions: https://docs.miden.xyz/core-concepts/protocol/transaction
- Protocol MASM library: https://docs.miden.xyz/core-concepts/protocol/protocol_library
- Miden VM: https://docs.miden.xyz/core-concepts/miden-vm/
- Compiler: https://docs.miden.xyz/core-concepts/compiler/
- Node: https://docs.miden.xyz/core-concepts/node/
- Node RPC: https://docs.miden.xyz/core-concepts/node/rpc

## Source Repositories

- Docs: https://github.com/0xMiden/docs
- Protocol: https://github.com/0xMiden/protocol
- Miden VM and assembler: https://github.com/0xMiden/miden-vm
- Client SDKs: https://github.com/0xMiden/miden-client
- Node: https://github.com/0xMiden/node
- Compiler: https://github.com/0xMiden/compiler
- Tutorials: https://github.com/0xMiden/tutorials
- Frontend template: https://github.com/0xMiden/frontend-template
- Agentic template: https://github.com/0xMiden/agentic-template
- Rust templates: https://github.com/0xMiden/rust-templates

## Common Pitfalls

- Do not treat old `miden-base` paths as current source. Current protocol source lives in `0xMiden/protocol`.
- Do not assume old `builder/develop` docs paths still exist. Current builder docs use `builder/get-started`, `builder/smart-contracts`, `builder/tutorials`, and `builder/tools`.
- Do not cite a GitHub blob URL unless the referenced file still exists at that branch or tag.
- Do not assume the default docs describe a released version. Use `/0.14/` for latest stable documentation.
- For Web SDK and React SDK code, verify names against the shipped npm types when possible.
- For network account and network note behavior, verify against the node version being discussed; `next` RPC names may differ from v0.14.
- For MASM import and assembler behavior, check `miden-vm` and protocol library docs together.

## Answering Guidance

1. Start from `llms.txt` for high-level routing: https://docs.miden.xyz/llms.txt
2. Use the route maps above to find the right current or versioned docs section.
3. Cross-check API names against source repositories for precise code examples.
4. Mention the version or branch you relied on when behavior may differ across releases.
