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
Test passed!
test counter_test ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Understanding the Mockchain Test

Your project includes a comprehensive test file at `integration/tests/counter_test.rs` that demonstrates how to test the counter contract using the Mockchain. Let's walk through this test to understand the testing patterns:

<details class="normal-text">
<summary>Test File</summary>

```rust title="integration/tests/counter_test.rs"
use integration::helpers::{
    build_project_in_dir, create_testing_account_from_package, create_testing_note_from_package,
    AccountCreationConfig, NoteCreationConfig,
};

use miden_client::{
    account::{StorageMap, StorageMapKey, StorageSlot, StorageSlotName},
    auth::AuthSchemeId,
    transaction::RawOutputNote,
    Word,
};
use miden_testing::{Auth, MockChain};
use std::{path::Path, sync::Arc};

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

    // Create the counter account with initial storage and no-auth auth component
    let count_storage_key = Word::from([0u32, 0, 0, 1]);
    let initial_count = Word::default();

    // Use the slot name generated for the component's manifest namespace and field name.
    let counter_storage_slot =
        StorageSlotName::new("miden::component::miden_counter_account::count_map").unwrap();
    let storage_slots = vec![StorageSlot::with_map(
        counter_storage_slot.clone(),
        StorageMap::with_entries([(StorageMapKey::new(count_storage_key), initial_count)]).unwrap(),
    )];
    let counter_cfg = AccountCreationConfig {
        storage_slots,
        ..Default::default()
    };

    // create testing counter account
    let mut counter_account =
        create_testing_account_from_package(contract_package.clone(), counter_cfg).await?;

    // create testing increment note
    let counter_note = create_testing_note_from_package(
        note_package.clone(),
        sender.id(),
        NoteCreationConfig::default(),
    )?;

    // add counter account and note to mockchain
    builder.add_account(counter_account.clone())?;
    builder.add_output_note(RawOutputNote::Full(counter_note.clone()));

    // Build the mock chain
    let mut mock_chain = builder.build()?;
    // Build the transaction context
    let tx_context = mock_chain
        .build_tx_context(counter_account.id(), &[counter_note.id()], &[])?
        .build()?;

    // Execute the transaction
    let executed_transaction = tx_context.execute().await?;

    // Apply the account delta to the counter account
    counter_account.apply_delta(executed_transaction.account_delta())?;

    // Add the executed transaction to the mockchain
    mock_chain.add_pending_executed_transaction(&executed_transaction)?;
    mock_chain.prove_next_block()?;

    // Get the count from the updated counter account
    let count = counter_account
        .storage()
        .get_map_item(&counter_storage_slot, count_storage_key)
        .expect("Failed to get counter value from storage slot");

    // Assert that the count value is equal to 1 after executing the transaction
    assert_eq!(
        count,
        Word::from([0u32, 0, 0, 1]),
        "Count value is not equal to 1"
    );

    println!("Test passed!");
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
// Create the counter account with initial storage and no-auth auth component
let count_storage_key = Word::from([0u32, 0, 0, 1]);
let initial_count = Word::default();

let counter_storage_slot =
    StorageSlotName::new("miden::component::miden_counter_account::count_map").unwrap();
let storage_slots = vec![StorageSlot::with_map(
    counter_storage_slot.clone(),
    StorageMap::with_entries([(StorageMapKey::new(count_storage_key), initial_count)]).unwrap(),
)];
let counter_cfg = AccountCreationConfig {
    storage_slots,
    ..Default::default()
};

// Create testing entities
let mut counter_account = create_testing_account_from_package(contract_package.clone(), counter_cfg).await?;
let counter_note = create_testing_note_from_package(
    note_package.clone(),
    sender.id(),
    NoteCreationConfig::default(),
)?;
```

**What's happening:**

- We configure the **counter account's initial storage** with count = 0 at storage key `[0, 0, 0, 1]`
- We create the **testing counter account** from the compiled package using `create_testing_account_from_package()`
- We create the **testing increment note** using `create_testing_note_from_package()`
- These helper functions create test-specific versions optimized for the Mockchain environment

### 4. Adding Components to the Mockchain

```rust
builder.add_account(counter_account.clone())?;
builder.add_output_note(RawOutputNote::Full(counter_note.clone()));
let mut mock_chain = builder.build()?;
```

**What's happening:**

- We **add the counter account** to the mockchain builder
- We **add the increment note** as a full output note to the mockchain
- We **build the mockchain** - now we have a complete testing environment ready to use

### 5. Creating and Executing the Transaction

```rust
let tx_context = mock_chain
    .build_tx_context(counter_account.id(), &[counter_note.id()], &[])?
    .build()?;

let executed_transaction = tx_context.execute().await?;
```

**What's happening:**

- We **build the transaction context** using the counter account and counter note
- We **execute the transaction** - this runs the increment logic locally in the mockchain

### 6. Verifying the Results

```rust
// Apply the account delta to the counter account
counter_account.apply_delta(executed_transaction.account_delta())?;

// Add the executed transaction to the mockchain
mock_chain.add_pending_executed_transaction(&executed_transaction)?;
mock_chain.prove_next_block()?;

// Get the count from the updated counter account
let count = counter_account
    .storage()
    .get_map_item(&counter_storage_slot, count_storage_key)
    .expect("Failed to get counter value from storage slot");

// Assert that the count value is equal to 1 after executing the transaction
assert_eq!(
    count,
    Word::from([0u32, 0, 0, 1]),
    "Count value is not equal to 1"
);
```

**What's happening:**

- We **apply the account delta** from the executed transaction to the counter account to update its state
- We **add the executed transaction** to the mockchain
- We **read the counter value** from storage using the same key we initialized
- We **assert that the count equals 1** - verifying the increment operation worked correctly

The test verifies the complete flow: the increment note successfully increments the counter from 0 to 1, proving our smart contract works as expected.

## Next Steps

Congratulations! You've successfully completed the Miden smart contract quick start guide. You're now equipped to build more sophisticated smart contracts on Miden. Consider exploring:

To deepen your knowledge, we recommend exploring the following resources:

- Visit the [Tutorials section](../../tutorials/) for detailed, hands-on guides on topics such as contract interactions, advanced storage, custom note scripting, and integrating with external applications.
- For in-depth technical explanations, consult the [Reference section](../../../reference/) of the documentation. Here you'll find comprehensive information on Miden's architecture, account model, transaction lifecycle, and the underlying zero-knowledge technology that powers the network.

The foundational patterns and concepts you've practiced in this Quick Start will enable you to build complex, privacy-preserving applications on the Miden network. Continue with the resources above to take your development further!
