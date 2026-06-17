---
title: Miden Guardian
sidebar_position: 0
---

# Miden Guardian

Miden Guardian is an offchain coordination service built by [OpenZeppelin](https://www.openzeppelin.com/) for Miden accounts. It helps clients back up private account state, synchronize that state across devices, and coordinate multi-signer workflows without giving the Guardian provider unilateral control over the account.

:::warning
Guardian is a work in progress. Use the docs and the [OpenZeppelin Guardian repository](https://github.com/OpenZeppelin/guardian) as the current operator and integration reference, and expect interfaces and operational defaults to evolve.
:::

## The problem

Miden's execution model requires clients to manage their own private state - accounts, notes, storage - locally on-device. While this provides strong privacy and scalability, it introduces real challenges:

- **Solo-account users** risk losing access if local state is not backed up. Losing any part of the account state means losing access to the account itself.
- **Shared-account users** risk having stale state due to a faulty or malicious participant withholding updates.
- **Multi-device users** need all devices to see the same account state, but there is no public ledger to read from.

On a public chain, the ledger is a universally readable source of truth. Every device and every signer can independently observe the latest state. In Miden's private account model, the canonical state is defined by the onchain commitment, but the full private state is not publicly readable. The coordination surface moves offchain.

## What Guardian provides

Guardian addresses these challenges by acting as an offchain coordination layer:

- **Backup and recovery** - Account state is stored on Guardian, recoverable even if a device is lost.
- **Multi-device sync** - Multiple devices push and pull state through Guardian, staying in sync with the latest canonical state.
- **Multi-party coordination** - Shared accounts use delta proposals to coordinate threshold signing across participants.
- **Integrity verification** - State changes are linked by commitments, validated against the Miden network, and acknowledged with a cryptographic signature.

Guardian is not a private execution environment, a sequencer, or a rollup. Clients still execute transactions locally and submit proofs to Miden. Guardian stores and coordinates the state data that authorized clients submit to it.

## Architecture at a glance

| Layer | Responsibility | What remains authoritative |
|---|---|---|
| **Miden network** | Stores commitments and verifies account updates. | The canonical account commitment. |
| **Miden client** | Executes transactions, manages local state, proves updates, and signs Guardian requests. | The user's keys and local verification logic. |
| **Guardian server** | Stores snapshots, stores deltas, authenticates readers/writers, acknowledges accepted deltas, and coordinates proposals. | Only the data it has accepted and signed. |
| **Storage backend** | Persists metadata, state snapshots, deltas, and pending proposals. | The append-only commitment chain, as verified by clients and the network. |

Guardian is non-custodial. The provider cannot move funds unilaterally - it stores state and coordinates changes, but users retain cryptographic control over their accounts at all times.

## Trust model summary

Guardian has an explicit trust boundary:

- **Safety**: The provider cannot forge account state, silently rewrite the commitment chain, or move assets without the required account signatures.
- **Liveness**: The provider can delay, censor, or refuse requests. Users should keep recovery keys and provider-rotation paths available.
- **Privacy**: Guardian protects state from unauthorized API callers, but the server stores the account state and delta payloads it receives. Treat the operator as able to observe submitted payloads unless your deployment adds a separate encryption layer or you operate the service yourself.
- **Freshness**: Clients should verify acknowledgments and compare local state against the latest onchain commitment when freshness matters.

## Learn more

<CardGrid cols={2}>
  <Card title="Architecture" href="./core-concepts/architecture" eyebrow="Core concepts">
    Roles, trust boundaries, state flow, and failure behavior.
  </Card>
  <Card title="Data structures" href="./core-concepts/data-structures" eyebrow="Core concepts">
    State, deltas, commitments, and delta proposals.
  </Card>
  <Card title="Components" href="./core-concepts/components" eyebrow="Core concepts">
    API, authentication, storage, and other server components.
  </Card>
  <Card title="Security" href="./core-concepts/security" eyebrow="Core concepts">
    Trust model, integrity guarantees, and edge cases.
  </Card>
  <Card title="Operator guide" href="./operator-guide/running" eyebrow="Run it">
    How to run, deploy, and troubleshoot a Guardian server.
  </Card>
  <Card title="Private multisig" href="../private-multisig/" eyebrow="Solutions">
    Multi-party threshold signature workflows powered by Guardian.
  </Card>
</CardGrid>

## Repository

- [Miden Guardian](https://github.com/OpenZeppelin/guardian) - Guardian server, client SDKs, multisig client libraries, and specification
