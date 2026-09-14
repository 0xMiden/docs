---
sidebar_position: 3
title: "Common Pitfalls"
description: "Reference guide for known issues, limitations, and workarounds when developing with the Miden Rust compiler."
---

# Common Pitfalls

This reference documents known issues and limitations when developing with the Miden Rust compiler, along with recommended workarounds.

## Comparing Asset Amounts

### Problem

`Felt` comparison operators work, but a field element is not a validated integer amount type.
Reading an amount directly from an asset bypasses its fungibility and range checks, and subsequent
arithmetic remains vulnerable to modular wraparound.

```rust
// Avoid decoding a token amount as a raw field element.
let amount = asset.value[0];
if amount <= felt!(1_000_000) {
    // ...
}
```

### Solution

Use `AssetAmount` for fungible token amounts. It has integer ordering and checked arithmetic:

```rust
use miden::AssetAmount;

let a = AssetAmount::from(100_u32);
let b = AssetAmount::from(200_u32);
if a < b {
    // Integer comparison
}
```

### Example from Bank Contract

```rust title="contracts/bank-account/src/lib.rs"
// Validating deposit amount
const MAX_DEPOSIT_AMOUNT: u32 = 1_000_000;

// Asset::amount() validates that the asset is fungible and returns AssetAmount.
let amount = asset.amount();

// Use integer comparison
assert!(
    amount <= AssetAmount::from(MAX_DEPOSIT_AMOUNT),
    "Deposit exceeds maximum"
);
```

:::warning Raw Felt values
When a protocol API genuinely gives you a raw `Felt`, use `as_canonical_u64()` only after
confirming that the value is intended to have integer semantics. For fungible assets, prefer
`Asset::amount()` and keep the value as `AssetAmount`.
:::

---

## Stack Limit (16 Elements)

### Problem

The Miden VM stack only allows direct access to the first 16 elements. If the compiler emits an instruction that accesses beyond that window, compilation fails with this error:

```
invalid stack index: only the first 16 elements on the stack are directly accessible
```

### Solution

This is not a limit of 16 Rust local variables. The compiler can reorder or store values in memory. If you encounter this diagnostic, try reducing how many values a function needs at once. The following sketches illustrate possible refactorings; they omit the application-specific getters and processing logic.

**1. Reduce local variables:**

```rust
// Before: keep several values available at once
fn complex_operation(&mut self) {
    let a = self.get_a();
    let b = self.get_b();
    let c = self.get_c();
    let d = self.get_d();
    let e = self.get_e();
    let f = self.get_f();
    // ... use these values later
}

// After: combine values in smaller batches
fn complex_operation(&mut self) {
    // Process in smaller batches
    let result_ab = self.process(self.get_a(), self.get_b());
    let result_cd = self.process(self.get_c(), self.get_d());
    self.finalize(result_ab, result_cd);
}
```

**2. Break into smaller functions:**

```rust
// Before: one large function
fn do_everything(&mut self, a: Word, b: Word, c: Word) {
    // Many operations touching all parameters...
}

// After: split into stages (processing bodies omitted)
fn stage_one(&mut self, a: Word) -> Felt {
    // Process a
}

fn stage_two(&mut self, b: Word, result: Felt) -> Felt {
    // Process b with result from stage one
}

fn stage_three(&mut self, c: Word, result: Felt) {
    // Final processing
}
```

**3. Process iteratively:**

```rust
// CORRECT: Process one at a time
for asset in assets {
    self.process_single_asset(asset);
}
```

---

## Exported Procedure Argument Limit (4 Words)

### Problem

Exported component procedures and direct cross-context calls can currently receive at most 4
Words (16 Felts) as arguments.

```rust
#[component]
trait Processor {
    #[account_procedure]
    fn process(
        &mut self,
        depositor: AccountId,    // 2 Felts
        asset: Asset,            // 2 Words (key + value)
        serial_num: Word,        // 1 Word
        tag: Felt,               // 1 Felt
        note_type: Felt,         // 1 Felt
        extra_data: Word,        // 1 Word - EXCEEDS LIMIT!
    );
}
```

### Solution

**1. Keep exported procedure inputs within 4 Words:**

```rust
#[component]
trait Processor {
    #[account_procedure]
    fn process(
        &mut self,
        asset: Asset,            // 2 Words (key + value)
        serial_num: Word,        // 1 Word
        params: Word,            // [tag, note_type, 0, 0] - 1 Word
    );
}
```

**2. Use note storage for passing data:**

For note scripts, pass complex data via `active_note::get_storage()`:

The example below requires at least two storage elements; indexing a missing element aborts execution.

```rust
#[note]
struct MyNote;

#[note]
impl MyNote {
    #[note_script]
    fn run(self, _arg: Word) {
        let storage = active_note::get_storage();
        // Storage can hold many Felts without function argument limits
        let param1 = storage[0];
        let param2 = storage[1];
        // ... access up to the full storage capacity
    }
}
```

**3. Store data first, reference by key:**

