---
sidebar_position: 4
title: Test Your Contract
description: Learn how to write and run tests for your Miden smart contracts using the integration testing framework.
---

# Test Your Contract

In this final section, you'll learn how to test your counter contract using Miden's **Mockchain** - a purpose-built testing framework that enables fast, local testing without network dependencies.

## Test Structure and Organization

All tests for your smart contracts should be placed in the `integration/tests/` folder. This follows the same separation of concerns we've seen throughout the project:

- **`contracts/`**: Contains your contract source code
- **`integration/src/bin/`**: Contains deployment and interaction scripts
- **`integration/tests/`**: Contains all test files for your contracts

This structure keeps your contract logic clean while providing a dedicated space for comprehensive testing.

## Local Testing with Mockchain

For most testing scenarios, we use Miden's **Mockchain** - a local, mocked blockchain instance specifically designed for testing. While you can also create tests that use the Miden client for end-to-end testing and onchain interactions, the Mockchain provides the best developer experience for unit and integration testing.

### What is the Mockchain?

The Mockchain is Miden's purpose-built testing framework that provides several key advantages over testing against a live network:

- **Blazing Fast Tests**: Run tests locally without network latency or external dependencies
- **Full State Control**: Manipulate blockchain state precisely to create specific test scenarios
- **Simpler Code**: Cleaner, more focused test logic without network complexity
- **Deterministic Results**: Consistent test outcomes independent of network conditions
- **Debugging Capabilities**: Detailed inspection of transaction execution and state changes

This makes testing faster, more reliable, and easier to debug than testing against the testnet.

## Running the Tests

Execute your tests from the integration directory using the standard Cargo test command:

```bash title="Terminal"
cd integration
cargo test --release
```

You should see output confirming the test passes:

```text title="Expected Output"
running 1 test
test counter_test ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Understanding the Mockchain Test

Your project includes a comprehensive test file at `integration/tests/counter_test.rs` that demonstrates how to test the counter contract using the Mockchain. Let's walk through this test to understand the testing patterns:

<details class="normal-text">
<summary>Test File</summary>

```rust title="integration/tests/counter_test.rs"
use std::{path::Path, sync::Arc};

use anyhow::Context;
use integration::helpers::{build_project_in_dir, counter_storage_slot, COUNTER_STORAGE_KEY};
use miden_client::{
    account::{component::InitStorageData, AccountBuilder, AccountComponent, AccountType},
    auth::AuthSchemeId,
    crypto::RandomCoin,
    note::NoteScript,
    transaction::RawOutputNote,
    Word,
};
use miden_standards::testing::note::NoteBuilder;
use miden_testing::{AccountState, Auth, MockChain};

