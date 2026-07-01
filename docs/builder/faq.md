# FAQ

## How is privacy implemented in Miden?

Miden leverages zero-knowledge proofs and client side execution and proving to provide security and privacy.

## Does Miden support encrypted notes?

At the moment, Miden does not have support for encrypted notes but it is a planned feature.

## Why does Miden have delegated proving?

Miden leverages delegated proving for a few technical and practical reasons:

1. **Computational:** Generating zero-knowledge proofs is a computationally intensive work. The proving process requires significant processing power and memory, making it impractical for some end-user devices (like smartphones) to generate.
2. **Technical architecture**:
Miden's architecture separates concerns between:
    - **Transaction Creation**: End users create and sign transactions
    - **Proof Generation**: Specialized provers generate validity proofs
    - **Verification**: The network verifies these proofs
3. **Proving efficiency**:
Delegated provers can use optimized hardware that wouldn't be available to end-user devices, specifically designed for the mathematical operations needed in STARK proof generation.

## What is the lifecycle of a transaction?

### 1. Transaction Creation

- User creates a transaction specifying the operations to perform (transfers, contract interactions, etc.)
- Client performs preliminary validation of the transaction and its structure
- The user authorizes the specified state transitions by signing the transaction

### 2. Transaction Submission

- The signed transaction is submitted to Miden network nodes
- The transaction enters the mempool (transaction pool) where it waits to be selected to be included in the state
- Nodes perform basic validation checks on the transaction structure and signature

### 3. Transaction Selection

- A sequencer (or multiple sequencers in a decentralized setting) selects transactions from the mempool
- The sequencer groups transactions into bundles based on state access patterns and other criteria
- The transaction execution order is determined according to protocol mechanism

### 4. Transaction Execution

- The current state relevant to the transaction is loaded
- The Miden VM executes the transaction operations
- **State Transition Computation**: The resulting state transitions are computed
- An execution trace of the transaction is generated which captures all the computation

### 5. Proof Generation

- A STARK based cryptographic proof is generated attesting to the correctness of the execution
- A proof for the aggregated transaction is created

### 6. Block Production

- The aggregated bundle of transactions along with their proofs are assembled into a block
- A recursive proof attesting to all bundle proofs is generated
- The block data structure is finalized with the aggregated proof

### 7. L1 Submission

- Transaction data is posted to the data availability layer
- The block proof and state delta commitment are submitted to the Miden contract (that is bridged to Ethereum/Agglayer)
- The L1 contract verifies validity of the proof
- Upon successful verification, the L1 contract updates the state root

### 8. Finalization

- Transaction receipts and events are generated
- The global state commitment is updated to reflect the new state
- The transaction is now considered finalized on the L1
- Users and indexers get notified/updated about the transaction completion

## Do notes in Miden support recency conditions?

Yes, Miden enables consumption of notes based on time conditions, such as:

- A specific block height being reached
- A timestamp threshold being passed
- An oracle providing specific data
- Another transaction being confirmed

## What does a Miden operator do in Miden?

A Miden operator is an entity that maintains the infrastructure necessary for the functioning of the Miden layer 2. Their roles may involve:

1. Running Sequencer Nodes
2. Operating the Prover Infrastructure
3. Submitting Proofs to L1
4. Maintaining Data Availability
5. Participating in the Consensus Mechanism

## How does bridging work in Miden?

Miden does not yet have a fully operational bridge; it is a work in progress.

## What does the gas fee model of Miden look like?

Miden does not yet have a fully implemented fee model; it is a work in progress.
