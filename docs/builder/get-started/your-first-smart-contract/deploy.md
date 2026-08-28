---
sidebar_position: 3
title: Deploy Your Contract
description: Learn about the integration folder and deploy your counter contract to the Miden testnet.
---

# Deploy Your Contract

In this section, you'll learn about how to deploy and interact with your counter contract using the included "increment-count" scripts.

## Understanding the Integration Folder

The `integration/` folder is a crucial part of your Miden project workspace. It serves as the command center for all interactions with your smart contracts. Let's explore its structure and purpose.

Navigate to your project's integration folder:

```bash title=">_ Terminal"
cd integration
ls -la
```

You'll see a structure like:

```text
integration/
├── Cargo.toml                  # Integration crate configuration
├── src/
│   ├── bin/                    # Executable scripts for onchain interactions
│   │   └── increment_count.rs  # Script to deploy and increment counter
│   ├── helpers.rs              # Temporary helper file
│   └── lib.rs                  # Exports helpers
└── tests/                      # Integration tests
    └── counter_test.rs         # Tests for counter contract
```

## Purpose of the Integration Folder

The integration folder serves two essential functions in Miden development:

### 1. Contract Interaction Scripts (Binary Executables)

Think of the scripts in `src/bin/` as Miden's equivalent to [**Foundry scripts**](https://www.getfoundry.sh/forge/scripting). These are executable Rust binaries that handle all your contract interactions:

