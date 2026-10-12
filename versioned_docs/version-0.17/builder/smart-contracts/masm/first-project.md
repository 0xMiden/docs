---
title: "Your first MASM project"
description: "Assemble and execute a standalone MASM program with a Rust host."
sidebar_position: 1
---

# Your first MASM project

Build a small project that multiplies a rectangle's width and height in Miden Assembly (MASM), executes it locally, and checks the result. This gives you a working assembly-and-execution loop before adding account storage or note inputs.

The MASM file runs inside Miden VM. The Rust program is a **host** that supplies inputs and runs the VM on your computer; it is not a Rust guest contract and does not use the Rust-to-MASM compiler. A standalone VM program also has no Miden transaction kernel, account, or note context. The [account component](./account-components) and [note script](./note-scripts) guides add those contexts.

## Prerequisites

Install Rust through `rustup`, with Cargo available in your shell. This project uses Rust **1.98.1** and pins `miden-assembly` and `miden-processor` to **0.35.0**, the VM dependency line used by Miden protocol v0.17. The protocol and VM crates have separate version numbers.

```bash
rustup toolchain install 1.98.1 --profile minimal
mkdir -p masm-first-project/src
cd masm-first-project
```

## 1. Pin the project dependencies

Create these files. The empty `[workspace]` keeps the example independent if you place it inside another Cargo workspace.

```toml title="Cargo.toml"
[package]
name = "masm-first-project"
version = "0.1.0"
edition = "2024"
rust-version = "1.98.1"
publish = false

[dependencies]
miden-assembly = "=0.35.0"
miden-processor = "=0.35.0"

[workspace]
```

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.98.1"
profile = "minimal"
```

## 2. Write the MASM program

```masm title="src/area.masm"
begin
    # Input stack: [width, height, ...]
    mul
    # Output stack: [area, ...]
end
```

`begin` and `end` delimit the executable entrypoint. `mul` consumes the top two stack elements and pushes their product. Here, the stack changes from `[7, 6, 0, ...]` to `[42, 0, ...]`; the leftmost element is the top of the stack. Ordinary MASM arithmetic operates on field elements, so these small positive values behave like familiar integer arithmetic.

## 3. Assemble and execute it

```rust title="src/main.rs"
use miden_assembly::Assembler;
use miden_processor::{DefaultHost, FastProcessor, Felt, StackInputs};

fn main() {
    let program = Assembler::default()
        .assemble_program("rectangle-area", include_str!("area.masm"))
        .expect("MASM program should assemble")
        .unwrap_program();

    // StackInputs puts the first element at the top of the operand stack.
    let inputs = StackInputs::new(&[Felt::from(7u32), Felt::from(6u32)])
        .expect("two inputs fit on the stack");
    let output = FastProcessor::new(inputs)
        .execute_sync(&program, &mut DefaultHost::default())
        .expect("MASM program should execute");

    let area = output.stack[0].as_canonical_u64();
    assert_eq!(area, 42);
    assert!(
        output.stack[1..]
            .iter()
            .all(|element| *element == Felt::from(0u32))
    );
    println!("area: {area}");
}
```

`Assembler` returns an executable package; `unwrap_program()` extracts its VM program. `StackInputs` sets the initial operand stack, padding unused positions with zeros. `FastProcessor` executes the program, and `DefaultHost` supplies the host interface. The two assertions check both the result and the remaining output stack.

## 4. Run the project

```bash
cargo generate-lockfile
cargo run --locked
```

After Cargo's build output, expect:

```text
area: 42
```

Keep `Cargo.lock` in source control so future runs use the same resolved dependencies. The complete example, including its lockfile, is in the docs repository at `examples/masm/first-project`; from that directory you can run `cargo run --locked` directly.

This executes MASM locally and checks its output. To submit a Miden transaction, you also need the transaction kernel, an account, and the appropriate client or transaction executor.

## Next steps

- [MASM account components](./account-components) — package reusable procedures and account storage.
- [MASM note scripts](./note-scripts) — define the conditions under which an account can consume a note.
- [MASM Smart Contracts](./) — choose the guide for your contract's execution context.
- [Playground](../../tools/playground) — experiment with MASM instructions in the browser.
