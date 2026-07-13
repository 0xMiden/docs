---
sidebar_position: 3
title: Bridge flows
description: "Component model and sequence diagrams for the testnet mock bridge sandbox."
---

# Bridge flows

The mock bridge sandbox keeps the integration surface small while making the
actors explicit: user wallet, builder app, Bridge API, solver, Sepolia, and
Miden testnet.

The solver role is implemented inside the sandbox service. In production-style
systems, the solver may be a separate operator, but the app-facing flow remains
quote, deposit, status, and settlement evidence.

## Component model

```mermaid
flowchart TB
    User["User wallet"]
    App["Builder app"]
    Bridge["Bridge API<br/>mock 1Click surface"]
    State["Quote state<br/>Postgres"]
    Solver["Solver role<br/>inside sandbox"]
    Sepolia["Sepolia<br/>native ETH"]
    Miden["Miden testnet<br/>public notes"]
    Recipient["Recipient wallet"]

    User --> App
    App -->|"GET /v0/tokens<br/>POST /v0/quote<br/>POST /v0/deposit/submit<br/>GET /v0/status"| Bridge
    Bridge --> State
    Bridge --> Solver
    Solver --> Sepolia
    Solver --> Miden
    User --> Sepolia
    User --> Miden
    Miden --> Recipient
```

## Inbound: Sepolia to Miden

Inbound means the user starts with Sepolia native ETH and receives a public
Miden payout note.

```mermaid
sequenceDiagram
    participant User as User wallet
    participant App as Builder app
    participant Bridge as Bridge API
    participant Solver as Solver
    participant Sepolia
    participant Miden as Miden testnet
    participant Recipient as Recipient wallet

    App->>Bridge: POST /v0/quote eth-sepolia:eth -> miden-testnet:eth
    Bridge-->>App: correlationId and Sepolia depositAddress
    User->>Sepolia: send native ETH to depositAddress
    App->>Bridge: POST /v0/deposit/submit with txHash and depositAddress
    Bridge->>Sepolia: verify receipt, amount, and deposit address
    Bridge->>Solver: mark quote ready for Miden payout
    Solver->>Miden: submit public P2ID mint tx to recipient
    Bridge-->>App: /v0/status returns SUCCESS after payout note is committed
    Recipient->>Miden: sync and consume public P2ID note
```

`SUCCESS` means the bridge-side payout note is committed and consumable. The
recipient still needs to sync and consume the public P2ID note to update local
wallet balance.

## Outbound: Miden to Sepolia

Outbound means the user starts with a Miden testnet asset and receives Sepolia
native ETH.

```mermaid
sequenceDiagram
    participant User as User wallet
    participant App as Builder app
    participant Bridge as Bridge API
    participant Solver as Solver
    participant Miden as Miden testnet
    participant Sepolia

    App->>Bridge: POST /v0/quote miden-testnet:eth -> eth-sepolia:eth
    Bridge-->>App: correlationId, bridgeAccount, and BridgeOutV1 depositMemo
    User->>Miden: create public BridgeOutV1 note to bridgeAccount
    Bridge->>Miden: poll public notes for matching memo and quote hash
    Bridge->>Solver: validate amount, recipient, refund, deadline, and faucet
    Solver->>Miden: consume BridgeOutV1 note with bridge account
    Solver->>Sepolia: release native ETH to destination recipient
    Bridge-->>App: /v0/status returns SUCCESS with Miden consume tx and Sepolia release tx
```

The outbound deposit is a public programmable Miden note, not a per-quote Miden
account. The note carries the `BridgeOutV1` memo and assets, and the bridge
consumes it only after validating the memo fields against the stored quote.

## Why public notes

Public notes are intentional for the sandbox flow:

- The bridge can observe and validate deposits without requiring per-quote
  Miden account setup.
- A user can target a stable bridge account with a programmable note.
- The note metadata and storage encode the quote hash and settlement
  instructions.
- The same public-note pattern matches Miden's account and note model better
  than EVM-style per-address deposit discovery.

Use private notes only when the bridge or solver has a separate private-note
transport and discovery design. That is outside the current sandbox scope.

## Lifecycle statuses

The sandbox records quote state so restarts can resume in-flight work.

| Status | Meaning |
| --- | --- |
| `PENDING_DEPOSIT` | Quote exists, but the bridge has not verified an origin-chain deposit. |
| `KNOWN_DEPOSIT_TX` | The app submitted an origin-chain transaction hash for verification. |
| `PROCESSING` | Deposit is verified and bridge-side settlement is in progress. |
| `SUCCESS` | Bridge-side settlement is complete. |
| `REFUNDED` | The quote was refunded instead of settled. |
| `FAILED` | The bridge could not complete or refund the quote. |
