### Description
The indexer is a tool that is used to extract events from a Geth node using an RPC method and store it in a CSV file. The data captured is based on a deposit contract on Ethereum.

<b>Note</b>: This is a work in progress & currently the script only runs for 50 iterations and then exits. This is the sweet spot I found for the node to be responsive & avoid network issued.

## Installation & Usage 
```js
    // Clone the repository
    git clone https://github.com/abdulsamijay/Eth-deposit-indexer.git

    // Install dependencies
    npm install

    // Run the program 
    node index.js <fromBlock> <CSV_FILE_NAME> <RPC_ENDPOINT>
```

### Potential optimizations
1. Use package like `Commander` for better argument pasring.
2. Optimize the code to cater network delays & inefficiencies. This will probably target `eth_getTransactionByHash` to not fail for a large list if addresses.
3. Make the indexer generalize enough to capture different events as well.
4. Add support fot MongoDB &  PostgreQL
5. Add capability to subscribe new blocks if the range last block is current block. 