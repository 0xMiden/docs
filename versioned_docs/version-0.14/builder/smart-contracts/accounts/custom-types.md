---
title: "Custom Types"
sidebar_position: 3
description: "Export custom structs and enums for use in public component methods with #[export_type]."
---

# Custom Types

When public [component](./components) methods use custom structs or enums, those types must be annotated with `#[export_type]` so the compiler can include them in the component's public API. Types used only internally (in private methods or local variables) don't need this annotation.

:::tip
If you forget `#[export_type]` on a public API type, the compiler will emit an error telling you to add it.
:::

## Exporting structs

Struct fields must be public and use types that are either SDK types (`Felt`, `Word`, `Asset`, etc.) or themselves marked with `#[export_type]`:

```rust
use miden::{export_type, Felt, Word, Asset, component};

#[export_type]
pub struct StructA {
    pub foo: Word,
    pub asset: Asset,
}

#[export_type]
pub struct StructB {
    pub bar: Felt,
    pub baz: Felt,
}

#[component]
struct MyAccount;

#[component]
impl MyAccount {
    pub fn process(&self, a: StructA, asset: Asset) -> StructB {
        StructB {
            bar: a.foo[0],
            baz: a.foo[1],
        }
    }
}
```

## Exporting enums

Enums use the same annotation. Enum variants can be unit variants:

```rust
use miden::{export_type, Felt};

#[export_type]
pub enum Status {
    Active,
    Inactive,
}
```

## Nested types

Exported types can reference other exported types:

```rust
#[export_type]
pub struct Inner {
    pub value: Felt,
}

#[export_type]
pub struct Outer {
    pub nested: Inner,
}
```

The compiler resolves references regardless of declaration order.

## Types in submodules

Custom types can be defined in submodules. Each type still needs `#[export_type]`:

```rust
pub mod my_types {
    use miden::{Felt, export_type};

    #[export_type]
    pub struct StructC {
        pub inner1: Felt,
        pub inner2: Felt,
    }
}
```

## Rules summary

| Rule | Details |
|------|---------|
| When needed | Any custom type in a `pub fn` signature on a `#[component]` impl |
| Struct fields | Must be `pub` |
| Allowed field types | `Felt`, `Word`, `Asset`, `AccountId`, or other `#[export_type]` types |
| Enums | Unit variants supported |
| Modules | Types in submodules work — just apply `#[export_type]` to each |
| Order | Declaration order doesn't matter — forward references are resolved |

:::info API Reference
Full API docs on docs.rs: [`miden`](https://docs.rs/miden/latest/miden/) (`#[export_type]` macro)
:::