- **Contract Deployment**: Scripts that create and deploy accounts to the network
- **Function/Procedure Calls**: Scripts that interact with deployed contracts through notes or [transaction scripts](/reference/protocol/transaction#transaction-lifecycle)
- **State Queries**: Scripts that read contract state from the network
- **Operations**: Scripts for contract upgrades, configuration changes, etc.

Each binary is designed to handle a specific task.

### 2. Testing Infrastructure

All testing logic for your smart contracts lives here:

- **Integration Tests**: End-to-end tests that verify contract behavior on Testnet
- **Mockchain Tests**: Local testing using Miden's testing framework

This separation ensures your contract logic in `contracts/` remains clean and focused while all interaction complexity is managed in the integration layer.

## The Increment Count Script

Let's examine the `increment_count.rs` script located at `integration/src/bin/increment_count.rs`. This script demonstrates the complete lifecycle of deploying and interacting with your counter contract.

The script performs these key operations:

1. **Sets up a Miden client** connected to the testnet
2. **Builds both contract packages** (counter account and increment note)
3. **Creates the counter account** with initial storage configuration
4. **Creates a sender account** for publishing notes
5. **Creates and publishes the increment note**
6. **Consumes the note** to trigger the counter increment

### Running the Script

Execute the increment script to deploy your contract:

```bash title=">_ Terminal"
cd integration
cargo run --bin increment_count --release
```

<details>
<summary>Expected Output</summary>

```text
Latest block: 1238402
Account ID: V1(AccountIdV1 { suffix: 6091438912547090176, prefix: 14314767458661568337 })
Sender account ID: "0x7d9c7007a5773c116bc58f9f28762b"
Counter note hash: "0xa3642c5eb08d8298a2fb8ed7f268f13c4139771c77540768a7347c882f47ab4f"
Note publish transaction ID: "0xfc190c8edbf972115cd5f00b22c8eac06c9515d0403b84ff697efa7093d6b8a7"
Consume transaction ID: "0xa1aa7971e146710df74a674b7e99d1968bec8d2db1c4da6077a7e22843c92045"
```

</details>

Congratulations, you have successfully deployed the Counter Contract to the Miden Testnet, and incremented its count by one! You can verify your transaction on [MidenScan](https://testnet.midenscan.com) by searching for your transaction ID.

### What Happens During Execution

The script demonstrates Miden's deployment flow:

1. **Contract Building**: The script compiles both the counter account and increment note contracts
2. **Account Creation**: Creates a counter account with initial storage (counter value = 0)
3. **Note Publishing**: Creates an increment note and publishes it to the network
4. **Note Consumption**: The counter account consumes the note, executing the increment logic
5. **State Update**: The counter value increases and the change is recorded onchain

This process shows how Miden contracts are deployed through state changes rather than separate deployment transactions.

**Miden's Deployment Flow**: In Miden, accounts (contracts) become visible onchain only when they undergo a state change. Simply creating an account locally doesn't deploy it - the account must participate in a transaction that modifies its state. In our case, by incrementing the counter, we're effectively "deploying" the contract and making it visible on the Miden testnet explorer. This is why the increment operation serves both as the deployment and the first interaction with the contract.

## How the Scripts Work

The integration scripts connect to the Miden client and compile each contract by invoking `miden build` as a separate process. After each build, the helper loads the generated Miden package into the native client. You don't need to build the contracts manually before running the script.

Next, we look into how the scripts convert your Rust contract code into deployable Miden contracts.

## Script Breakdown

Let's examine key parts of the increment script:

### Client Setup

```rust
let ClientSetup { mut client, keystore } = setup_client().await?;
let sync_summary = client.sync_state().await?;
```

This establishes a connection to the Miden testnet and synchronizes with the latest network state.

### Building Contracts from Source

The first step is building the Rust contracts into Miden packages:

```rust
// Build the counter account contract from source
let counter_package = Arc::new(
    build_project_in_dir(Path::new("../contracts/counter-account"), true)
        .context("Failed to build counter account contract")?
);

// Build the increment note script from source
let note_package = Arc::new(
    build_project_in_dir(Path::new("../contracts/increment-note"), true)
        .context("Failed to build increment note contract")?
);
```

The `build_project_in_dir()` function:

- Takes the path to a contract project
- Invokes `miden build` in a separate process, using `--release` when requested
- Resolves the generated `.masp` artifact under the project's `target/miden/` directory
- Reads and deserializes the compiled package for the native client

These packages contain all the information needed to deploy and interact with your contracts on the Miden network.

### Converting Packages to Deployable Accounts

Once we have the compiled packages, we convert them into deployable accounts and notes:

```rust
// Configure initial storage for the counter account.
let counter_storage_slot = counter_storage_slot()?;
let mut init_storage_data = InitStorageData::default();
init_storage_data
    .insert_map_entry(counter_storage_slot, COUNTER_STORAGE_KEY, 0_u64)
    .context("Failed to seed counter storage")?;
let counter_cfg = AccountCreationConfig {
    init_storage_data,
    ..Default::default()
};

// Convert the counter package into a deployable account
let counter_account = create_account_from_package(
    &mut client,
    counter_package.clone(),
    counter_cfg
)
.await
.context("Failed to create counter account")?;
```

The `create_account_from_package()` function:

- Takes the compiled contract package
- Combines it with the provided configuration (storage, settings, etc.)
- Creates a deployable Miden account that can be used in transactions

**Important**: Accounts that use storage must have that storage seeded when instantiating the account. Storage slots are identified by name rather than index. The slot name follows the pattern `<package>::<interface>::<field_name>`, derived from the component's manifest namespace. We seed the storage with:

- A named `StorageMap` slot, returned by the `counter_storage_slot()` helper (`counter_account::counter_contract::count_map`)
- The counter key `COUNTER_STORAGE_KEY` (`[0, 0, 0, 1]`), mapped to the initial count `0`

`InitStorageData` carries these seed values into `AccountComponent::from_package()`, which the helper calls for you.

This pre-initialization ensures the account's storage is properly configured before deployment.

### Converting Packages to Executable Notes

Similarly, we convert the note package into an executable note:

```rust
// Build the increment note directly from the compiled package.
let counter_note = NoteBuilder::new(sender_account.id(), client.rng())
    .package((*note_package).clone())
    .tag(0)
    .build()
    .context("Failed to create counter note from package")?;

// Publish the note to the network
let note_publish_request = TransactionRequestBuilder::new()
    .own_output_notes(vec![counter_note.clone()])
    .build()
    .context("Failed to build note publish transaction request")?;
```

`NoteBuilder` (from `miden_standards::testing::note`):

- Takes the sender account ID and the client's RNG
- Accepts the compiled note script package via `.package()`
- Produces an executable note containing the increment script logic
- The note can then be published to the network and consumed by the target (counter) account

This demonstrates the complete workflow: Rust source code → compiled packages → deployable accounts/notes → network transactions.

### Note Consumption

```rust
let consume_note_request = TransactionRequestBuilder::new()
    .input_notes([(counter_note.clone(), None)])
    .build()
    .context("Failed to build consume note transaction request")?;

let consume_tx_id = client
    .submit_new_transaction(counter_account.id(), consume_note_request)
    .await
    .context("Failed to create consume note transaction")?;
```

The counter account consumes the increment note, executing the note script which calls the counter's increment function.

## Next Steps

Congratulations! You've successfully deployed and interacted with your first Miden smart contract. The integration folder provides the foundation for managing all aspects of your contract lifecycle.

This completes the core smart contract development workflow on Miden. You're now equipped to build and deploy your own smart contracts using these patterns and tools!
