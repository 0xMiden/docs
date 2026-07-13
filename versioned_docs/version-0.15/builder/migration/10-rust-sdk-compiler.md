---
sidebar_position: 10
title: "Rust SDK & Compiler Changes"
description: "miden SDK 0.12 → 0.13 (the protocol-v0.15-aligned release): #[component] becomes a trait + storage struct, a required miden-project.toml manifest, explicit #[account(...)] declarations, and tx-kernel binding changes"
---

# Rust SDK & Compiler Changes

This section covers the `miden` Rust SDK and compiler (the `miden` crate and `midenc`), used to write Miden smart contracts, notes, and transaction scripts in Rust. The relevant step is the SDK's **`0.12` → `0.13`** release, which is the line aligned with VM `0.23` / protocol `0.15`. (The `miden` SDK carries its own version number, distinct from the protocol and client crate versions used elsewhere in this guide.)

:::warning Breaking Change
The SDK macros were reworked: `#[component]` is now a **trait + a storage struct**, a `miden-project.toml` manifest is **required**, accounts must be declared explicitly with `#[account(...)]`, and the tx-kernel bindings were aligned with protocol v0.15. The macro changes touch **every account component, every authentication component, and every note/tx-script that references an account.** Work through the sections in order: rewrite the component (1), add the project manifest (2), update account references (3), then the bindings (4).
:::

---

## `#[component]` is now a trait + a storage struct

### Summary

`#[component]` no longer applies to a `struct` or an inherent `impl`. An account component is now three pieces:

1. a `#[component_storage]` struct holding the `#[storage(...)]` fields,
2. a `#[component]` **trait** declaring the API (the trait name yields the WIT interface), and
3. a `#[component] impl Trait for Storage` block providing the behavior.

Method receivers (`&self` / `&mut self`) and method bodies are unchanged.

### Affected Code

Before (`0.12`):

```rust
use miden::{component, felt, Felt, StorageMap, Word};

#[component]
struct CounterContract {
    #[storage(description = "counter contract storage map")]
    count_map: StorageMap<Word, Felt>,
}

#[component]
impl CounterContract {
    pub fn get_count(&self) -> Felt {
        let key = Word::new([felt!(0), felt!(0), felt!(0), felt!(1)]);
        self.count_map.get(key)
    }

    pub fn increment_count(&mut self) -> Felt {
        let key = Word::new([felt!(0), felt!(0), felt!(0), felt!(1)]);
        let new_value = self.count_map.get(key) + felt!(1);
        self.count_map.set(key, new_value);
        new_value
    }
}
```

After (`0.13`):

```rust
use miden::{component, component_storage, felt, Felt, StorageMap, Word};

// 1. storage fields move to a `#[component_storage]` struct
#[component_storage]
struct CounterContractStorage {
    #[storage(description = "counter contract storage map")]
    count_map: StorageMap<Word, Felt>,
}

// 2. the API becomes a `#[component]` trait (its name is the WIT interface)
#[component]
trait CounterContract {
    fn get_count(&self) -> Felt;
    fn increment_count(&mut self) -> Felt;
}

// 3. the behavior is a `#[component] impl Trait for Storage` block
#[component]
impl CounterContract for CounterContractStorage {
    fn get_count(&self) -> Felt {
        let key = Word::new([felt!(0), felt!(0), felt!(0), felt!(1)]);
        self.count_map.get(key)
    }

    fn increment_count(&mut self) -> Felt {
        let key = Word::new([felt!(0), felt!(0), felt!(0), felt!(1)]);
        let new_value = self.count_map.get(key) + felt!(1);
        self.count_map.set(key, new_value);
        new_value
    }
}
```

**Authentication components migrate the same way.** `#[auth_script]` was already required in `0.12`; in `0.13` it simply moves onto the trait method declaration (the `impl` method no longer repeats it):

```rust
// before (0.12): inherent impl
#[component]
struct AuthComponent;
#[component]
impl AuthComponent {
    #[auth_script]
    pub fn auth_procedure(&mut self, _arg: Word) { /* ... */ }
}

// after (0.13): trait + storage, `#[auth_script]` on the trait method
#[component_storage]
struct AuthComponentStorage;
#[component]
trait AuthComponent {
    #[auth_script]
    fn auth_procedure(&mut self, _arg: Word);
}
#[component]
impl AuthComponent for AuthComponentStorage {
    fn auth_procedure(&mut self, _arg: Word) { /* ... */ }
}
```

### Migration Steps

1. Move each component's `#[storage(...)]` fields into a `#[component_storage]` struct.
2. Declare the API as a `#[component] trait` (the trait name becomes the WIT interface).
3. Provide the behavior in a `#[component] impl Trait for Storage` block; drop the `pub` on the method bodies.
4. For auth components, move `#[auth_script]` from the `impl` method onto the trait method declaration.

