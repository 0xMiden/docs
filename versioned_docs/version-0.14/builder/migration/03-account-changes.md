---
sidebar_position: 3
title: "Account Changes"
---

# Account Changes

:::warning Breaking Change
The v0.14 release introduces significant breaking changes to account construction, authentication components, and related APIs. All of the changes below require code updates when migrating from v0.13.
:::

## `AccountComponent::new` requires `AccountComponentMetadata`

### Summary

`AccountComponent::new` previously accepted two arguments (library, storage slots). It now requires a third argument: an `AccountComponentMetadata` value that describes the component's name and supported account types. The builder methods `with_metadata`, `with_supported_type`, and `with_supports_all_types` have been removed. Additionally, `AccountComponentTemplateError` has been renamed to `ComponentMetadataError`.

### Affected Code

Before:

```rust
let component = AccountComponent::new(library, storage_slots)?
    .with_supports_all_types();
```

After:

```rust
let metadata = AccountComponentMetadata::new(
    "my-component",
    AccountType::all(),
)?;

let component = AccountComponent::new(library, storage_slots, metadata)?;
```

### Migration Steps

1. Create an `AccountComponentMetadata` instance with a name and the set of supported `AccountType` values.
2. Pass the metadata as the third argument to `AccountComponent::new`.
3. Remove any chained calls to `with_supports_all_types()`, `with_supported_type()`, or `with_metadata()`.
4. Replace references to `AccountComponentTemplateError` with `ComponentMetadataError`.

### Common Errors

| Error Message | Cause | Solution |
|---|---|---|
| `expected 3 arguments, found 2` | Missing metadata argument | Add `AccountComponentMetadata` as the third argument |
| `no method named with_supports_all_types` | Removed builder method | Use `AccountType::all()` in metadata constructor |
| `AccountComponentTemplateError not found` | Type renamed | Replace with `ComponentMetadataError` |

## Auth components consolidated into `AuthSingleSig`

### Summary

The six per-scheme authentication types (`AuthFalcon512Rpo`, `AuthFalcon512Poseidon2`, `AuthEcdsaK256Keccak`, `AuthEcdsaK256Rpx`, `AuthEcdsaB256Rpx`, `AuthEcdsaB256Poseidon2`) have been replaced by a single `AuthSingleSig` component that accepts an `AuthScheme` enum. The corresponding ACL type `AuthSingleSigAcl` and multisig type `AuthMultisig` follow the same pattern.

### Affected Code

Before:

```rust
// Falcon-based auth
let auth_component: AccountComponent = AuthFalcon512Rpo::new(pk_commitment).into();

// ECDSA-based auth
let auth_component: AccountComponent = AuthEcdsaK256Keccak::new(pk_commitment).into();
```

After:

```rust
// Falcon-based auth
let auth_component: AccountComponent =
    AuthSingleSig::new(pk_commitment, AuthScheme::Falcon512Poseidon2).into();

// ECDSA-based auth
let auth_component: AccountComponent =
    AuthSingleSig::new(pk_commitment, AuthScheme::EcdsaK256Keccak).into();
```

### Migration Steps

1. Replace all per-scheme auth constructors with `AuthSingleSig::new(pk_commitment, AuthScheme::...)`.
2. Choose the correct `AuthScheme` variant that matches the old type name.
3. Update ACL components to use `AuthSingleSigAcl` and multisig components to use `AuthMultisig`.

## `@auth_script` MASM attribute replaces `auth_` prefix

### Summary

Authentication procedures in MASM are no longer identified by a naming convention (`auth_` prefix). Instead, exactly one procedure per auth component must be annotated with the `@auth_script` attribute.

### Affected Code

Before:

```masm
use.miden::standards::auth::falcon512_rpo

export.auth_tx_falcon512_rpo
    exec.falcon512_rpo::authenticate
end
```

After:

```masm
use.miden::standards::auth::signature

@auth_script
export.auth_tx
    exec.signature::authenticate
end
```

### Migration Steps

1. Replace the scheme-specific `use` import with `use.miden::standards::auth::signature`.
2. Add the `@auth_script` attribute on the line before the procedure declaration.
3. Rename the procedure to remove scheme-specific suffixes (e.g., `auth_tx_falcon512_rpo` becomes `auth_tx`).
4. Replace the scheme-specific `exec` call with `exec.signature::authenticate`.

## `AccountComponent::get_procedures()` replaced by `procedures()`

### Summary

The method `get_procedures()` has been renamed to `procedures()` and now returns an iterator instead of a `Vec<(Word, bool)>`. The `is_auth` flag is now derived from the `@auth_script` attribute rather than a naming convention.

### Affected Code

Before:

```rust
let procs: Vec<(Word, bool)> = component.get_procedures();
```

After:

```rust
for (proc_root, is_auth) in component.procedures() {
    let digest: Word = proc_root.into();
    // is_auth is true when @auth_script is present
}
```

### Migration Steps

1. Replace `get_procedures()` with `procedures()`.
2. Update code to consume an iterator instead of a `Vec`.
3. Note that `is_auth` is now determined by the `@auth_script` attribute, not the procedure name.

## `commitment()` renamed to `to_commitment()` everywhere; `hash_account` removed

### Summary

All `commitment()` methods across the codebase have been renamed to `to_commitment()` for consistency. The standalone `hash_account` function has been removed in favor of calling `to_commitment()` on the account directly.

### Affected Code

Before:

```rust
let account_hash = account.commitment();
let note_hash = note_header.commitment();
let account_hash = hash_account(&id, &nonce, &code_commitment, &storage_commitment);
```

After:

```rust
let account_hash = account.to_commitment();
let note_hash = note_header.to_commitment();
let account_hash = account.to_commitment();
```

### Migration Steps