```rust
// Store complex data in storage
fn store_config(&mut self, key: Word, config_data: Word) {
    self.configs.set(key, config_data);
}

// Reference by key in other operations
fn process_with_config(&mut self, key: Word) {
    let config = self.configs.get(key);
    // Use config...
}
```

---

## Array Ordering (Rust/MASM Reversal)

### Problem

At a Rust/MASM stack boundary, arrays appear on the operand stack in **reversed order**.

```rust
// In Rust, you define:
let word = Word::from([a, b, c, d]);

// In MASM, this becomes: [d, c, b, a]
```

### Solution

Be aware of this when:
- Constructing storage keys
- Parsing note storage
- Working with asset data

**Example: Storage Key Construction**

```rust
// Balance-key input in Rust contract code
let key = Word::from([
    depositor.prefix,  // Position 0 in Rust
    depositor.suffix,  // Position 1
    faucet.prefix,     // Position 2
    faucet.suffix,     // Position 3
]);

// When the VM processes this, it sees:
// [faucet.suffix, faucet.prefix, depositor.suffix, depositor.prefix]
```

:::tip Consistency is Key
The reversal doesn't matter as long as you're **consistent**. Always construct and parse arrays the same way throughout your codebase.
:::

---

## Felt Arithmetic Underflow/Overflow

### Problem

Miden uses field element (Felt) arithmetic, which operates in a prime field with modulus `p = 2^64 - 2^32 + 1`. This means arithmetic is **modular** and will silently wrap around instead of causing an error.

```rust
// DANGEROUS: This does NOT error on underflow!
let balance = felt!(100);
let withdrawal = felt!(500);
let new_balance = balance - withdrawal;  // Silently wraps to a huge positive number!
```

When you subtract a larger value from a smaller one, the result wraps around to a large positive number (approximately `2^64`). This is NOT an error in the Miden VM - the transaction will succeed with an incorrect balance.

### Why This Happens

The Miden VM performs all Felt arithmetic as modular operations within the prime field. There is no automatic overflow or underflow detection at the VM level.

### Solution

**Use `AssetAmount` for asset balances:**

```rust
// CORRECT: Keep balances in a StorageMap<Word, AssetAmount>.
let current_balance: AssetAmount = self.balances.get(key);
let withdraw_amount = withdraw_asset.amount();

// AssetAmount subtraction checks for underflow.
let new_balance = current_balance - withdraw_amount;
self.balances.set(key, new_balance);
```

### Example from Bank Contract

```rust title="contracts/bank-account/src/lib.rs"
pub fn withdraw(&mut self, key: Word, withdraw_asset: Asset) {
    let current_balance: AssetAmount = self.balances.get(key);
    let new_balance = current_balance - withdraw_asset.amount();
    self.balances.set(key, new_balance);
}
```

:::danger Critical Security Issue
Using unchecked raw `Felt` subtraction for balances can lead to:
- Users withdrawing more than their balance
- Balance values becoming astronomically large
- Complete loss of funds in the contract

Use `AssetAmount` or explicitly validate bounds before subtracting raw `Felt` values.
:::

---

## Wallet Component Requirement

### Problem

Standard P2ID notes receive assets through the consuming account's wallet `receive_asset` procedure. The `wallet::move_note_assets_to_account` helper calls that account procedure; the account must provide it.

### Solution

Include `BasicWallet` when an account needs the standard wallet receiving capability:

```rust
use miden_client::account::component::BasicWallet;

// When creating an account that needs to receive assets
let account = AccountBuilder::new(seed)
    .with_component(auth_component)  // Your configured authentication component
    .with_component(BasicWallet)  // Add wallet capability
    .with_component(YourCustomComponent)
    .build()?;
```

Supply the authentication component configured for your application (for example, `AuthSingleSig`) as `auth_component`. `BasicWallet` and a business component do not provide authentication by themselves.

---

## Storage Map Key Consistency

### Problem

Storage map lookups return unexpected results or zeros when keys are constructed inconsistently.

### Solution

Define a single key construction pattern and use it everywhere:

```rust title="contracts/bank-account/src/lib.rs"
use miden::{component_storage, AccountId, Asset, AssetAmount, StorageMap, Word};

#[component_storage]
struct BankStorage {
    #[storage(description = "fungible balances by depositor and asset")]
    balances: StorageMap<Word, AssetAmount>,
}

impl BankStorage {
    /// Combine the depositor and fungible asset ID into one map key.
    fn balance_key(depositor: AccountId, asset: &Asset) -> Word {
        // Reject non-fungible assets before deriving the compact key.
        let _ = asset.amount();

        Word::from([
            depositor.prefix,
            depositor.suffix,
            asset.key[3],
            asset.key[2],
        ])
    }

    fn get_depositor_balance(&self, depositor: AccountId, asset: &Asset) -> AssetAmount {
        let key = BankStorage::balance_key(depositor, asset);
        self.balances.get(key)
    }

    fn update_balance(&mut self, depositor: AccountId, asset: &Asset, amount: AssetAmount) {
        let key = BankStorage::balance_key(depositor, asset);
        let current = self.balances.get(key);
        self.balances.set(key, current + amount);
    }
}
```

---

