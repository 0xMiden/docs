---
title: Rust SDK
sidebar_position: 2
---

# Rust Multisig SDK

The `miden-multisig-client` crate provides a high-level Rust SDK for private multisig workflows on Miden. It wraps the onchain multisig contracts and Guardian coordination into a single API.

**Source**: [`crates/miden-multisig-client`](https://github.com/OpenZeppelin/guardian/tree/main/crates/miden-multisig-client)

## Installation

```toml
[dependencies]
miden-multisig-client = { git = "https://github.com/OpenZeppelin/guardian", package = "miden-multisig-client" }
```

## Setup

```rust
use miden_client::rpc::Endpoint;
use miden_multisig_client::MultisigClient;
use miden_objects::Word;

let signer1: Word = /* RPO Falcon commitment */ Word::default();
let signer2: Word = Word::default();

let mut client = MultisigClient::builder()
    .miden_endpoint(Endpoint::new("http://localhost:57291"))
    .psm_endpoint("http://localhost:50051")
    .account_dir("/tmp/multisig")
    .generate_key()
    .build()
    .await?;
```

## Creating a multisig account

```rust
// Create a 2-of-2 multisig account and register it on Guardian
let account = client.create_account(2, vec![signer1, signer2]).await?;
```

## Propose, sign, execute

```rust
use miden_multisig_client::TransactionType;
use miden_objects::account::AccountId;

let recipient = AccountId::from_hex("0x...")?;
let faucet = AccountId::from_hex("0x...")?;
let tx = TransactionType::transfer(recipient, faucet, 1_000);

// Proposer creates the transaction proposal on Guardian
let proposal = client.propose_transaction(tx).await?;

// Cosigner lists and signs the proposal
let proposals = client.list_proposals().await?;
let to_sign = proposals.iter().find(|p| p.id == proposal.id).unwrap();
client.sign_proposal(&to_sign.id).await?;

// Once threshold is met, execute
client.execute_proposal(&proposal.id).await?;
```

## Offline fallback

If Guardian is unavailable, the SDK automatically produces an offline proposal:

```rust
use miden_multisig_client::{ProposalResult, TransactionType};

let tx = TransactionType::consume_notes(vec![note_id]);
match client.propose_with_fallback(tx).await? {
    ProposalResult::Online(p) => {
        println!("Proposal {} is live on Guardian", p.id);
    }
    ProposalResult::Offline(exported) => {
        std::fs::write("proposal.json", exported.to_json()?)?;
        println!("Share proposal.json with cosigners for offline signing");
    }
}
```

### Offline signing and execution

```rust
// Cosigner signs an imported proposal
client.sign_imported_proposal(&mut exported)?;
std::fs::write("proposal_signed.json", exported.to_json()?)?;

// Once enough signatures are collected
client.execute_imported_proposal(&exported).await?;
```

## Listing consumable notes

```rust
use miden_multisig_client::NoteFilter;

// All consumable notes
let notes = client.list_consumable_notes().await?;

// Filter by faucet and minimum amount
let faucet = AccountId::from_hex("0x...")?;
let filter = NoteFilter::by_faucet_min_amount(faucet, 5_000);
let spendable = client.list_consumable_notes_filtered(filter).await?;
```

## Full reference

See the [`crates/miden-multisig-client/README.md`](https://github.com/OpenZeppelin/guardian/tree/main/crates/miden-multisig-client) for the complete API reference.
