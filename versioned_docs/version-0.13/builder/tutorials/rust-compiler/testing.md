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
    │   └── helpers.rs    # Test utilities
    └── tests/
        └── my_test.rs    # Test files
```

### Cargo.toml for Tests

```toml title="integration/Cargo.toml"
[package]
name = "integration"
version = "0.1.0"
edition = "2021"

[lib]
path = "src/helpers.rs"

[[test]]
name = "my_test"
path = "tests/my_test.rs"

[dependencies]
anyhow = "1.0"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }

# Miden dependencies
cargo-miden = { version = "0.7" }
miden-client = { version = "0.13", features = ["tonic", "testing"] }
miden-client-sqlite-store = { version = "0.13", package = "miden-client-sqlite-store" }
miden-core = { version = "0.20" }
miden-standards = { version = "0.13", default-features = false, features = ["testing"] }
miden-testing = "0.13"
miden-mast-package = { version = "0.20", default-features = false }
rand = { version = "0.9" }
```

## Building Contracts for Tests

Use `cargo-miden` to build your contracts programmatically:

```rust title="integration/src/helpers.rs"
use std::path::Path;
use anyhow::{bail, Context, Result};
use cargo_miden::{run, OutputType};
use miden_mast_package::Package;

pub fn build_project_in_dir(dir: &Path, release: bool) -> Result<Package> {
    let profile = if release { "--release" } else { "--debug" };
    let manifest_path = dir.join("Cargo.toml");
    let manifest_arg = manifest_path.to_string_lossy();

    let args = vec![
        "cargo", "miden", "build",
        profile,
        "--manifest-path", &manifest_arg,
    ];

    let output = run(args.into_iter().map(String::from), OutputType::Masm)
        .context("Failed to compile project")?
        .context("Cargo miden build returned None")?;

    let artifact_path = match output {
        cargo_miden::CommandOutput::BuildCommandOutput { output } => match output {
            cargo_miden::BuildOutput::Masm { artifact_path } => artifact_path,
            other => bail!("Expected Masm output, got {:?}", other),
        },
        other => bail!("Expected BuildCommandOutput, got {:?}", other),
    };

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
// Create a faucet with 1,000,000 total supply, decimals = 10
let faucet = builder.add_existing_basic_faucet(
    Auth::BasicAuth,
    "TEST",           // Token symbol
    1_000_000,        // Total supply
    Some(10),         // Decimals
)?;
```

### Adding Wallet Accounts

Create accounts with initial assets:

```rust
use miden_client::asset::FungibleAsset;

// Create a wallet with 100 tokens from the faucet
let sender = builder.add_existing_wallet_with_assets(
    Auth::BasicAuth,
    [FungibleAsset::new(faucet.id(), 100)?.into()],
)?;
```

## Creating Custom Accounts

For accounts with custom components, create configuration helpers:

```rust title="integration/src/helpers.rs"
use miden_client::account::{AccountStorageMode, AccountType, StorageSlot};

#[derive(Clone)]
pub struct AccountCreationConfig {
    pub account_type: AccountType,
    pub storage_mode: AccountStorageMode,
    pub storage_slots: Vec<StorageSlot>,
}

impl Default for AccountCreationConfig {
    fn default() -> Self {
        Self {
            account_type: AccountType::RegularAccountImmutableCode,
            storage_mode: AccountStorageMode::Public,
            storage_slots: vec![],
        }
    }
}
```

### Creating Account from Package

```rust
use miden_client::account::{StorageMap, StorageSlot, StorageSlotName};
use std::sync::Arc;

// Build the contract
let bank_package = Arc::new(build_project_in_dir(
    Path::new("../contracts/bank-account"),
    true,  // release mode
)?);

// Configure named storage slots
let initialized_slot =
    StorageSlotName::new("miden::component::miden_bank_account::initialized")
        .expect("Valid slot name");
let balances_slot =
    StorageSlotName::new("miden::component::miden_bank_account::balances")
        .expect("Valid slot name");

let config = AccountCreationConfig {
    storage_slots: vec![
        StorageSlot::with_value(initialized_slot, Word::default()),
        StorageSlot::with_map(
            balances_slot.clone(),
            StorageMap::with_entries([]).expect("Empty storage map"),
        ),
    ],
    ..Default::default()
};

// Create the account
let mut account = create_testing_account_from_package(
    bank_package.clone(),
    config,
).await?;

// Add to MockChain
builder.add_account(account.clone())?;
```

## Creating Notes

### Note Configuration

```rust title="integration/src/helpers.rs"
use miden_client::note::{NoteAssets, NoteTag, NoteType};
use miden_core::Felt;

pub struct NoteCreationConfig {
    pub note_type: NoteType,
    pub tag: NoteTag,
    pub assets: NoteAssets,
    pub inputs: Vec<Felt>,
}

impl Default for NoteCreationConfig {
    fn default() -> Self {
        Self {
            note_type: NoteType::Public,
            tag: NoteTag::new(0),
            assets: Default::default(),
            inputs: Default::default(),
        }
    }
}
```

### Creating Notes with Assets

```rust
use miden_client::asset::{Asset, FungibleAsset};
use miden_client::note::NoteAssets;

// Build note script
let deposit_note_package = Arc::new(build_project_in_dir(
    Path::new("../contracts/deposit-note"),
    true,
)?);

// Create assets to attach
let deposit_amount: u64 = 1000;
let fungible_asset = FungibleAsset::new(faucet.id(), deposit_amount)?;
let note_assets = NoteAssets::new(vec![Asset::Fungible(fungible_asset)])?;

// Create the note
let deposit_note = create_testing_note_from_package(
    deposit_note_package.clone(),
    sender.id(),  // Note sender
    NoteCreationConfig {
        assets: note_assets,
        ..Default::default()
    },
)?;

// Add to MockChain
builder.add_output_note(OutputNote::Full(deposit_note.clone()));
```

### Creating Notes with Inputs

For notes that read parameters via `active_note::get_inputs()`:

```rust
use miden_core::Felt;

// Note inputs are a vector of Felts
let inputs = vec![
    // Asset data [0-3]
    Felt::new(withdraw_amount),
    Felt::new(0),
    faucet.id().suffix(),
    faucet.id().prefix().as_felt(),
    // Serial number [4-7]
    Felt::new(0x1234567890abcdef),
    Felt::new(0xfedcba0987654321),
    Felt::new(0xdeadbeefcafebabe),
    Felt::new(0x0123456789abcdef),
    // Additional parameters
    Felt::new(tag as u64),
    Felt::new(1),  // note_type (1 = Public)
];

let note = create_testing_note_from_package(
    note_package.clone(),
    sender.id(),
    NoteCreationConfig {
        inputs,
        ..Default::default()
    },
)?;
```

## Executing Transactions

### Basic Transaction Execution

```rust
// Build MockChain after adding all accounts and notes
let mut mock_chain = builder.build()?;

// Build transaction context
// Args: (account_id, input_note_ids, expected_output_note_ids)
let tx_context = mock_chain
    .build_tx_context(account.id(), &[note.id()], &[])?
    .build()?;

// Execute
let executed_tx = tx_context.execute().await?;

// Apply state changes to local account copy
account.apply_delta(&executed_tx.account_delta())?;

// Add to pending transactions and prove block
mock_chain.add_pending_executed_transaction(&executed_tx)?;
mock_chain.prove_next_block()?;
```

### Transaction with Script

For transaction scripts (like initialization):

```rust
use miden_client::transaction::TransactionScript;

// Build the transaction script
let init_package = Arc::new(build_project_in_dir(
    Path::new("../contracts/init-tx-script"),
    true,
)?);

let init_program = init_package.unwrap_program();
let init_tx_script = TransactionScript::new((*init_program).clone());

// Execute with script
let tx_context = mock_chain
    .build_tx_context(account.id(), &[], &[])?
    .tx_script(init_tx_script)
    .build()?;

let executed_tx = tx_context.execute().await?;
```

### Transactions with Expected Output Notes

When your contract creates output notes, specify them:

```rust
use miden_client::transaction::OutputNote;

// Build the expected output note
let expected_note = Note::new(
    output_assets,
    output_metadata,
    recipient,
);

let tx_context = mock_chain
    .build_tx_context(account.id(), &[input_note.id()], &[])?
    .extend_expected_output_notes(vec![OutputNote::Full(expected_note)])
    .build()?;
```

## Verifying State Changes

### Reading Storage After Transaction

```rust
// After executing and applying delta...

// Read Value storage (by slot name)
let value: Word = account.storage().get_item(&initialized_slot)?;

// Read Map storage (by slot name)
let key = Word::from([
    depositor.prefix().as_felt(),
    depositor.suffix(),
    faucet.id().prefix().as_felt(),
    faucet.id().suffix(),
]);
let balance = account.storage().get_map_item(&balances_slot, key)?;

// Assert expected values
assert_eq!(
    balance,
    Word::from([Felt::new(0), Felt::new(0), Felt::new(0), Felt::new(1000)]),
    "Balance should match deposited amount"
);
```

## Testing Error Conditions

### Expecting Transaction Failure

```rust
#[tokio::test]
async fn should_fail_without_initialization() -> anyhow::Result<()> {
    // Setup WITHOUT initialization step...

    let tx_context = mock_chain
        .build_tx_context(account.id(), &[note.id()], &[])?
        .build()?;

    // Execute and expect failure
    let result = tx_context.execute().await;

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

    let result = tx_context.execute().await;

    assert!(
        result.is_err(),
        "Expected deposit to fail due to max limit"
    );

    Ok(())
}
```

## Complete Test Example

```rust title="integration/tests/deposit_test.rs"
use integration::helpers::{
    build_project_in_dir, create_testing_account_from_package,
    create_testing_note_from_package, AccountCreationConfig, NoteCreationConfig,
};
use miden_client::{
    account::{StorageMap, StorageSlot, StorageSlotName},
    asset::{Asset, FungibleAsset},
    note::NoteAssets,
    transaction::{OutputNote, TransactionScript},
    Felt, Word,
};
use miden_testing::{Auth, MockChain};
use std::{path::Path, sync::Arc};

#[tokio::test]
async fn deposit_test() -> anyhow::Result<()> {
    // 1. Setup MockChain builder
    let mut builder = MockChain::builder();

    // 2. Create faucet and sender
    let faucet = builder.add_existing_basic_faucet(Auth::BasicAuth, "TEST", 1000, Some(10))?;
    let sender = builder.add_existing_wallet_with_assets(
        Auth::BasicAuth,
        [FungibleAsset::new(faucet.id(), 100)?.into()],
    )?;

    // 3. Build contracts
    let bank_package = Arc::new(build_project_in_dir(
        Path::new("../contracts/bank-account"), true
    )?);
    let deposit_note_package = Arc::new(build_project_in_dir(
        Path::new("../contracts/deposit-note"), true
    )?);
    let init_tx_script_package = Arc::new(build_project_in_dir(
        Path::new("../contracts/init-tx-script"), true
    )?);

    // 4. Create bank account with named storage slots
    let initialized_slot =
        StorageSlotName::new("miden::component::miden_bank_account::initialized")
            .expect("Valid slot name");
    let balances_slot =
        StorageSlotName::new("miden::component::miden_bank_account::balances")
            .expect("Valid slot name");

    let bank_cfg = AccountCreationConfig {
        storage_slots: vec![
            StorageSlot::with_value(initialized_slot, Word::default()),
            StorageSlot::with_map(
                balances_slot.clone(),
                StorageMap::with_entries([]).expect("Empty storage map"),
            ),
        ],
        ..Default::default()
    };
    let mut bank_account = create_testing_account_from_package(
        bank_package.clone(), bank_cfg
    ).await?;

    // 5. Create deposit note
    let deposit_amount: u64 = 1000;
    let fungible_asset = FungibleAsset::new(faucet.id(), deposit_amount)?;
    let note_assets = NoteAssets::new(vec![Asset::Fungible(fungible_asset)])?;
    let deposit_note = create_testing_note_from_package(
        deposit_note_package.clone(),
        sender.id(),
        NoteCreationConfig { assets: note_assets, ..Default::default() },
    )?;

    // 6. Add to builder and build chain
    builder.add_account(bank_account.clone())?;
    builder.add_output_note(OutputNote::Full(deposit_note.clone()));
    let mut mock_chain = builder.build()?;

    // 7. Initialize bank
    let init_program = init_tx_script_package.unwrap_program();
    let init_tx_script = TransactionScript::new((*init_program).clone());
    let init_tx_context = mock_chain
        .build_tx_context(bank_account.id(), &[], &[])?
        .tx_script(init_tx_script)
        .build()?;
    let executed_init = init_tx_context.execute().await?;
    bank_account.apply_delta(&executed_init.account_delta())?;
    mock_chain.add_pending_executed_transaction(&executed_init)?;
    mock_chain.prove_next_block()?;

    // 8. Execute deposit
    let tx_context = mock_chain
        .build_tx_context(bank_account.id(), &[deposit_note.id()], &[])?
        .build()?;
    let executed_tx = tx_context.execute().await?;
    bank_account.apply_delta(&executed_tx.account_delta())?;
    mock_chain.add_pending_executed_transaction(&executed_tx)?;
    mock_chain.prove_next_block()?;

    // 9. Verify balance
    let depositor_key = Word::from([
        sender.id().prefix().as_felt(),
        sender.id().suffix(),
        faucet.id().prefix().as_felt(),
        faucet.id().suffix(),
    ]);
    let balance = bank_account.storage().get_map_item(&balances_slot, depositor_key)?;
    let expected = Word::from([
        Felt::new(0), Felt::new(0), Felt::new(0), Felt::new(deposit_amount)
    ]);
    assert_eq!(balance, expected, "Balance should match deposit");

    println!("Deposit test passed!");
    Ok(())
}
```

## Running Tests

```bash title=">_ Terminal"
# Run all tests
cargo test -p integration -- --nocapture

# Run specific test
cargo test -p integration deposit_test -- --nocapture

# Run with verbose output
RUST_LOG=debug cargo test -p integration -- --nocapture
```

## Key Takeaways

1. **MockChain Builder Pattern** - Use `MockChain::builder()` to set up test environments
2. **Build Contracts First** - Use `build_project_in_dir()` to compile contracts before tests
3. **Configure Storage Slots** - Match your contract's storage layout when creating accounts
4. **Apply Deltas** - Always call `apply_delta()` on local account copies after transactions
5. **Prove Blocks** - Call `prove_next_block()` after adding executed transactions
6. **Test Failures** - Use `result.is_err()` to verify constraint violations

:::tip View Complete Source
See the complete test implementations in the [miden-bank repository](https://github.com/keinberger/miden-bank/tree/main/integration/tests).
:::

## Next Steps

- **[Debugging Guide](./debugging)** - Troubleshoot common issues
- **[Common Pitfalls](./pitfalls)** - Avoid known gotchas
- **[Miden Bank Tutorial](./miden-bank/)** - See testing in action
