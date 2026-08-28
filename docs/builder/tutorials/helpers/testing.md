---
sidebar_position: 1
title: "Testing with MockChain"
description: "Learn how to test Miden Rust compiler contracts using MockChain for simulating blockchain behavior locally."
---

# Testing with MockChain

MockChain provides a local simulation of the Miden blockchain for testing your contracts without connecting to a network. This guide covers testing patterns for account components, note scripts, and transaction scripts.

## Overview

MockChain simulates:
- Block production and proving
- Account state management
- Note creation and consumption
- Transaction execution

This enables fast, deterministic testing of your Miden contracts.

## Test Project Setup

Create an integration test crate alongside your contracts:

```text
your-project/
├── contracts/
│   ├── my-account/
│   └── my-note/
└── integration/
    ├── Cargo.toml
    ├── src/
    │   ├── lib.rs        # Exports test helpers
    │   └── helpers.rs    # Test utilities
    └── tests/
        └── my_test.rs    # Test files
```

### Cargo.toml for Tests

```toml title="integration/Cargo.toml"
[package]
name = "integration"
version = "0.1.0"
edition = "2024"
rust-version = "1.96.1"

[[test]]
name = "my_test"
path = "tests/my_test.rs"

[dependencies]
anyhow = "1.0"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
miden-protocol = "0.16"
miden-standards = { version = "0.16", features = ["testing"] }
miden-testing = "0.16"
rand = "0.10"
```

Export the helpers from the integration crate:

```rust title="integration/src/lib.rs"
pub mod helpers;
```

## Building Contracts for Tests

Use the `miden` toolchain to build contracts and then load the generated `.masp` artifact:

```rust title="integration/src/helpers.rs"
use std::{path::{Path, PathBuf}, process::Command};
use anyhow::{bail, Context, Result};
use miden_protocol::{assembly::Package, utils::serde::Deserializable};

pub fn build_project_in_dir(dir: &Path, release: bool) -> Result<Package> {
    let profile_dir = if release { "release" } else { "dev" };

    let mut command = Command::new("miden");
    command.arg("build");
    if release {
        command.arg("--release");
    }

    let status = command
        .current_dir(dir)
        .status()
        .context("failed to run miden build")?;
    if !status.success() {
        bail!("miden build failed with {status}");
    }

    let artifact_dir = dir.join("target/miden").join(profile_dir);
    let mut artifacts = std::fs::read_dir(&artifact_dir)?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().is_some_and(|ext| ext == "masp"));
    let artifact_path: PathBuf = artifacts
        .next()
        .context("miden build produced no MASP artifact")?;
    if artifacts.next().is_some() {
        bail!("expected one MASP artifact in {}", artifact_dir.display());
    }

    let package_bytes = std::fs::read(&artifact_path)?;
    Package::read_from_bytes(&package_bytes)
        .context("Failed to deserialize package")
}
```

## MockChain Basics

### Creating a MockChain

Use the builder pattern to set up your test environment:

```rust
use miden_testing::{Auth, MockChain};

#[tokio::test]
async fn my_test() -> anyhow::Result<()> {
    // Create builder
    let mut builder = MockChain::builder();

    // Add accounts, faucets, notes...

    // Build the chain
    let mut mock_chain = builder.build()?;

    Ok(())
}
```

### Adding a Faucet

Faucets mint assets for testing:

```rust
use miden_protocol::account::auth::AuthScheme;

// Create a faucet with 1,000,000 max supply and 100 initial tokens
let faucet = builder.add_existing_basic_faucet(
    Auth::BasicAuth {
        auth_scheme: AuthScheme::Falcon512Poseidon2,
    },
    "TEST",           // Token symbol
    1_000_000,        // Max supply
    Some(100),        // Initial token supply
)?;
```

### Adding Wallet Accounts

Create accounts with initial assets:

```rust
use miden_protocol::{account::auth::AuthScheme, asset::FungibleAsset};

// Create a wallet with 100 tokens from the faucet
let sender = builder.add_existing_wallet_with_assets(
    Auth::BasicAuth {
        auth_scheme: AuthScheme::Falcon512Poseidon2,
    },
    [FungibleAsset::new(faucet.id(), 100)?.into()],
)?;
```

## Creating Custom Accounts

For accounts with custom components, create configuration helpers:

```rust title="integration/src/helpers.rs"
use miden_protocol::account::{component::InitStorageData, AccountType};

#[derive(Clone)]
pub struct AccountCreationConfig {
    pub account_type: AccountType,
    pub init_storage_data: InitStorageData,
}

impl Default for AccountCreationConfig {
    fn default() -> Self {
        Self {
            account_type: AccountType::Public,
            init_storage_data: InitStorageData::default(),
        }
    }
}
```

### Creating Account from Package

```rust
use std::{path::Path, sync::Arc};

use miden_protocol::{
    account::{
        component::InitStorageData, AccountBuilder, AccountComponent, StorageSlotName,
    },
    Word,
};
use miden_testing::{AccountState, Auth};

// Build the contract
let bank_package = Arc::new(build_project_in_dir(
    Path::new("../contracts/bank-account"),
    true,  // release mode
)?);

// Initialize values declared by the package's storage schema.
let initialized_slot =
    StorageSlotName::new("miden::component::miden_bank_account::initialized")
        .expect("Valid slot name");
let mut init_storage_data = InitStorageData::default();
init_storage_data.insert_value(&initialized_slot, Word::default())?;

let config = AccountCreationConfig {
    init_storage_data,
    ..Default::default()
};

// Instantiate the component from the package and add an existing account.
let component = AccountComponent::from_package(
    &bank_package,
    &config.init_storage_data,
)?;
let account = builder.add_account_from_builder(
    Auth::IncrNonce,
    AccountBuilder::new([7_u8; 32])
        .account_type(config.account_type)
        .with_component(component),
    AccountState::Exists,
)?;
```

## Creating Notes

### Creating Notes with Assets

```rust
use std::{path::Path, sync::Arc};

use miden_protocol::{asset::FungibleAsset, transaction::RawOutputNote};
use miden_standards::testing::note::NoteBuilder;

// Build note script
let deposit_note_package = Arc::new(build_project_in_dir(
    Path::new("../contracts/deposit-note"),
    true,
)?);

// Create assets to attach
let deposit_amount: u64 = 1000;
let fungible_asset = FungibleAsset::new(faucet.id(), deposit_amount)?;

// Create the note from the compiled package.
let mut rng = rand::rng();
let deposit_note = NoteBuilder::new(sender.id(), &mut rng)
    .package((*deposit_note_package).clone())
    .add_assets([fungible_asset.into()])
    .build()?;

// Add to MockChain
builder.add_output_note(RawOutputNote::Full(deposit_note.clone()));
```

### Creating Notes with Inputs

For notes that read parameters via `active_note::get_storage()`:

```rust
use miden_protocol::{Felt, Word};

// Note storage is a vector of Felts. Define and document the schema for each note.
let serial_num = Word::from([
    Felt::new(0x1234567890abcdef).expect("serial limb is below the field modulus"),
    Felt::new(0xfedcba0987654321).expect("serial limb is below the field modulus"),
    Felt::new(0xdeadbeefcafebabe).expect("serial limb is below the field modulus"),
    Felt::new(0x0123456789abcdef).expect("serial limb is below the field modulus"),
]);
let storage = vec![
    // Serial number [0-3]
    serial_num[0], serial_num[1], serial_num[2], serial_num[3],
    // Additional parameters [4-5]
    Felt::from(tag),
    Felt::ONE, // note_type (1 = Public)
];

let mut rng = rand::rng();
let note = NoteBuilder::new(sender.id(), &mut rng)
    .package((*note_package).clone())
    .note_storage(storage)?
    .build()?;
```

## Executing Transactions

### Basic Transaction Execution