---

## `miden-project.toml` is now a required file

### Summary

`0.13` introduces a dedicated project manifest, `miden-project.toml`, placed next to `Cargo.toml` at the crate root. The Miden-specific configuration that previously lived in `Cargo.toml` `[package.metadata.*]` now lives here, and the proc-macros read it to resolve the WIT interface name, the project kind, and any FPI/sibling dependencies. **Building a `0.13` project without it fails** (for components, with an undefined `::init` link error).

### Affected Code

Create `miden-project.toml` like this (account component without dependencies):

```toml title="miden-project.toml"
[package]
name = "counter-contract"   # crate name; kebab-case
version = "0.1.0"           # project version; supplies the WIT `@version`

[lib]
kind = "account-component"  # project kind: "account-component" | "note" | "tx-script"
# Full WIT id: miden:<package>/<interface>@<version>
#   <package>   = the kebab-cased [package].name
#   <interface> = the kebab-cased `#[component]` trait name  (here: `CounterContract`)
#   <version>   = the [package].version above
namespace = "miden:counter-contract/counter-contract@0.1.0"

[dependencies]
miden-core = "*"
miden-protocol = "*"

# account components only: which account types may host this component
[package.metadata.miden]
supported-types = ["RegularAccountUpdatableCode"]
```

Walking through the fields:

- **`[package]`** — `name` and `version`. The version feeds the `@version` suffix of the WIT id, so bumping it changes the component's interface id.
- **`[lib].kind`** — the project kind: `account-component`, `note`, or `tx-script`.
- **`[lib].namespace`** — the full `miden:<package>/<interface>@<version>` WIT id. The **interface segment must equal the kebab-cased `#[component]` trait name**; a mismatch fails to link with an undefined `::init`. (For `note`/`tx-script` projects, the interface segment is the project's own name rather than a component trait.)
- **`[dependencies]`** — the Miden crates the project links against (`miden-core`, `miden-protocol`), plus any FPI/sibling dependency packages by `path` (see the next section).
- **`[package.metadata.miden].supported-types`** — account components only.

:::caution Storage-slot caution
Storage slot names derive from the `[lib].namespace` interface segment (which mirrors the component trait name), and slot names feed `StorageSlotId` derivation. Renaming the component trait (and updating `[lib].namespace` to match) **re-keys the storage slot ids of an already-deployed component**. Keep the trait name stable across upgrades of a live component.
:::

For a project that calls another account/component (FPI or sibling), add the dependency in both `[dependencies]` (the package) and `[package.metadata.miden.dependencies]` (its generated WIT):

```toml title="miden-project.toml"
[dependencies]
miden-core = "*"
miden-protocol = "*"
basic-wallet = { path = "../basic-wallet" }

# the dependency's generated WIT, used to generate the call bindings
[package.metadata.miden.dependencies]
basic-wallet = { wit = "../basic-wallet/target/generated-wit/" }
```

The `[package.metadata.miden.dependencies].<name>.wit` entry is what the macros read to generate the typed call bindings, and it is the **same entry used by note scripts, by account components doing FPI, and by sibling component calls**.

### Migration Steps

1. Add a `miden-project.toml` next to `Cargo.toml` with `[package]`, `[lib].kind`, and `[lib].namespace`.
2. Set the `[lib].namespace` interface segment to the kebab-cased `#[component]` trait name.
3. Move any `[package.metadata.*]` Miden config out of `Cargo.toml` into this file.
4. For account components, list `supported-types`. For FPI/sibling calls, add the dependency in `[dependencies]` and its generated WIT under `[package.metadata.miden.dependencies]`.

---

## Accounts: declare `#[account(...)]` explicitly with an interface

### Summary

The auto-generated `crate::bindings::Account` struct is gone. Declare the account explicitly with `#[account(...)]` and use that type as the note/tx-script entrypoint account parameter. The dependency reference now **requires the exported WIT interface** (kebab-cased and validated): write `#[account(basic_wallet::BasicWallet)]`, not `#[account(basic_wallet)]`.

### Affected Code

Before (`0.12`):

```rust
use miden::{active_note, note, AccountId, Word};
use crate::bindings::Account; // auto-generated

#[note]
struct P2idNote {
    target_account_id: AccountId,
}

#[note]
impl P2idNote {
    #[note_script]
    pub fn script(self, _arg: Word, account: &mut Account) {
        for asset in active_note::get_assets() {
            account.receive_asset(asset);
        }
    }
}
```