#[tokio::test]
async fn counter_test() -> anyhow::Result<()> {
    // Test that after executing the increment note, the counter value is incremented by 1
    let mut builder = MockChain::builder();

    // Create note sender account
    let sender = builder.add_existing_wallet(Auth::BasicAuth {
        auth_scheme: AuthSchemeId::Falcon512Poseidon2,
    })?;

    // Build contracts
    let contract_package = Arc::new(build_project_in_dir(
        Path::new("../contracts/counter-account"),
        true,
    )?);
    let note_package = Arc::new(build_project_in_dir(
        Path::new("../contracts/increment-note"),
        true,
    )?);

    // Create the counter account with its initial storage through the component schema.
    let counter_storage_slot = counter_storage_slot()?;
    let mut init_storage_data = InitStorageData::default();
    init_storage_data.insert_map_entry(counter_storage_slot.clone(), COUNTER_STORAGE_KEY, 0_u64)?;

    let counter_component = AccountComponent::from_package(&contract_package, &init_storage_data)
        .context("failed to build account component from counter package")?;
    let counter_account = builder.add_account_from_builder(
        Auth::BasicAuth {
            auth_scheme: AuthSchemeId::Falcon512Poseidon2,
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

    // add counter account and note to mockchain
    builder.add_output_note(RawOutputNote::Full(counter_note.clone()));

    // Build the mock chain
    let mut mock_chain = builder.build()?;

    // Build the transaction context
    let tx_context = mock_chain
        .build_tx_context(counter_account.clone(), &[counter_note.id()], &[])?
        .build()?;

    // Execute the transaction
    let executed_transaction = tx_context.execute().await?;

    // Add the executed transaction to the mockchain
    mock_chain.add_pending_executed_transaction(&executed_transaction)?;
    mock_chain.prove_next_block()?;

    // Get the count from the updated counter account
    let count = mock_chain
        .committed_account(counter_account.id())?
        .storage()
        .get_map_item(&counter_storage_slot, COUNTER_STORAGE_KEY)
        .expect("Failed to get counter value from storage slot");

    // Map values are returned as scalar words in `[value, 0, 0, 0]` layout.
    assert_eq!(
        count[0].as_canonical_u64(),
        1,
        "Count value is not equal to 1"
    );
    Ok(())
}
```

</details>

## Test Code Walkthrough

Let's break down this test step by step to understand how Mockchain testing works.

### 1. Setting Up the Mockchain Builder

```rust
let mut builder = MockChain::builder();
let sender = builder.add_existing_wallet(Auth::BasicAuth {
    auth_scheme: AuthSchemeId::Falcon512Poseidon2,
})?;
```

**What's happening:**

- We instantiate the **Mockchain builder**, which is used to configure our testing environment
- We create a **sender account** using basic authentication - this account will publish the increment note
- The builder pattern allows us to incrementally add all the components needed for our test

### 2. Building the Contract Packages

```rust
let contract_package = Arc::new(build_project_in_dir(
    Path::new("../contracts/counter-account"),
    true,
)?);
let note_package = Arc::new(build_project_in_dir(
    Path::new("../contracts/increment-note"),
    true,
)?);
```

**What's happening:**

- Just like in the deployment script, we **build both contract packages** (counter account and increment note)
- The `build_project_in_dir()` function compiles the Rust contracts into Miden packages
- We wrap them in `Arc` for efficient memory sharing across the test

### 3. Creating the Test Account and Note

```rust
// Create the counter account with its initial storage through the component schema.
let counter_storage_slot = counter_storage_slot()?;
let mut init_storage_data = InitStorageData::default();
init_storage_data.insert_map_entry(counter_storage_slot.clone(), COUNTER_STORAGE_KEY, 0_u64)?;

let counter_component = AccountComponent::from_package(&contract_package, &init_storage_data)
    .context("failed to build account component from counter package")?;
let counter_account = builder.add_account_from_builder(
    Auth::BasicAuth {
        auth_scheme: AuthSchemeId::Falcon512Poseidon2,
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
```

**What's happening:**

- We seed the **counter account's initial storage** through `InitStorageData`, mapping `COUNTER_STORAGE_KEY` to `0` inside the named slot returned by `counter_storage_slot()`
- `AccountComponent::from_package()` turns the compiled package plus that storage seed into an account component
- `builder.add_account_from_builder()` registers the account with the mockchain in the `AccountState::Exists` state, so it behaves like an already-deployed account
- The note is built with `NoteBuilder`, seeded from a `RandomCoin` derived from the note script's MAST root — this keeps note generation deterministic across test runs

### 4. Adding the Note to the Mockchain

```rust
builder.add_output_note(RawOutputNote::Full(counter_note.clone()));
let mut mock_chain = builder.build()?;
```

**What's happening:**

- We **add the increment note** as a full output note to the mockchain
- We **build the mockchain** - now we have a complete testing environment ready to use

The counter account does not need a separate `add_account()` call: `add_account_from_builder()` already registered it in the previous step.

### 5. Creating and Executing the Transaction

```rust
let tx_context = mock_chain
    .build_tx_context(counter_account.clone(), &[counter_note.id()], &[])?
    .build()?;

let executed_transaction = tx_context.execute().await?;
```

**What's happening:**

- We **build the transaction context** using the counter account and counter note
- We **execute the transaction** - this runs the increment logic locally in the mockchain

### 6. Verifying the Results

```rust
// Add the executed transaction to the mockchain
mock_chain.add_pending_executed_transaction(&executed_transaction)?;
mock_chain.prove_next_block()?;

// Get the count from the updated counter account
let count = mock_chain
    .committed_account(counter_account.id())?
    .storage()
    .get_map_item(&counter_storage_slot, COUNTER_STORAGE_KEY)
    .expect("Failed to get counter value from storage slot");

// Map values are returned as scalar words in `[value, 0, 0, 0]` layout.
assert_eq!(
    count[0].as_canonical_u64(),
    1,
    "Count value is not equal to 1"
);
```

**What's happening:**

- We **add the executed transaction** to the mockchain and prove the next block, which commits the new account state
- We **read the counter value** back from `mock_chain.committed_account()` — the committed state already reflects the transaction, so there is no need to apply the account delta by hand
- We **assert that the count equals 1** - verifying the increment operation worked correctly

Note the value layout: map values come back as words shaped `[value, 0, 0, 0]`, so the count lives in the first element, read here with `count[0].as_canonical_u64()`.

The test verifies the complete flow: the increment note successfully increments the counter from 0 to 1, proving our smart contract works as expected.

## Next Steps

Congratulations! You've successfully completed the Miden smart contract quick start guide. You're now equipped to build more sophisticated smart contracts on Miden. Consider exploring:

To deepen your knowledge, we recommend exploring the following resources:

- Visit the [Tutorials section](../../tutorials/) for detailed, hands-on guides on topics such as contract interactions, advanced storage, custom note scripting, and integrating with external applications.
- For in-depth technical explanations, consult the [Reference section](../../../reference/) of the documentation. Here you'll find comprehensive information on Miden's architecture, account model, transaction lifecycle, and the underlying zero-knowledge technology that powers the network.

The foundational patterns and concepts you've practiced in this Quick Start will enable you to build complex, privacy-preserving applications on the Miden network. Continue with the resources above to take your development further!
