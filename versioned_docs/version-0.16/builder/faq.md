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

For a client-executed transaction:

### 1. Transaction Creation

- User creates a transaction specifying the operations to perform (transfers, contract interactions, etc.)
- Client loads the account state and input notes needed for execution

### 2. Transaction Execution

- The Miden VM executes the note and transaction scripts locally
- The resulting state transitions and execution trace are computed
- During authentication, the account pays the protocol fee through a public `TX_FEE` note and authorizes the transaction summary

### 3. Proof Generation

- The client or a delegated prover generates a cryptographic proof attesting to the correctness of the execution

### 4. Transaction Submission

- The proven transaction, sealed inputs, and public state updates are submitted to Miden network nodes
- The node verifies the proof and admission rules before accepting the transaction into the mempool

### 5. Transaction Selection

- Accepted transactions are selected from the mempool
- Transactions are grouped into batches for inclusion in a block

### 6. Block Production

- Transaction batches and their proofs are assembled into a block
- The client synchronizes to observe the transaction's inclusion and updated state

### 7. L1 Submission

- Block proofs are aggregated for settlement
- The resulting proof and state commitments are submitted for L1 verification

### 8. Finalization

- L1 settlement establishes finality for the submitted state
- Inclusion in a Miden block does not by itself establish L1 finality

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

Miden testnet applications can integrate [Agglayer or Epoch](./tools/bridging/).
Agglayer provides canonical bridge semantics for ETH, while Epoch provides a
faster quote-and-solve flow for test USDC. Both integrations are testnet-only.

## What does the gas fee model of Miden look like?

Miden does not meter gas linearly. Its transaction fee grows logarithmically with the transaction's estimated VM cycles. During authentication, the account pays by creating a public `TX_FEE` note that the batch builder can collect. See [Transaction Fees](./smart-contracts/transactions/fees) for the formula, payment assets, and network-account sponsorship fees.
