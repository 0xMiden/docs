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

Think of the scripts in `src/bin/` as Miden's equivalent to [**Foundry scripts**](https://getfoundry.sh/guides/scripting-with-solidity). These are executable Rust binaries that handle all your contract interactions:

- **Contract Deployment**: Scripts that create and deploy accounts to the network
- **Function/Procedure Calls**: Scripts that interact with deployed contracts through notes or [transaction scripts](/core-concepts/protocol/transaction#transaction-lifecycle)
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
Account ID: V0(AccountIdV0 { prefix: 14134910893364381952, suffix: 3644349760121494784 })
Sender account ID: "0xd85b347218c5a80052dbd47b2f36ad"
Counter note hash: "0xf0e821396a896eb9983e682bc056021d57ddcaa43082f34597bf9e026421e566"
Note publish transaction ID: "0xc6f080855724402cadf26650ffe993fe97a127a8f6c9c82ec621960e936e6d732"
Trace with id 240 emitted at step 2679 in context 2666
Trace with id 252 emitted at step 2689 in context 2666
... (trace output omitted)
Consume transaction ID: "0x2d1d8510e546ce0fbc22fa7d1a82322259d73cd1d7e0ca86622d0be70fab0548"
Account delta: AccountDelta { ... storage: AccountStorageDelta { ... maps: {0: StorageMapDelta({...: Word([0, 0, 0, 1])})} }, ... nonce_delta: 1 }
```

:::note
The `Trace with id ... emitted at step ...` lines are debug output from the Miden VM and can be safely ignored. Your actual account IDs and transaction IDs will differ from this example.
:::

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

The integration scripts work by connecting to the Miden client and then building contracts from the Miden package files. These package files are generated when you run `miden build` inside each contract directory, but the scripts handle this compilation step automatically - you don't need to manually build the contracts before running the scripts.

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

- Takes the path to your contract's Rust source code
- Compiles the Rust code into a Miden package (`.masp` file)
- Generates a package containing the compiled contract bytecode and metadata
- This is equivalent to manually running `miden build` in each contract directory

These packages contain all the information needed to deploy and interact with your contracts on the Miden network.

### Converting Packages to Deployable Accounts

Once we have the compiled packages, we convert them into deployable accounts and notes:

```rust
// Configure initial storage for the counter account
let count_storage_key = Word::from([Felt::new(0), Felt::new(0), Felt::new(0), Felt::new(1)]);
let initial_count = Word::from([Felt::new(0), Felt::new(0), Felt::new(0), Felt::new(0)]);

// The slot name is constructed as:
// `miden::component::[to_underscore(Cargo.toml:package.metadata.component.package)]::[field_name]`
let counter_storage_slot =
    StorageSlotName::new("miden::component::miden_counter_account::count_map").unwrap();
let storage_slots = vec![StorageSlot::with_map(
    counter_storage_slot.clone(),
    StorageMap::with_entries([(count_storage_key, initial_count)]).unwrap(),
)];
let counter_cfg = AccountCreationConfig {
    storage_slots,
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

**Important**: Accounts that use storage must have their storage slots specified when instantiating the account. In v0.13, storage slots are identified by name rather than index. The slot name follows the pattern `miden::component::<package_name>::<field_name>`. We define the storage configuration with:

- A named `StorageMap` slot (`miden::component::miden_counter_account::count_map`)
- The counter key `[0, 0, 0, 1]` with initial value `[0, 0, 0, 0]` (representing count = 0)

This pre-initialization ensures the account's storage is properly configured before deployment.

### Converting Packages to Executable Notes

Similarly, we convert the note package into an executable note:

```rust
// Convert the increment note package into an executable note
let counter_note = create_note_from_package(
    &mut client,
    note_package.clone(),
    sender_account.id(),
    NoteCreationConfig::default()
)
.context("Failed to create counter note from package")?;

// Publish the note to the network
let note_publish_request = TransactionRequestBuilder::new()
    .own_output_notes(vec![OutputNote::Full(counter_note.clone())])
    .build()
    .context("Failed to build note publish transaction request")?;
```

The `create_note_from_package()` function:

- Takes the compiled note script package
- Combines it with the sender account ID and configuration
- Creates an executable note containing the increment script logic
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