## Note Type Values

### Problem

When creating output notes, the `note_type` parameter uses specific integer values that aren't obvious.

### Solution

Use the correct values for note types:

| Value | Type | Description |
|-------|------|-------------|
| 1 | Public | Note data is visible onchain |
| 0 | Private | Only a commitment to the note details is published |

```rust
// In note storage or when creating output notes
let note_type = felt!(1);  // Public note
// or
let note_type = felt!(0);  // Private note
```

---

## P2ID Script Root

### Problem

When creating P2ID (Pay-to-ID) output notes, you need the script's MAST root. The old v0.13 pattern of hardcoding the digest is fragile — it hashed under RPO, which v0.14 replaced with Poseidon2, and any future change to the P2ID script invalidates the constant silently.

### Solution

Carry the P2ID script root on the initiating note's storage and read it at runtime instead of hardcoding a value:

```rust title="contracts/bank-account/src/lib.rs"
// The withdraw-request note encodes the P2ID script root in storage elements
// 10 through 13 (4 felts = 1 Word). The Poseidon2-hashed digest of the P2ID note
// script is injected by the caller when the note is created.
let storage = active_note::get_storage();
let script_root = Word::from([
    storage[10], storage[11], storage[12], storage[13],
]);

// Pass the script root through to the P2ID-note constructor
self.create_p2id_note(serial_num, &asset, depositor, tag, note_type, script_root);
```

On the client side, compute the script root dynamically from the standard P2ID note script instead of hardcoding it:

```rust
use miden_client::note::P2idNote;
use miden_client::Word;

// Script roots are typed NoteScriptRoot values; convert when a Word is needed.
let p2id_script_root: Word = P2idNote::script_root().into();
```

:::info Why Not Hardcode
The native hash function changed from RPO to Poseidon2 in v0.14, so every MAST root — including the P2ID script's — is different from v0.13. Any hardcoded digest from v0.13 will fail a script-root check on current releases. Reading the root from `P2idNote::script_root()` (or the active note's storage for onchain code) keeps the contract resilient to future script changes.
:::

---

## Empty Transaction (No State Change, No Notes)

### Problem

Every Miden transaction must either change tracked account state (storage, vault, or nonce) **or** consume at least one input note. A transaction that does neither is rejected.

The VM kernel enforces this invariant during execution, surfacing the message:

```
executed transaction neither changed the account state, nor consumed any notes
```

This can catch a transaction script that takes a no-op branch when it consumes no notes and neither authentication nor fee payment changes the account state:

```rust
#[tx_script]
fn run(arg: Word, account: &mut Account) {
    let should_settle = arg[0];
    if should_settle == felt!(1) {
        account.settle();  // mutates state
    }
    // When should_settle != felt!(1), this body does not change state.
    // The transaction is rejected if authentication and fee payment
    // also leave state unchanged and there are no input notes.
}
```

The invariant applies to the complete transaction. A nonce increment during authentication or a fee paid from the account's vault can provide a state change even when the transaction script does nothing. On a chain with zero fees, the standard `NoAuth` component increments the nonce only for a new account or when its state has changed, so a no-op on an existing account can trigger this error.

### Solution

If recording an attempted operation is part of your application's behavior, persist that record in the otherwise empty branch:

```rust
#[tx_script]
fn run(arg: Word, account: &mut Account) {
    let should_settle = arg[0];
    if should_settle == felt!(1) {
        account.settle();
    } else {
        // Record the attempt so the transaction still has a state delta.
        account.record_attempt();
    }
}
```

Storage or vault changes also require the account nonce to increase. Configure an authentication component that handles this, such as the standard `NoAuth` component in a test fixture. Avoid adding a storage write solely to satisfy this invariant when authentication or fee payment already changes state.

Alternatively, if the flow naturally consumes a note, make sure the transaction request includes
it. Pass the `Note` with optional `NoteArgs`; the client uses the presence of an inclusion proof in
its store to decide whether to consume it as an authenticated or unauthenticated note:

```rust
let request = TransactionRequestBuilder::new()
    .input_notes(vec![(input_note, None)])
    .build()?;
```

---

## Quick Reference Table

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Asset amount stored as `Felt` | Modular wraparound or an invalid amount | Use `AssetAmount` |
| Stack overflow | "16 elements" error | Reduce locals, split functions |
| Too many exported procedure inputs | Export-lifting error | Group into Words, use note storage |
| Array reversal | Wrong data order | Be consistent with construction |
| Felt underflow | Balance wraps to huge number | Use `AssetAmount` or validate raw values |
| Missing wallet | Asset operation fails | Add `BasicWallet` component |
| Key mismatch | Zero balances | Use helper function for keys |
| Note type | Wrong note visibility | Use 1 (Public) or 0 (Private) |
| Empty transaction | "Neither changed account state nor consumed notes" | Check the complete transaction's state changes and input notes |

## Next Steps

- **[Debugging Guide](./debugging)** - Troubleshoot errors
- **[Testing Guide](./testing)** - MockChain patterns
- **[Miden Bank Tutorial](../miden-bank/)** - See these patterns in context