```rust
// Build MockChain after adding all accounts and notes
let mut mock_chain = builder.build()?;

// Build and execute a transaction that consumes a committed note.
let executed_tx = mock_chain
    .build_transaction(account.id())
    .authenticated_input_note(note.id())
    .build()?;
let executed_tx = executed_tx.execute().await?;

// Add to pending transactions and prove block
mock_chain.add_pending_executed_transaction(&executed_tx)?;
mock_chain.prove_next_block()?;

// Read the updated account from committed chain state.
let account = mock_chain.committed_account(account.id())?;
```

### Transaction with Script

For transaction scripts (like initialization):

```rust
use miden_protocol::transaction::TransactionScript;

// Build the transaction script
let init_package = Arc::new(build_project_in_dir(
    Path::new("../contracts/init-tx-script"),
    true,
)?);

let init_tx_script = TransactionScript::from_package(&init_package)?;

// Execute with script
let executed_tx = mock_chain
    .build_transaction(account.id())
    .tx_script(init_tx_script)
    .build()?
    .execute()
    .await?;
```

### Transactions with Expected Output Notes

When your contract creates output notes, specify them:

```rust
use miden_protocol::{note::Note, transaction::RawOutputNote};

// Build the expected output note
let expected_note = Note::new(
    output_assets,
    output_metadata,
    recipient,
);

let executed_tx = mock_chain
    .build_transaction(account.id())
    .authenticated_input_note(input_note.id())
    .expected_output_note(RawOutputNote::Full(expected_note))
    .build()?
    .execute()
    .await?;
```

## Verifying State Changes

### Reading Storage After Transaction

```rust
use miden_protocol::{account::StorageMapKey, Felt, Word};

// After adding the transaction and proving its block...
let account = mock_chain.committed_account(account.id())?;

// Read Value storage (by slot name)
let value: Word = account.storage().get_item(&initialized_slot)?;

// Read Map storage (by slot name)
let key = Word::from([
    depositor.prefix().as_felt(),
    depositor.suffix(),
    faucet.id().prefix().as_felt(),
    faucet.id().suffix(),
]);
let balance = account
    .storage()
    .get_map_item(&balances_slot, StorageMapKey::new(key))?;

// Assert expected values
assert_eq!(
    balance,
    Word::from([Felt::from(1000_u32), Felt::ZERO, Felt::ZERO, Felt::ZERO]),
    "Balance should match deposited amount"
);
```

## Testing Error Conditions

### Expecting Transaction Failure

```rust
#[tokio::test]
async fn should_fail_without_initialization() -> anyhow::Result<()> {
    // Setup WITHOUT initialization step...

    // Execute and expect failure
    let result = mock_chain
        .build_transaction(account.id())
        .authenticated_input_note(note.id())
        .build()?
        .execute()
        .await;

    assert!(
        result.is_err(),
        "Expected transaction to fail, but it succeeded"
    );

    // Optionally check error message
    if let Err(e) = result {
        println!("Expected error: {}", e);
    }

    Ok(())
}
```

### Testing Constraint Violations

```rust
#[tokio::test]
async fn deposit_exceeds_max_should_fail() -> anyhow::Result<()> {
    // Create deposit with amount > MAX_DEPOSIT_AMOUNT
    let large_amount: u64 = 2_000_000;  // Max is 1,000,000

    // ... setup code ...

    let transaction = mock_chain
        .build_transaction(account.id())
        .authenticated_input_note(note.id())
        .build()?;
    let result = transaction.execute().await;

    assert!(
        result.is_err(),
        "Expected deposit to fail due to max limit"
    );

    Ok(())
}
```

## Complete Test Example

