---
title: Compile
sidebar_position: 6
---

# Compile

`client.compile` turns Miden Assembly (MASM) source into the three runtime artifacts the rest of the SDK consumes:

| Method | Produces | Used by |
| --- | --- | --- |
| `client.compile.component({ code, slots?, supportAllTypes? })` | `AccountComponent` | [`accounts.create({ components: [...] })`](./accounts.md#contract) |
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

  pub proc get_count
    push.COUNTER_SLOT[0..2] exec.active_account::get_item
    exec.sys::truncate_stack
  end

  pub proc increment_count
    push.COUNTER_SLOT[0..2] exec.active_account::get_item
    add.1
    push.COUNTER_SLOT[0..2] exec.native_account::set_item
    exec.sys::truncate_stack
  end
`;

const component = await client.compile.component({
  code: contractCode,
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});

// Use the procedure hash when calling this contract via FPI
const getCountHash = component.getProcedureHash("get_count");
console.log("get_count hash:", getCountHash);
```

Options:

- `code` — the MASM source for the component.
- `slots` — initial storage slots. Use the `StorageSlot` helpers (`emptyValue`, etc.).
- `supportAllTypes` — defaults to `true`. When `true`, the compiler auto-injects an auth-kernel invocation so the component accepts the standard set of input types for authenticated transactions. Set to `false` if your component already invokes an auth kernel procedure itself, or intentionally omits one.

## Transaction scripts

### Without libraries

A script with no `libraries` entry can only reference procedures that exist in the transaction kernel and the standard library — no custom external contracts:

```typescript
const script = await client.compile.txScript({
  code: `
    use miden::core::sys
    begin
      push.0
      exec.sys::truncate_stack
    end
  `,
});
```

If your script needs to call into an external contract (as in the FPI section below), you must pass that contract's code through `libraries` — the compiler only links what you explicitly provide.

### With inline libraries

```typescript
import { Linking } from "@miden-sdk/miden-sdk";

const script = await client.compile.txScript({
  code: `
    use external_contract::my_contract
    use miden::core::sys
    begin
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

Each library takes:

| Field | Required | Description |
| --- | --- | --- |
| `namespace` | yes | MASM namespace, e.g. `"counter::module"`. |
| `code` | yes | MASM source. |
| `linking` | no | `Linking.Dynamic` (default) or `Linking.Static`. `"dynamic"` / `"static"` string literals are also accepted. |

### Linking modes

| Value | Behaviour | When to use |
| --- | --- | --- |
| `Linking.Dynamic` (default) | Links via DYNCALL at prove time. The foreign contract's onchain code is fetched by the prover. | FPI — foreign contract lives onchain. |
| `Linking.Static` | Inlines library code into the script at compile time. | Offchain libraries that must be self-contained. |

## Note scripts

Note scripts run when an account consumes the note. The shape mirrors `txScript`; use it when you need custom logic on consumption.

```typescript
const noteScript = await client.compile.noteScript({
  code: `
    use miden::protocol::active_note
    use miden::core::sys

    begin
      # Runs when the consuming account redeems this note.
      # Real note scripts inspect note storage, assets, and account state
      # using procedures from miden::protocol::active_note.
      exec.sys::truncate_stack
    end
  `,
});
```

Libraries follow the same `{ namespace, code, linking? }` shape as transaction scripts.

## Procedure hashes (for FPI)

Foreign procedure invocation requires the **hash** of the target procedure. Extract it from a compiled component:

```typescript
const component = await client.compile.component({
  code: counterContractCode,
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});

const getCountHash = component.getProcedureHash("get_count");

const script = await client.compile.txScript({
  code: `
    use external_contract::count_reader_contract
    use miden::core::sys
    begin
      push.${getCountHash}
      push.${counterAccountId.suffix()}
      push.${counterAccountId.prefix()}
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
  AccountType,
  AuthSecretKey,
  StorageSlot,
} from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();
await client.sync();

// 1. Compile the contract component
const component = await client.compile.component({
  code: counterCode,
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});

// 2. Create the contract account
const seed = crypto.getRandomValues(new Uint8Array(32));
const auth = AuthSecretKey.rpoFalconWithRNG(seed);

const contract = await client.accounts.create({
  type: AccountType.RegularAccountImmutableCode,
  seed,
  auth,
  components: [component],
});

await client.sync();

// 3. Compile the transaction script
const script = await client.compile.txScript({
  code: `
    use external_contract::counter_contract
    begin
      call.counter_contract::increment_count
    end
  `,
  libraries: [
    { namespace: "external_contract::counter_contract", code: counterCode },
  ],
});

// 4. Execute
const { txId } = await client.transactions.execute({
  account: contract.id(),
  script,
});

console.log("Tx:", txId.toHex());
```
