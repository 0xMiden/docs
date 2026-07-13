---
sidebar_position: 4
title: Read Storage Values
description: Learn how to query account storage data and interact with deployed smart contracts.
---

import { CodeTabs } from '@site/src/components';

# Read Storage Values

Let's explore how to interact with public accounts and retrieve their storage data.

## Understanding Account Storage

Miden accounts contain several types of data you can read.

**Account Components:**

- **Vault**: Contains the account's assets (tokens)
- **Storage**: Key-value data store with up to 255 slots
- **Code**: The account's smart contract logic (MAST root)
- **Nonce**: Nonce that increments with each state change to prevent double spend

**Storage Visibility:**

- **Public accounts**: All data is publicly accessible and can be read by anyone
- **Private accounts**: Only commitments are public; full data is held privately

## Set Up Development Environment

To run the code examples in this guide, you'll need to set up a development environment. If you haven't already, follow the setup instructions in the [Accounts](./accounts#set-up-development-environment) guide.

## Reading from a Public Smart Contract

Let's interact with a counter contract deployed on the Miden testnet. This contract maintains a simple counter value in a named storage map slot.

### Reading the Count of a Counter contract

<CodeTabs
tsFilename="src/lib/read-count.ts"
rustFilename="integration/src/bin/read-count.rs"
example={{
rust: {
code: `use miden_client::{
    account::{Account, AccountId, StorageSlotName},
    builder::ClientBuilder,
    keystore::FilesystemKeyStore,
    rpc::{Endpoint, GrpcClient},
    Felt, Word,
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize RPC connection
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_client = Arc::new(GrpcClient::new(&endpoint, timeout_ms));

    // Initialize keystore
    let keystore_path = std::path::PathBuf::from("./keystore");
    let keystore =
        Arc::new(FilesystemKeyStore::new(keystore_path).unwrap());

    let store_path = std::path::PathBuf::from("./store.sqlite3");

    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    let mut client = ClientBuilder::new()
        .rpc(rpc_client)
        .sqlite_store(store_path)
        .authenticator(keystore.clone())
        .in_debug_mode(true.into())
        .build()
        .await?;

    client.sync_state().await?;

    //------------------------------------------------------------
    // READ PUBLIC STATE OF THE COUNTER ACCOUNT
    //------------------------------------------------------------

    let counter_account_id = AccountId::from_hex("0x224a96d294e10d006aef3d4f1b0876")?;

    client.import_account_by_id(counter_account_id).await?;

    let counter_account: Account = client
        .get_account(counter_account_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Account not found"))?
        .try_into()?;

    // Read the count from the counter account's named storage map slot
    let slot_name = StorageSlotName::new(
        "miden::component::miden_counter_account::count_map"
    )?;
    let count_key = Word::from([Felt::new(0), Felt::new(0), Felt::new(0), Felt::new(1)]);
    let count = counter_account
        .storage()
        .get_map_item(&slot_name, count_key)?;

    println!("Count: {:?}", count);

    Ok(())
}
` },
  typescript: {
    code:`import { WebClient, AccountId, Word } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    const nodeEndpoint = "https://rpc.testnet.miden.io:443";

    // Initialize client
    const client = await WebClient.createClient(nodeEndpoint);
    await client.syncState();

    const accountId = AccountId.fromHex("0x224a96d294e10d006aef3d4f1b0876");

    // Import the account into the client's database
    await client.importAccountById(accountId);
    const counter = await client.getAccount(accountId);

    // Get the count from the counter account by querying its storage map
    // using the named storage slot and counter key.
    const slotName = "miden::component::miden_counter_account::count_map";
    const counterKey = new Word(BigUint64Array.from([0n, 0n, 0n, 1n]));
    const count = counter?.storage().getMapItem(slotName, counterKey);

    // The count value is a WORD (array of 4 u64 values).
    // The 4th value is the counter number.
    console.log("Count:", Number(count?.toU64s()[3]));
}
`
}
}}
/>

<details>
<summary>Expected output</summary>

```text
Count: 1
```

</details>

## Reading Account Token Balances

You can also query the assets (tokens) held by an account:

<CodeTabs
tsFilename="src/lib/token-balance.ts"
rustFilename="integration/src/bin/token-balance.rs"
example={{
rust: {
code: `use miden_client::{
    account::{Account, AccountId},
    builder::ClientBuilder,
    keystore::FilesystemKeyStore,
    rpc::{Endpoint, GrpcClient},
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize RPC connection
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_client = Arc::new(GrpcClient::new(&endpoint, timeout_ms));

    // Initialize keystore
    let keystore_path = std::path::PathBuf::from("./keystore");
    let keystore =
        Arc::new(FilesystemKeyStore::new(keystore_path).unwrap());

    let store_path = std::path::PathBuf::from("./store.sqlite3");

    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    let mut client = ClientBuilder::new()
        .rpc(rpc_client)
        .sqlite_store(store_path)
        .authenticator(keystore.clone())
        .in_debug_mode(true.into())
        .build()
        .await?;

    client.sync_state().await?;

    //------------------------------------------------------------
    // READ TOKEN BALANCE OF AN ACCOUNT
    //------------------------------------------------------------

    let alice_account_id = AccountId::from_hex("0x5b2840a923dedc102ea67e0c1eba3c")?;
    let faucet_account_id = AccountId::from_hex("0x29dd1dc628d2842032e751ed1b5da7")?;

    client.import_account_by_id(alice_account_id).await?;

    let alice_account: Account = client
        .get_account(alice_account_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Account not found"))?
        .try_into()?;

    let balance = alice_account
        .vault()
        .get_balance(faucet_account_id)?;

    println!("Alice's TEST token balance: {:?}", balance);

    Ok(())
}
`},
  typescript: {
    code:`import { WebClient, AccountId } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    const nodeEndpoint = "https://rpc.testnet.miden.io:443";

    // Initialize client
    const client = await WebClient.createClient(nodeEndpoint);
    await client.syncState();

    const aliceId = AccountId.fromHex("0x5b2840a923dedc102ea67e0c1eba3c");
    const faucetId = AccountId.fromHex("0x29dd1dc628d2842032e751ed1b5da7");

    // Import the account into the client's database
    await client.importAccountById(aliceId);
    const aliceAccount = await client.getAccount(aliceId);

    const balance = aliceAccount?.vault().getBalance(faucetId);
    console.log("Alice's TEST token balance:", Number(balance));
}
`
}
}}
/>

<details>
<summary>Expected output</summary>

```text
Alice's TEST token balance: 900
```

</details>

---