After (`0.13`):

```rust
use miden::{account, active_note, note, AccountId, Word};

// declare the native account explicitly; pick the package's WIT interface
#[account(basic_wallet::BasicWallet)]
pub struct Wallet;

#[note]
struct P2idNote {
    target_account_id: AccountId,
}

#[note]
impl P2idNote {
    #[note_script]
    pub fn script(self, _arg: Word, account: &mut Wallet) {
        for asset in active_note::get_assets() {
            account.receive_asset(asset);
        }
    }
}
```

The same `#[account(...)]` type serves two roles. Passed to a `#[note]`/`#[tx_script]` entrypoint it is the transaction's native (active) account. Constructed with `new(account_id)` it is a **foreign account caller**, whose method calls are routed through `execute_foreign_procedure` (FPI):

```rust
let counter = CounterContract::new(counter_account_id);
let count = counter.get_count();
```

**FPI is not limited to note/tx scripts — an account component can call another account through FPI too.** Declare the `#[account(...)]` wrapper in the component crate (and the dependency in `miden-project.toml`) and use it from inside the `#[component] impl`:

```rust
#[account(callee_account::CounterContract)]
struct CalleeAccount;

#[component]
impl CallerAccount for CallerAccountStorage {
    fn read_foreign_count(&self, callee_account_id: AccountId) -> Felt {
        let callee = CalleeAccount::new(callee_account_id);
        callee.get_count(key)
    }
}
```

### Migration Steps

1. Remove `use crate::bindings::Account;` and any reliance on the auto-generated `Account`.
2. Declare each account explicitly with `#[account(package::Interface)]` (kebab-cased exported interface, not just the package name).
3. Use that type as the `&mut` account parameter of your note/tx-script entrypoints.
4. For FPI, construct the same type with `new(account_id)` and add the callee as a dependency in `miden-project.toml`.

---

## Tx-kernel bindings: protocol v0.15

### Summary

The SDK bindings were aligned with VM `0.23` / protocol `0.15` (`miden-field` bumped to `^0.25`).

- **`Felt::new` is now fallible** — it returns `Result<Felt, _>` instead of `Felt`. Replace `Felt::new(x)` with `Felt::new(x).unwrap()` (or handle the error). The `felt!(x)` macro is unchanged and remains the preferred constructor for literals.
- **`asset::{create_fungible_asset, create_non_fungible_asset}`** now take a trailing `enable_callbacks: bool` argument.
- **`active_account::{get_balance, get_initial_balance}`** (and the corresponding `ActiveAccount` trait methods) now take an asset key `Word` instead of a faucet `AccountId`.
- **`faucet::{mint, burn}`** no longer return an `Asset`; the `faucet::{mint_value, burn_value}` helpers were removed. Use the returned value-free API to match the tx kernel.
- **`output_note::set_attachment` was removed.** The attachment shape is selected by function instead of a runtime `attachment_kind` argument.

### Affected Code

```rust
// before: output_note::set_attachment(note_idx, scheme, kind, attachment);
// after, for a single word:
output_note::add_word_attachment(note_idx, scheme, attachment);
// or `add_attachment` for a commitment, `add_attachment_from_memory` for multiple words.
```

:::note Storage encoding note
Scalar `Felt` values stored in `StorageValue<Felt>` / `StorageMap<_, Felt>` are now packed into the low word limb (`[v, 0, 0, 0]`) instead of the high limb (`[0, 0, 0, v]`), matching protocol v0.15. This is transparent when you recompile and redeploy, but state written by `0.12` code is read back differently by `0.13` code.
:::

### Migration Steps

1. Wrap `Felt::new(x)` calls in `.unwrap()` (or handle the `Result`); keep using `felt!(x)` for literals.
2. Add the trailing `enable_callbacks` argument to `asset::create_fungible_asset` / `create_non_fungible_asset`.
3. Pass an asset key `Word` to `active_account::get_balance` / `get_initial_balance` instead of a faucet `AccountId`.
4. Drop the return values of `faucet::mint` / `burn`; remove uses of `mint_value` / `burn_value`.
5. Replace `output_note::set_attachment` with `add_word_attachment` / `add_attachment` / `add_attachment_from_memory`.
6. Re-deploy contracts that persist scalar `Felt` storage — the low-limb packing means `0.12` state is not read back identically.

---

## New in 0.13 (no migration required)

These are additive and do not require changes to existing code:

- **Sibling component calls** — `#[component(package::Interface, ...)]` on the component trait lets one component call another component deployed on the same account.
- **`println!`** — a `println!` macro (and `debug::println`) for emitting a debug message during execution.