```rust title="integration/tests/counter_test.rs"
use std::{path::Path, sync::Arc};

use anyhow::Context;
use integration::helpers::build_project_in_dir;
use miden_protocol::{
    account::{
        auth::AuthScheme,
        component::InitStorageData,
        AccountBuilder,
        AccountComponent,
        AccountType,
        StorageMapKey,
        StorageSlotName,
    },
    crypto::rand::RandomCoin,
    note::NoteScript,
    transaction::RawOutputNote,
    Felt,
    Word,
};
use miden_standards::testing::note::NoteBuilder;
use miden_testing::{AccountState, Auth, MockChain};

const COUNTER_STORAGE_KEY: Word =
    Word::new([Felt::ZERO, Felt::ZERO, Felt::ZERO, Felt::ONE]);

fn counter_storage_slot() -> anyhow::Result<StorageSlotName> {
    Ok(StorageSlotName::new(
        "counter_account::counter_contract::count_map",
    )?)
}

#[tokio::test]
async fn counter_test() -> anyhow::Result<()> {
    let mut builder = MockChain::builder();

    let sender = builder.add_existing_wallet(Auth::BasicAuth {
        auth_scheme: AuthScheme::Falcon512Poseidon2,
    })?;

    let contract_package = Arc::new(build_project_in_dir(
        Path::new("../contracts/counter-account"),
        true,
    )?);
    let note_package = Arc::new(build_project_in_dir(
        Path::new("../contracts/increment-note"),
        true,
    )?);

    let counter_storage_slot = counter_storage_slot()?;
    let mut init_storage_data = InitStorageData::default();
    init_storage_data.insert_map_entry(
        counter_storage_slot.clone(),
        COUNTER_STORAGE_KEY,
        0_u64,
    )?;

    let counter_component = AccountComponent::from_package(&contract_package, &init_storage_data)
        .context("failed to build account component from counter package")?;
    let counter_account = builder.add_account_from_builder(
        Auth::BasicAuth {
            auth_scheme: AuthScheme::Falcon512Poseidon2,
        },
        AccountBuilder::new([3_u8; 32])
            .account_type(AccountType::Public)
            .with_component(counter_component),
        AccountState::Exists,
    )?;

    let mut note_rng = RandomCoin::new(Word::from(
        NoteScript::from_package(note_package.as_ref())
            .context("failed to build note script from package")?
            .root(),
    ));
    let counter_note = NoteBuilder::new(sender.id(), &mut note_rng)
        .package((*note_package).clone())
        .build()
        .context("failed to build counter note from package")?;

    builder.add_output_note(RawOutputNote::Full(counter_note.clone()));
    let mut mock_chain = builder.build()?;

    let transaction = mock_chain
        .build_transaction(counter_account.id())
        .authenticated_input_note(counter_note.id())
        .build()?;
    let executed_transaction = transaction.execute().await?;

    mock_chain.add_pending_executed_transaction(&executed_transaction)?;
    mock_chain.prove_next_block()?;

    let count = mock_chain
        .committed_account(counter_account.id())?
        .storage()
        .get_map_item(
            &counter_storage_slot,
            StorageMapKey::new(COUNTER_STORAGE_KEY),
        )?;

    assert_eq!(count[0].as_canonical_u64(), 1);

    Ok(())
}
```

For a step-by-step walkthrough, see
[Test Your Contract](../../get-started/your-first-smart-contract/test).

## Running Tests

```bash title=">_ Terminal"
# Run all tests
cargo test -p integration -- --nocapture

# Run the configured integration test target
cargo test -p integration --test my_test -- --nocapture

# Run with verbose output
RUST_LOG=debug cargo test -p integration -- --nocapture
```

## Key Takeaways

1. **MockChain Builder Pattern** - Use `MockChain::builder()` to set up test environments
2. **Build Contracts First** - Use `build_project_in_dir()` to compile contracts before tests
3. **Configure Storage Slots** - Match your contract's storage layout when creating accounts
4. **Read Committed State** - After proving a block, use `committed_account()` for updated state
5. **Prove Blocks** - Call `prove_next_block()` after adding executed transactions
6. **Test Failures** - Use `result.is_err()` to verify constraint violations

## Next Steps

- **[Debugging Guide](./debugging)** - Troubleshoot common issues
- **[Common Pitfalls](./pitfalls)** - Avoid known gotchas
- **[Miden Bank Tutorial](../miden-bank/)** - See testing in action
