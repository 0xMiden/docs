---
sidebar_position: 3
title: Notes & Transactions
description: Learn Miden's unique note-based transaction model for private asset transfers.
---

import { CodeTabs } from '@site/src/components';

# Notes & Transactions

Miden's transaction model is uniquely powerful, combining private asset transfers through notes with zero-knowledge proofs. Let's explore how to mint, consume, and send tokens using this innovative approach.

## Understanding Miden's Transaction Model

Traditional blockchains move tokens directly between account balances. Miden uses a more sophisticated **note-based system** that provides enhanced privacy and flexibility.

**Think of Notes Like Sealed Envelopes:**

- Alice puts 100 tokens in a sealed envelope (note) addressed to Bob
- She posts the envelope to the public board (network)
- Only Bob can open envelopes addressed to him
- When Bob opens it, the 100 tokens move to his vault

**Key Components:**

- **Notes**: Sealed containers that carry data and assets between accounts
- **P2ID (Pay-To-ID) Notes**: Notes addressed to a specific account ID (like Bob's address)
- **Nullifiers**: Prevent someone from opening the same envelope twice
- **Zero-Knowledge Proofs**: Prove transactions are valid without revealing private details

## The Two-Transaction Model

Miden uses a **two-transaction model** for asset transfers that provides enhanced privacy and scalability:

### Transaction 1: Sender Creates Note

- **Alice's account** creates a P2ID (Pay-To-ID) note containing 100 tokens
- The note specifies **Bob** as the only valid consumer
- Alice's balance decreases, note is available for consumption
- Alice's transaction is complete and final

### Transaction 2: Recipient Consumes Note

- **Bob's account** discovers the note (addressed to his ID)
- Bob creates a transaction to consume the note
- Tokens move from the note into Bob's vault
- Bob's balance increases, note is nullified

### Benefits

This approach provides several advantages over direct transfers:

1. **Privacy**: Alice and Bob's transactions are unlinkable
2. **Parallelization**: Multiple transactions can be processed concurrently, enabling simultaneous creation of notes.
3. **Flexibility**: Notes can include complex conditions (time locks, multi-sig, etc.)
4. **Scalability**: No global state synchronization required

## Set Up Development Environment

To run the code examples in this guide, you'll need to set up a development environment. If you haven't already, follow the setup instructions in the [Accounts](./accounts#set-up-development-environment) guide.

## Minting Tokens

**What is Minting?**
Minting in Miden creates new tokens and packages them into a **P2ID note** (Pay-to-ID note) addressed to a specific account. Unlike traditional blockchains where tokens appear directly in your balance, Miden uses a two-step process:

1. **Faucet mints tokens** → Creates a P2ID note containing the tokens
2. **Recipient consumes the note** → Tokens move into their account vault

**Key Concepts:**

- **P2ID Note**: A note that can only be consumed by the account it's addressed to
- **NoteType**: Determines visibility - `Public` notes are visible onchain and are stored by the Miden network, while `Private` notes are not stored by the network and must be exchanged directly between parties via other channels.
- **FungibleAsset**: Represents tokens that can be divided and exchanged (like currencies)

Let's see this in action:

<CodeTabs
tsFilename="src/lib/mint.ts"
rustFilename="integration/src/bin/mint.rs"
example={{
rust: {
code: `use miden_client::{
    account::{
        component::{AuthRpoFalcon512, BasicFungibleFaucet, BasicWallet},
        AccountBuilder, AccountStorageMode, AccountType,
    },
    asset::{FungibleAsset, TokenSymbol},
    auth::AuthSecretKey,
    builder::ClientBuilder,
    crypto::SecretKey,
    keystore::FilesystemKeyStore,
    note::NoteType,
    rpc::{Endpoint, TonicRpcClient},
    transaction::TransactionRequestBuilder,
    Felt,
};
use rand::{rngs::StdRng, RngCore};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize RPC connection
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));

    // Initialize keystore
    let keystore_path = std::path::PathBuf::from("./keystore");

    let keystore = Arc::new(FilesystemKeyStore::<StdRng>::new(keystore_path)?);

    let store_path = std::path::PathBuf::from("./store.sqlite3");
    let store_path_str = store_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid store path"))?;

    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    let mut client = ClientBuilder::new()
        .rpc(rpc_api)
        .sqlite_store(store_path_str)
        .authenticator(keystore.clone())
        .in_debug_mode(true.into())
        .build()
        .await?;

    client.sync_state().await?;

    //------------------------------------------------------------
    // CREATING A FAUCET AND MINTING TOKENS
    //------------------------------------------------------------

    // Faucet seed
    let mut init_seed = [0u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    // Faucet parameters
    let symbol = TokenSymbol::new("TEST")?;
    let decimals = 8;
    let max_supply = Felt::new(1_000_000);

    // Generate key pair
    let alice_key_pair = SecretKey::with_rng(client.rng());
    let faucet_key_pair = SecretKey::with_rng(client.rng());

    // Build the account
    let account_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::RegularAccountUpdatableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthRpoFalcon512::new(alice_key_pair.public_key()))
        .with_component(BasicWallet);

    // Build the faucet
    let faucet_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::FungibleFaucet)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthRpoFalcon512::new(faucet_key_pair.public_key()))
        .with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply)?);

    let (alice_account, alice_seed) = account_builder.build()?;
    let (faucet_account, faucet_seed) = faucet_builder.build()?;

    println!("Alice's account ID: {:?}", alice_account.id().to_hex());
    println!("Faucet account ID: {:?}", faucet_account.id().to_hex());

    // Add accounts to client
    client
        .add_account(&alice_account, Some(alice_seed), false)
        .await?;
    client
        .add_account(&faucet_account, Some(faucet_seed), false)
        .await?;

    // Add keys to keystore
    keystore.add_key(&AuthSecretKey::RpoFalcon512(alice_key_pair))?;
    keystore.add_key(&AuthSecretKey::RpoFalcon512(faucet_key_pair))?;

    let amount: u64 = 1000;
    let fungible_asset = FungibleAsset::new(faucet_account.id(), amount)?;

    // Build transaction request to mint fungible asset to Alice's account
    // NOTE: This transaction will create a P2ID note (a Miden note containing the minted asset)
    // for Alice's account. Alice will be able to consume these notes to get the fungible asset in her vault
    let transaction_request = TransactionRequestBuilder::new().build_mint_fungible_asset(
        fungible_asset,
        alice_account.id(),
        NoteType::Public,
        client.rng(),
    )?;

    // Create transaction and submit it to create P2ID notes for Alice's account
    let tx_result = client
        .new_transaction(faucet_account.id(), transaction_request)
        .await?;
    client.submit_transaction(tx_result.clone()).await?;
    client.sync_state().await?;

    println!(
        "Mint transaction submitted successfully, ID: {:?}",
        tx_result.executed_transaction().id().to_hex()
    );

    Ok(())
}
`},
  typescript: {
    code:`import { WebClient, AccountStorageMode, NoteType } from "@demox-labs/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    const nodeEndpoint = "https://rpc.testnet.miden.io:443";
    const client = await WebClient.createClient(nodeEndpoint);
    await client.syncState();

    // Creating Alice's account
    const alice = await client.newWallet(AccountStorageMode.public(), true);
    console.log("Alice's account ID:", alice.id().toString());

    // Creating a faucet account
    const symbol = "TEST";
    const decimals = 8;
    const initialSupply = BigInt(10_000_000 \* 10 \*\* decimals);
    const faucet = await client.newFaucet(
        AccountStorageMode.public(), // Public: account state is visible onchain
        false, // Mutable: account code cannot be upgraded later
        symbol, // Symbol of the token
        decimals, // Number of decimals
        initialSupply // Initial supply of tokens
    );
    console.log("Faucet account ID:", faucet.id().toString());

    // Creating mint transaction
    console.log("Minting 1000 tokens to Alice...");
    const mintTxRequest = client.newMintTransactionRequest(
        alice.id(), // Target account (who receives the tokens)
        faucet.id(), // Faucet account (who mints the tokens)
        NoteType.Public, // Note visibility (public = onchain)
        BigInt(1000) // Amount to mint (in base units)
    );
    const mintTx = await client.newTransaction(faucet.id(), mintTxRequest);
    await client.submitTransaction(mintTx);

    console.log(
    "Mint transaction submitted successfully, ID:",
    mintTx.executedTransaction().id().toHex()
    );
}
`
}
}}
/>

<details>
<summary>Expected output</summary>

```text
Alice's account ID: 0x49e27aa5fa5686102fde8e81b89999
Faucet account ID: 0x9796be9c72f137206676f7821a9968
Minting 1000 tokens to Alice...
Mint transaction submitted successfully, ID: 0x7a2dbde87ea2f4d41b396d6d3f6bdb9a8d7e2a51555fa57064a1657ad70fca06
```

</details>

## Consuming Notes

**Why Consume Notes?**
After minting creates a P2ID note containing tokens, the recipient must **consume** the note to actually receive the tokens in their account vault. This two-step process provides several benefits:

- **Privacy**: The mint transaction and consume transaction are unlinkable
- **Flexibility**: Recipients can consume notes when they choose
- **Atomic Operations**: Each step either succeeds completely or fails safely

**The Process:**

1. **Find consumable notes** addressed to your account
2. **Create a consume transaction** referencing the note IDs
3. **Submit the transaction** to move tokens into your vault

Here's how to consume notes programmatically:

<CodeTabs
tsFilename="src/lib/consume.ts"
rustFilename="integration/src/bin/consume.rs"
example={{
rust: {
code: `use miden_client::{
    account::{
        component::{AuthRpoFalcon512, BasicFungibleFaucet, BasicWallet},
        AccountBuilder, AccountStorageMode, AccountType,
    },
    asset::{FungibleAsset, TokenSymbol},
    auth::AuthSecretKey,
    builder::ClientBuilder,
    crypto::SecretKey,
    keystore::FilesystemKeyStore,
    note::NoteType,
    rpc::{Endpoint, TonicRpcClient},
    transaction::TransactionRequestBuilder,
    Felt,
};
use rand::{rngs::StdRng, RngCore};
use std::sync::Arc;
use tokio::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize RPC connection
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));

    // Initialize keystore
    let keystore_path = std::path::PathBuf::from("./keystore");

    let keystore = Arc::new(FilesystemKeyStore::<StdRng>::new(keystore_path)?);

    let store_path = std::path::PathBuf::from("./store.sqlite3");
    let store_path_str = store_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid store path"))?;

    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    let mut client = ClientBuilder::new()
        .rpc(rpc_api)
        .sqlite_store(store_path_str)
        .authenticator(keystore.clone())
        .in_debug_mode(true.into())
        .build()
        .await?;

    client.sync_state().await?;

    //------------------------------------------------------------
    // CREATING A FAUCET AND MINTING TOKENS
    //------------------------------------------------------------

    // Faucet seed
    let mut init_seed = [0u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    // Faucet parameters
    let symbol = TokenSymbol::new("TEST")?;
    let decimals = 8;
    let max_supply = Felt::new(1_000_000);

    // Generate key pair
    let alice_key_pair = SecretKey::with_rng(client.rng());
    let faucet_key_pair = SecretKey::with_rng(client.rng());

    // Build the account
    let account_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::RegularAccountUpdatableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthRpoFalcon512::new(alice_key_pair.public_key()))
        .with_component(BasicWallet);

    // Build the faucet
    let faucet_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::FungibleFaucet)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthRpoFalcon512::new(faucet_key_pair.public_key()))
        .with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply)?);

    let (alice_account, alice_seed) = account_builder.build()?;
    let (faucet_account, faucet_seed) = faucet_builder.build()?;

    println!("Alice's account ID: {:?}", alice_account.id().to_hex());
    println!("Faucet account ID: {:?}", faucet_account.id().to_hex());

    // Add accounts to client
    client
        .add_account(&alice_account, Some(alice_seed), false)
        .await?;
    client
        .add_account(&faucet_account, Some(faucet_seed), false)
        .await?;

    // Add keys to keystore
    keystore.add_key(&AuthSecretKey::RpoFalcon512(alice_key_pair))?;
    keystore.add_key(&AuthSecretKey::RpoFalcon512(faucet_key_pair))?;

    let amount: u64 = 1000;
    let fungible_asset = FungibleAsset::new(faucet_account.id(), amount)?;

    // Build transaction request to mint fungible asset to Alice's account
    // NOTE: This transaction will create a P2ID note (a Miden note containing the minted asset)
    // for Alice's account. Alice will be able to consume these notes to get the fungible asset in her vault
    let transaction_request = TransactionRequestBuilder::new().build_mint_fungible_asset(
        fungible_asset,
        alice_account.id(),
        NoteType::Public,
        client.rng(),
    )?;

    // Create transaction and submit it to create P2ID notes for Alice's account
    let tx_result = client
        .new_transaction(faucet_account.id(), transaction_request)
        .await?;
    client.submit_transaction(tx_result.clone()).await?;
    client.sync_state().await?;

    println!(
        "Mint transaction submitted successfully, ID: {:?}",
        tx_result.executed_transaction().id().to_hex()
    );

    //------------------------------------------------------------
    // CONSUMING P2ID NOTES
    //------------------------------------------------------------

    loop {
        // Sync state to get the latest block
        client.sync_state().await?;

        let consumable_notes = client
            .get_consumable_notes(Some(alice_account.id()))
            .await?;
        let note_ids = consumable_notes
            .iter()
            .map(|(note, _)| note.id())
            .collect::<Vec<_>>();

        if note_ids.len() == 0 {
            println!("Waiting for P2ID note to be committed...");
            tokio::time::sleep(Duration::from_secs(2)).await;
            continue;
        }

        let consume_tx_request = TransactionRequestBuilder::new().build_consume_notes(note_ids)?;

        // Create transaction and submit it to consume notes
        let consume_tx_result = client
            .new_transaction(alice_account.id(), consume_tx_request)
            .await?;

        println!(
            "Consume transaction submitted successfully, ID: {:?}",
            consume_tx_result.executed_transaction().id().to_hex()
        );

        client.submit_transaction(consume_tx_result.clone()).await?;
        client.sync_state().await?;

        let alice_account_record = client
            .get_account(alice_account.id())
            .await?
            .ok_or_else(|| anyhow::anyhow!("Account not found"))?;
        let alice_account = alice_account_record.account().clone();
        let vault = alice_account.vault();
        println!(
            "Alice's TEST token balance: {:?}",
            vault.get_balance(faucet_account.id())
        );

        break; // Exit the loop after consuming the note
    }

    Ok(())
}
`},
  typescript: {
    code:`import {
WebClient,
AccountStorageMode,
NoteType,
ConsumableNoteRecord,
} from "@demox-labs/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    const nodeEndpoint = "https://rpc.testnet.miden.io:443";
    const client = await WebClient.createClient(nodeEndpoint);
    await client.syncState();

    // Creating Alice's account
    const alice = await client.newWallet(AccountStorageMode.public(), true);
    console.log("Alice's account ID:", alice.id().toString());

    // Creating a faucet account
    const symbol = "TEST";
    const decimals = 8;
    const initialSupply = BigInt(10_000_000 \* 10 \*\* decimals);
    const faucet = await client.newFaucet(
        AccountStorageMode.public(), // Public: account state is visible onchain
        false, // Mutable: account code cannot be upgraded later
        symbol, // Symbol of the token
        decimals, // Number of decimals
        initialSupply // Initial supply of tokens
    );
    console.log("Faucet account ID:", faucet.id().toString());

    // Create transaction request to mint fungible asset to Alice's account
    // NOTE: This transaction will create a P2ID note (a Miden note containing the minted asset)
    // for Alice's account. Alice will be able to consume these notes to get the fungible asset in her vault
    console.log("Minting 1000 tokens to Alice...");
    const mintTxRequest = client.newMintTransactionRequest(
        alice.id(), // Target account (who receives the tokens)
        faucet.id(), // Faucet account (who mints the tokens)
        NoteType.Public, // Note visibility (public = onchain)
        BigInt(1000) // Amount to mint (in base units)
    );
    const mintTx = await client.newTransaction(faucet.id(), mintTxRequest);
    await client.submitTransaction(mintTx);

    console.log(
        "Mint transaction submitted successfully, ID:",
        mintTx.executedTransaction().id().toHex()
    );

    await client.syncState();

    let consumableNotes: ConsumableNoteRecord[] = [];
    while (consumableNotes.length === 0) {
        // Find consumable notes
        consumableNotes = await client.getConsumableNotes(alice.id());

        console.log("Waiting for note to be consumable...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const noteIds = consumableNotes.map((note) =>
        note.inputNoteRecord().id().toString()
    );

    // Create transaction request to consume notes
    // NOTE: This transaction will consume the notes and add the fungible asset to Alice's vault
    const consumeTxRequest = client.newConsumeTransactionRequest(noteIds);
    const consumeTx = await client.newTransaction(alice.id(), consumeTxRequest);
    await client.submitTransaction(consumeTx);
    console.log(
        "Consume transaction submitted successfully, ID:",
        consumeTx.executedTransaction().id().toHex()
    );

    console.log(
        "Alice's TEST token balance:",
        Number(alice.vault().getBalance(faucet.id()))
    );

    await client.syncState();
}
`
}
}}
/>

<details>
<summary>Expected output</summary>

```text
Alice's account ID: "0x49e27aa5fa5686102fde8e81b89999"
Faucet account ID: "0x9796be9c72f137206676f7821a9968"
Minting 1000 tokens to Alice...
Mint transaction submitted successfully, ID: "0x7a2dbde87ea2f4d41b396d6d3f6bdb9a8d7e2a51555fa57064a1657ad70fca06"
Waiting for note to be consumable...
Consume transaction submitted successfully, ID: "0xa75872c498ee71cd6725aef9411d2559094cec1e1e89670dbf99c60bb8843481"
Alice's TEST token balance: Ok(1000)
```

</details>

## Sending Tokens Between Accounts

**How Sending Works in Miden**
Sending tokens between accounts follows the same note-based pattern. The sender creates a new P2ID note containing tokens from their vault and addresses it to the recipient:

**The Flow:**

1. **Sender creates P2ID note** containing tokens and recipient's account ID
2. **Sender submits transaction** - their balance decreases, note is published
3. **Recipient discovers note** addressed to their account ID
4. **Recipient consumes note** - tokens move into their vault

This approach means Alice and Bob's transactions are completely separate and unlinkable, providing strong privacy guarantees.

Let's implement the complete flow - mint, consume, then send:

<CodeTabs
tsFilename="src/lib/send.ts"
rustFilename="integration/src/bin/send.rs"
example={{
rust: {
code: `use miden_client::{
    account::{
        component::{AuthRpoFalcon512, BasicFungibleFaucet, BasicWallet},
        AccountBuilder, AccountId, AccountStorageMode, AccountType,
    },
    asset::{FungibleAsset, TokenSymbol},
    auth::AuthSecretKey,
    builder::ClientBuilder,
    crypto::SecretKey,
    keystore::FilesystemKeyStore,
    note::{create_p2id_note, NoteType},
    rpc::{Endpoint, TonicRpcClient},
    transaction::{OutputNote, TransactionRequestBuilder},
    Felt,
};
use rand::{rngs::StdRng, RngCore};
use std::sync::Arc;
use tokio::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize RPC connection
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));

    // Initialize keystore
    let keystore_path = std::path::PathBuf::from("./keystore");

    let keystore = Arc::new(FilesystemKeyStore::<StdRng>::new(keystore_path)?);

    let store_path = std::path::PathBuf::from("./store.sqlite3");
    let store_path_str = store_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid store path"))?;

    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    let mut client = ClientBuilder::new()
        .rpc(rpc_api)
        .sqlite_store(store_path_str)
        .authenticator(keystore.clone())
        .in_debug_mode(true.into())
        .build()
        .await?;

    client.sync_state().await?;

    //------------------------------------------------------------
    // CREATING A FAUCET AND MINTING TOKENS
    //------------------------------------------------------------

    // Faucet seed
    let mut init_seed = [0u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    // Faucet parameters
    let symbol = TokenSymbol::new("TEST")?;
    let decimals = 8;
    let max_supply = Felt::new(1_000_000);

    // Generate key pair
    let alice_key_pair = SecretKey::with_rng(client.rng());
    let faucet_key_pair = SecretKey::with_rng(client.rng());

    // Build the account
    let account_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::RegularAccountUpdatableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthRpoFalcon512::new(alice_key_pair.public_key()))
        .with_component(BasicWallet);

    // Build the faucet
    let faucet_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::FungibleFaucet)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthRpoFalcon512::new(faucet_key_pair.public_key()))
        .with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply)?);

    let (alice_account, alice_seed) = account_builder.build()?;
    let (faucet_account, faucet_seed) = faucet_builder.build()?;

    println!("Alice's account ID: {:?}", alice_account.id().to_hex());
    println!("Faucet account ID: {:?}", faucet_account.id().to_hex());

    // Add accounts to client
    client
        .add_account(&alice_account, Some(alice_seed), false)
        .await?;
    client
        .add_account(&faucet_account, Some(faucet_seed), false)
        .await?;

    // Add keys to keystore
    keystore.add_key(&AuthSecretKey::RpoFalcon512(alice_key_pair))?;
    keystore.add_key(&AuthSecretKey::RpoFalcon512(faucet_key_pair))?;

    let amount: u64 = 1000;
    let fungible_asset = FungibleAsset::new(faucet_account.id(), amount)?;

    // Build transaction request to mint fungible asset to Alice's account
    // NOTE: This transaction will create a P2ID note (a Miden note containing the minted asset)
    // for Alice's account. Alice will be able to consume these notes to get the fungible asset in her vault
    let transaction_request = TransactionRequestBuilder::new().build_mint_fungible_asset(
        fungible_asset,
        alice_account.id(),
        NoteType::Public,
        client.rng(),
    )?;

    // Create transaction and submit it to create P2ID notes for Alice's account
    let tx_result = client
        .new_transaction(faucet_account.id(), transaction_request)
        .await?;
    client.submit_transaction(tx_result.clone()).await?;
    client.sync_state().await?;

    println!(
        "Mint transaction submitted successfully, ID: {:?}",
        tx_result.executed_transaction().id().to_hex()
    );

    //------------------------------------------------------------
    // CONSUMING P2ID NOTES
    //------------------------------------------------------------

    loop {
        // Sync state to get the latest block
        client.sync_state().await?;

        let consumable_notes = client
            .get_consumable_notes(Some(alice_account.id()))
            .await?;
        let note_ids = consumable_notes
            .iter()
            .map(|(note, _)| note.id())
            .collect::<Vec<_>>();

        if note_ids.len() == 0 {
            println!("Waiting for P2ID note to be committed...");
            tokio::time::sleep(Duration::from_secs(2)).await;
            continue;
        }

        let consume_tx_request = TransactionRequestBuilder::new().build_consume_notes(note_ids)?;

        // Create transaction and submit it to consume notes
        let consume_tx_result = client
            .new_transaction(alice_account.id(), consume_tx_request)
            .await?;

        println!(
            "Consume transaction submitted successfully, ID: {:?}",
            consume_tx_result.executed_transaction().id().to_hex()
        );

        client.submit_transaction(consume_tx_result.clone()).await?;
        client.sync_state().await?;

        let alice_account_record = client
            .get_account(alice_account.id())
            .await?
            .ok_or_else(|| anyhow::anyhow!("Account not found"))?;
        let alice_account = alice_account_record.account().clone();
        let vault = alice_account.vault();
        println!(
            "Alice's TEST token balance: {:?}",
            vault.get_balance(faucet_account.id())
        );

        break; // Exit the loop after consuming the note
    }

    //------------------------------------------------------------
    // SENDING TOKENS TO BOB
    //------------------------------------------------------------

    let bob_account_id = AccountId::from_hex("0x599a54603f0cf9000000ed7a11e379")?;
    let send_amount = 100;
    let fungible_asset_to_send = FungibleAsset::new(faucet_account.id(), send_amount)?;

    let p2id_note = create_p2id_note(
        alice_account.id(),
        bob_account_id,
        vec![fungible_asset_to_send.into()],
        NoteType::Public,
        Felt::new(0),
        client.rng(),
    )?;

    // Create transaction request to send P2ID note to Bob
    let send_p2id_note_transaction_request = TransactionRequestBuilder::new()
        .own_output_notes(vec![OutputNote::Full(p2id_note)])
        .build()?;

    // Create transaction and submit it to send P2ID note to Bob
    let send_p2id_note_tx_result = client
        .new_transaction(alice_account.id(), send_p2id_note_transaction_request)
        .await?;
    client
        .submit_transaction(send_p2id_note_tx_result.clone())
        .await?;
    client.sync_state().await?;

    println!(
        "Send 100 tokens to Bob note transaction ID: {:?}",
        send_p2id_note_tx_result
            .executed_transaction()
            .id()
            .to_hex()
    );

    Ok(())
}
`},
  typescript: {
    code:`import {
WebClient,
AccountStorageMode,
NoteType,
ConsumableNoteRecord,
AccountId,
} from "@demox-labs/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    const nodeEndpoint = "https://rpc.testnet.miden.io:443";
    const client = await WebClient.createClient(nodeEndpoint);
    await client.syncState();

    // Creating Alice's account
    const alice = await client.newWallet(AccountStorageMode.public(), true);
    console.log("Alice's account ID:", alice.id().toString());

    // Creating a faucet account
    const symbol = "TEST";
    const decimals = 8;
    const initialSupply = BigInt(10_000_000 \* 10 \*\* decimals);
    const faucet = await client.newFaucet(
        AccountStorageMode.public(), // Public: account state is visible onchain
        false, // Mutable: account code cannot be upgraded later
        symbol, // Symbol of the token
        decimals, // Number of decimals
        initialSupply // Initial supply of tokens
    );
    console.log("Faucet account ID:", faucet.id().toString());

    // Create transaction request to mint fungible asset to Alice's account
    // NOTE: This transaction will create a P2ID note (a Miden note containing the minted asset)
    // for Alice's account. Alice will be able to consume these notes to get the fungible asset in her vault
    console.log("Minting 1000 tokens to Alice...");
    const mintTxRequest = client.newMintTransactionRequest(
        alice.id(), // Target account (who receives the tokens)
        faucet.id(), // Faucet account (who mints the tokens)
        NoteType.Public, // Note visibility (public = onchain)
        BigInt(1000) // Amount to mint (in base units)
    );
    const mintTx = await client.newTransaction(faucet.id(), mintTxRequest);
    await client.submitTransaction(mintTx);

    console.log(
        "Mint transaction submitted successfully, ID:",
        mintTx.executedTransaction().id().toHex()
    );

    await client.syncState();

    let consumableNotes: ConsumableNoteRecord[] = [];
    while (consumableNotes.length === 0) {
        // Find consumable notes
        consumableNotes = await client.getConsumableNotes(alice.id());

        console.log("Waiting for note to be consumable...");
        await new Promise((resolve) => setTimeout(resolve, 3000));

    }

    const noteIds = consumableNotes.map((note) =>
        note.inputNoteRecord().id().toString()
    );

    // Create transaction request to consume notes
    // NOTE: This transaction will consume the notes and add the fungible asset to Alice's vault
    const consumeTxRequest = client.newConsumeTransactionRequest(noteIds);
    const consumeTx = await client.newTransaction(alice.id(), consumeTxRequest);
    await client.submitTransaction(consumeTx);
    console.log(
        "Consume transaction submitted successfully, ID:",
        consumeTx.executedTransaction().id().toHex()
    );

    console.log(
        "Alice's TEST token balance:",
        Number(alice.vault().getBalance(faucet.id()))
    );

    await client.syncState();

    // Send tokens from Alice to Bob
    const bobAccountId = "0x599a54603f0cf9000000ed7a11e379";
    console.log("Sending 100 tokens to Bob...");

    // Build transaction request to send tokens from Alice to Bob
    const sendTxRequest = client.newSendTransactionRequest(
        alice.id(), // Sender account
        AccountId.fromHex(bobAccountId), // Recipient account
        faucet.id(), // Asset ID (faucet that created the tokens)
        NoteType.Public, // Note visibility
        BigInt(100) // Amount to send
    );

    const sendTx = await client.newTransaction(alice.id(), sendTxRequest);
    await client.submitTransaction(sendTx);
    console.log("Send transaction submitted successfully!");

    await client.syncState();
}
`
}
}}
/>

<details>
<summary>Expected output</summary>

```text
Alice's account ID: 0xd6b8bb0ed10b1610282c513501778a
Faucet account ID: 0xe48c43d6ad6496201bcfa585a5a4b6
Minting 1000 tokens to Alice...
Mint transaction submitted successfully, ID: 0x948a0eef754068b3126dd3261b6b54214fa5608fb13c5e5953faf59bad79c75f
Consume transaction submitted successfully, ID: 0xc69ab84b784120abe858bb536aebda90bd2067695f11d5da93ab0b704f39ad78
Alice's TEST token balance: 100
Send 100 tokens to Bob note transaction ID: "0x51ac27474ade3a54adadd50db6c2b9a2ede254c5f9137f93d7a970f0bc7d66d5"
```

</details>

## Key Takeaways

**Miden's Note-Based Transaction Model:**

- **Notes** enable private asset transfers between accounts
- **Two-transaction model** provides privacy and parallelization benefits
- **Zero-knowledge proofs** validate transaction execution without revealing details
- **P2ID notes** target specific recipients using their account IDs

**Transaction Flow:**

1. **Mint** tokens to create notes containing assets
2. **Consume** notes to add assets to account vaults
3. **Send** tokens using P2ID notes targeted to recipients
4. **Nullify** consumed notes to prevent double-spending

This innovative approach provides unprecedented privacy and flexibility while maintaining the security guarantees of blockchain technology. The note-based model enables scalable, private transactions that can be processed in parallel without global state synchronization.

---
