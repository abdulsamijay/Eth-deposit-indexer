const Web3 = require("web3");
const axios = require("axios");
const fs = require("fs");
const fastcsv = require("fast-csv");

const contractAddress = "0x00000000219ab540356cBB839Cbe05303d7705Fa";
const ethContractAbi = [
  { inputs: [], stateMutability: "nonpayable", type: "constructor" },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "bytes", name: "pubkey", type: "bytes" },
      {
        indexed: false,
        internalType: "bytes",
        name: "withdrawal_credentials",
        type: "bytes",
      },
      { indexed: false, internalType: "bytes", name: "amount", type: "bytes" },
      {
        indexed: false,
        internalType: "bytes",
        name: "signature",
        type: "bytes",
      },
      { indexed: false, internalType: "bytes", name: "index", type: "bytes" },
    ],
    name: "DepositEvent",
    type: "event",
  },
  {
    inputs: [
      { internalType: "bytes", name: "pubkey", type: "bytes" },
      { internalType: "bytes", name: "withdrawal_credentials", type: "bytes" },
      { internalType: "bytes", name: "signature", type: "bytes" },
      { internalType: "bytes32", name: "deposit_data_root", type: "bytes32" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "get_deposit_count",
    outputs: [{ internalType: "bytes", name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "get_deposit_root",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "pure",
    type: "function",
  },
];

const main = async () => {
  const web3 = new Web3(process.argv[4]);
  const ethContract = new web3.eth.Contract(ethContractAbi, contractAddress);
  let fromBlock = parseInt(process.argv[2]),
    csvName = process.argv[3];
  console.log(
    "Fetching Block from",
    fromBlock,
    "===>",
    parseInt(fromBlock) + 50000
  );
  let start;
  let end;
  let eventArray = [];
  let i = 0;
  while (i < 50) {
    // 524
    try {
      // start block = 11052984
      if (i == 0) {
        start = fromBlock;
        end = fromBlock + 10000;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      let events = await retryRequest(
        () =>
          ethContract.getPastEvents(
            "DepositEvent",
            {
              fromBlock: start.toString(),
              toBlock: end.toString(),
            },
            (err, events) => {
              if (err) console.log("Error Occured: ", err);
            }
          ),
        5,
        1200
      );

      if (events.length != 0) {
        eventArray.push(events);
      }

      console.log(
        `Current Iteration: ${i}, startBlock ${start} -> endBlock ${end}, Events length : ${events.length}`
      );
      start = start + 10001;
      end = start + 10000;
      i++;
    } catch (err) {
      console.log("error", err);
      break; // exit the loop if there is an error
    }
  }
  console.log("Events Length", eventArray.flat().length);
  let txs = await createCSV(eventArray.flat(), csvName);
  console.log("Collected transactions Hashes ->", txs.length);
  await createTx(txs);
};

const retryRequest = async (fn, maxAttempts = 5, retryDelay = 1000) => {
  let error = true;
  let attempts = 0;
  while (error && attempts < maxAttempts) {
    try {
      error = null;
      return await fn();
    } catch (err) {
      error = err;
      attempts++;
      console.log(`Error occurred. Retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
  throw error;
};

const createTx = async (txs) => {
  const txCsv = fs.createWriteStream(`tx.csv`, { flags: "a" });
  txs = txs.map((tx) => [tx]);
  await fastcsv.write(txs, { headers: false }).pipe(txCsv);
  console.log("CSV file with Tx created.");
};

const createCSV = async (data, csvName) => {
  const txCsv = fs.createWriteStream(`${csvName}.csv`, { flags: "a" });

  let txHashes = [];
  let dup = 0;

  let csvData = data.map(
    ({ removed, blockNumber, transactionHash, returnValues }) => {
      // To avoid duplicate tx hashes
      if (!txHashes.includes(transactionHash)) {
        txHashes.push(transactionHash);
      } else {
        dup++;
      }
      return [
        blockNumber,
        transactionHash,
        returnValues.pubkey,
        returnValues.withdrawal_credentials,
        fromLittleEndian(returnValues.index),
        fromLittleEndian(returnValues.amount),
        removed,
      ];
    }
  );

  await fastcsv.write(csvData, { headers: false }).pipe(txCsv);
  console.log("No.of duplicate tx Hashes", dup);
  return txHashes;
};

function fromLittleEndian(str) {
  const arr = str.split("0x")[1].match(/.{1,2}/g);
  let newArr = [];
  newArr[0] = arr[7];
  newArr[1] = arr[6];
  newArr[2] = arr[5];
  newArr[3] = arr[4];
  newArr[4] = arr[3];
  newArr[5] = arr[2];
  newArr[6] = arr[1];
  newArr[7] = arr[0];
  return BigInt("0x" + newArr.join("")).toString();
}

main();
