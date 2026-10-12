---
title: Compile
sidebar_position: 6
---

# Compile

`client.compile` turns Miden Assembly (MASM) source into the three runtime artifacts the rest of the SDK consumes:

| Method | Produces | Used by |
| --- | --- | --- |
| `client.compile.component({ code, namespace?, slots?, supportAllTypes?, libraries? })` | `AccountComponent` | [`accounts.create({ components: [...] })`](./accounts.md#contract) |
| `client.compile.txScript({ code, libraries? })` | `TransactionScript` | [`transactions.execute({ script })`](./transactions.md#custom-transaction-scripts-execute) |
| `client.compile.noteScript({ code, libraries? })` | `NoteScript` | `Note` construction utilities |

Each call spins up a fresh `CodeBuilder`, so libraries linked in one call never leak into another.

## Account components

```typescript
import { MidenClient, StorageSlot } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

const contractCode = `
  use miden::protocol::active_account
  use miden::protocol::native_account
  use miden::core::word
  use miden::core::sys

  const COUNTER_SLOT = word("miden::tutorials::counter")

  @account_procedure
  pub proc get_count
    push.COUNTER_SLOT[0..2] exec.active_account::get_item
    exec.sys::truncate_stack
  end

  @account_procedure
  pub proc increment_count
    push.COUNTER_SLOT[0..2] exec.active_account::get_item
    add.1
    push.COUNTER_SLOT[0..2] exec.native_account::set_item
    exec.sys::truncate_stack
  end
`;

const component = await client.compile.component({
  code: contractCode,
  namespace: "external_contract::counter_contract",
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});

// Use the procedure hash when calling this contract via FPI
const getCountHash = component.getProcedureHash("get_count");
console.log("get_count hash:", getCountHash);
```

Options:

- `code` — the MASM source for the component.
- `namespace` — module path used to derive procedure identities. Reuse it when rebuilding the source as an inline library; linking `{ component }` preserves the exact compiled identity.
- `slots` — initial storage slots. Use the `StorageSlot` helpers (`emptyValue`, etc.).
- `libraries` — dependency source modules as `{ namespace, code }`. These are linked before compiling the component; there is no `linking` option for this field.
- `supportAllTypes` — defaults to `true` and calls `withSupportsAllTypes()` for compatibility. Components already apply to every account type; this option does not inject an auth-kernel invocation.

## Transaction scripts

### Without libraries

A script with no `libraries` entry can only reference procedures that exist in the transaction kernel and the standard library — no custom external contracts:

```typescript
const script = await client.compile.txScript({
  code: `
    use miden::core::sys

    @transaction_script
    pub proc main
      push.0
      exec.sys::truncate_stack
    end
  `,
});
```

If your script needs to call into an external contract (as in the FPI section below), pass either the exact compiled component or its source through `libraries` — the compiler only links what you explicitly provide.

### With inline libraries

```typescript
import { Linking } from "@miden-sdk/miden-sdk";

const script = await client.compile.txScript({
  code: `
    use external_contract::my_contract
    use miden::core::sys

    @transaction_script
    pub proc main
      call.my_contract::do_something
      exec.sys::truncate_stack
    end
  `,
  libraries: [
    {
      namespace: "external_contract::my_contract",
      code: myContractCode,
      linking: Linking.Dynamic, // default
    },
  ],
});
```

Each inline library takes:

| Field | Required | Description |
| --- | --- | --- |
| `namespace` | yes | MASM namespace, e.g. `"counter::module"`. |
| `code` | yes | MASM source. |
| `linking` | no | `Linking.Dynamic` (default) or `Linking.Static`. `"dynamic"` / `"static"` string literals are also accepted. |

`libraries` also accepts `{ component, linking? }`, which links the exact code installed by an `AccountComponent`, or a pre-built `Library`. Prefer the component form when a script calls a component installed on an account.

### Linking modes

| Value | Behaviour | When to use |
| --- | --- | --- |
| `Linking.Dynamic` (default) | Retains external procedure MAST roots. The execution host must supply the referenced code. | Linking account procedures without embedding their implementation. |
| `Linking.Static` | Includes the linked library code in the compiled artifact. | Offchain libraries that must be self-contained. |

## Note scripts

Note scripts run when an account consumes the note. The shape mirrors `txScript`; use it when you need custom logic on consumption.

```typescript
const noteScript = await client.compile.noteScript({
  code: `
    use miden::protocol::active_note
    use miden::core::sys

    @note_script
    pub proc main
      # Runs when the consuming account redeems this note.
      # Real note scripts inspect note storage, assets, and account state
      # using procedures from miden::protocol::active_note.
      exec.sys::truncate_stack
    end
  `,
});
```

Libraries accept the same inline `{ namespace, code, linking? }`, compiled `{ component, linking? }`, and pre-built `Library` forms as transaction scripts.

## Procedure hashes (for FPI)

Foreign procedure invocation requires the **hash** of the target procedure. Extract it from a compiled component:

```typescript
const component = await client.compile.component({
  code: counterContractCode,
  namespace: "external_contract::counter_contract",
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});

const getCountHash = component.getProcedureHash("get_count");

const script = await client.compile.txScript({
  code: `
    use external_contract::count_reader_contract
    use miden::core::sys

    @transaction_script
    pub proc main
      padw padw padw padw
      push.${getCountHash}
      push.${counterAccountId.prefix()}
      push.${counterAccountId.suffix()}
      call.count_reader_contract::copy_count
      exec.sys::truncate_stack
    end
  `,
  libraries: [
    { namespace: "external_contract::count_reader_contract", code: countReaderCode },
  ],
});
```

## End-to-end: compile → create contract → execute script

```typescript
import {
  MidenClient,
  AuthSecretKey,
  StorageSlot,
} from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();
await client.sync();

// 1. Compile the contract component
const component = await client.compile.component({
  code: contractCode, // counter source from the first example
  namespace: "external_contract::counter_contract",
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});

// Allow the contract to receive a standard P2ID funding note.
const receiver = await client.compile.component({
  code: "pub use {receive_asset} from miden::standards::wallets::basic",
  namespace: "funding::receiver",
});

// 2. Create the contract account
const seed = crypto.getRandomValues(new Uint8Array(32));
const auth = AuthSecretKey.rpoFalconWithRNG(seed);

const contract = await client.accounts.create({
  seed,
  auth,
  components: [component, receiver],
});

console.log("Fund this account:", contract.id().toString());
```

Before continuing, send a public P2ID note containing the network's native fee asset to this account (for example, from the network faucet). Set `fundingNoteId` below to that note's hex ID after it is included onchain. Its amount must cover both the consumption transaction and the subsequent counter transaction. Creating the account and calling `sync()` do not fund it.

```typescript
// 3. Sync and consume the funding note into the contract's vault.
await client.sync();
await client.transactions.consume({
  account: contract.id(),
  notes: [fundingNoteId],
  waitForConfirmation: true,
});

// 4. Compile the transaction script
const script = await client.compile.txScript({
  code: `
    use external_contract::counter_contract

    @transaction_script
    pub proc main
      call.counter_contract::increment_count
    end
  `,
  // Link the exact component installed on the account so procedure identities match.
  libraries: [{ component }],
});

// 5. Execute using the remaining native fee balance.
const { txId } = await client.transactions.execute({
  account: contract.id(),
  script,
});

console.log("Tx:", txId.toHex());
```