1. Find and replace all calls to `.commitment()` with `.to_commitment()`.
2. Replace any calls to `hash_account(...)` with `.to_commitment()` on the account instance.

## `TransactionAuthenticator::get_public_key` returns `Arc<PublicKey>`

### Summary

`TransactionAuthenticator::get_public_key` now returns `Option<Arc<PublicKey>>` instead of `Option<&PublicKey>`. This change enables sharing the public key across threads without lifetime constraints.

### Affected Code

Before:

```rust
fn get_public_key(&self) -> Option<&PublicKey> {
    Some(&self.public_key)
}
```

After:

```rust
fn get_public_key(&self) -> Option<Arc<PublicKey>> {
    Some(Arc::new(self.public_key.clone()))
}
```

### Migration Steps

1. Update the return type of any `get_public_key` implementations to `Option<Arc<PublicKey>>`.
2. Wrap returned values in `Arc::new(...)`.
3. Add `use std::sync::Arc;` if not already imported.

## `Ownable2Step` and `MintPolicyConfig` for faucets

### Summary

`NetworkFungibleFaucet::new` no longer accepts an owner account ID. Ownership is now managed through a separate `Ownable2Step` component, and mint policy is configured through an `AuthControlled` component with `AuthControlledInitConfig`. This enables two-step ownership transfer and more flexible access control.

### Affected Code

Before:

```rust
let faucet = NetworkFungibleFaucet::new(
    owner_account_id,
    symbol,
    8,
    max_supply,
)?;
```

After:

```rust
let faucet = NetworkFungibleFaucet::new(symbol, 8, max_supply)?;
let ownable = Ownable2Step::new(owner_account_id);
let auth_controlled = AuthControlled::new(AuthControlledInitConfig::AllowAll);

// Add all three components to the account builder
```

### Migration Steps

1. Remove the `owner_account_id` argument from `NetworkFungibleFaucet::new`.
2. Create an `Ownable2Step` component with the owner account ID.
3. Create an `AuthControlled` component with the desired policy (e.g., `AuthControlledInitConfig::AllowAll`).
4. Add all three components to the account builder.

## `AccountSchemaCommitment` and `build_with_schema_commitment`

### Summary

A new `AccountBuilderSchemaCommitmentExt` extension trait provides a `build_with_schema_commitment()` method on the account builder. This enables building accounts that include a schema commitment for type-safe component validation.

### Affected Code

After:

```rust
use miden_account::AccountBuilderSchemaCommitmentExt;

let (account, seed) = AccountBuilder::new(init_seed)
    .with_component(component)
    .build_with_schema_commitment()?;
```

### Migration Steps

1. Add `use miden_account::AccountBuilderSchemaCommitmentExt;` to bring the extension trait into scope.
2. Replace `.build()` with `.build_with_schema_commitment()` where schema commitment is desired.

## `EthAddress` / `EthEmbeddedAccountId` split

### Summary

The single `EthAddressFormat` type has been split into two distinct types: `EthAddress` for raw Ethereum addresses and `EthEmbeddedAccountId` for account IDs that embed an Ethereum address. This provides clearer semantics for different use cases.

### Affected Code

Before:

```rust
let eth_addr = EthAddressFormat::new(*params.origin_token_address);
```

After:

```rust
let eth_addr = EthAddress::new(params.origin_token_address);
let embedded_id = EthEmbeddedAccountId::from_account_id(account_id);
```

### Migration Steps

1. Replace `EthAddressFormat::new(...)` with `EthAddress::new(...)` when working with raw Ethereum addresses.
2. Use `EthEmbeddedAccountId::from_account_id(...)` when extracting an Ethereum address from a Miden account ID.
3. Update imports to use the new type names.

## `SchemaTypeId` renamed to `SchemaType`

### Summary

`SchemaTypeId` has been renamed to `SchemaType`. This is a pure rename with no behavioral changes.

### Affected Code

Before:

```rust
use SchemaTypeId;

let t: SchemaTypeId = SchemaType::native_felt();
```

After:

```rust
use SchemaType;

let t: SchemaType = SchemaType::native_felt();
```

### Migration Steps

1. Find and replace all occurrences of `SchemaTypeId` with `SchemaType`.

## Common Errors Reference

| Error Message | Cause | Solution |
|---|---|---|
| `expected 3 arguments, found 2` on `AccountComponent::new` | Missing `AccountComponentMetadata` argument | Create metadata and pass as third argument |
| `no method named with_supports_all_types` | Removed builder method | Use `AccountType::all()` in `AccountComponentMetadata` |
| `AccountComponentTemplateError not found` | Type renamed | Replace with `ComponentMetadataError` |
| `AuthFalcon512Rpo not found` | Per-scheme auth types removed | Use `AuthSingleSig` with `AuthScheme::Falcon512Poseidon2` |
| `AuthEcdsaK256Keccak not found` | Per-scheme auth types removed | Use `AuthSingleSig` with `AuthScheme::EcdsaK256Keccak` |
| `no method named get_procedures` | Method renamed | Use `procedures()` (returns iterator) |
| `no method named commitment` | Method renamed | Use `to_commitment()` |
| `hash_account not found` | Function removed | Call `.to_commitment()` on the account instance |
| `expected Option<&PublicKey>, found Option<Arc<PublicKey>>` | Return type changed | Update signature to return `Option<Arc<PublicKey>>` |
| `expected 4 arguments, found 3` on `NetworkFungibleFaucet::new` | Owner removed from constructor | Remove owner arg; use `Ownable2Step` component instead |
| `EthAddressFormat not found` | Type split into two | Use `EthAddress` or `EthEmbeddedAccountId` |
| `SchemaTypeId not found` | Type renamed | Replace with `SchemaType` |
