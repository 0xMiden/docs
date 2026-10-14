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
