const path = require('path')
const Web3 = require("web3");
const fastcsv = require("fast-csv");
const axios = require("axios");
const fs = require('fs')
const mongoose = require("mongoose");
const Contract = require('./const')
require('mongoose-long')(mongoose);
const Int32 = require("mongoose-int32").loadType(mongoose);
import { txFromToInterface } from './types';

export const getEvents = async (fromBlock: number, toBlock: string | undefined, fileName: string) => {
  const loopJump = 50;
  console.log('from block', typeof fromBlock)
  const web3 = new Web3(process.env.API);
  const newToBlock = toBlock == undefined ? await web3.eth.getBlockNumber() : toBlock;

  const ethContract = new web3.eth.Contract(Contract.ethContractAbi, Contract.contractAddress);
  const range: number = newToBlock - fromBlock;

  for (let i = -1; i < range; i += loopJump) {

    let secondLoopEvents = await ethContract.getPastEvents(
      'DepositEvent',
      {
        fromBlock: (+fromBlock + i + 1).toString(),
        toBlock: (+fromBlock + loopJump + i).toString(),
      }
    )

    const firstLoopEvents = secondLoopEvents.map((
      { removed, blockNumber, transactionHash, returnValues }:
        { removed: boolean, blockNumber: string, transactionHash: string, returnValues: any }
    ) => {
      console.log('tx hash', transactionHash)
      return [
        blockNumber,
        transactionHash,
        returnValues.pubkey,
        returnValues.withdrawal_credentials,
        removed,
      ]
    })

    const eventsCsv = fs.createWriteStream(fileName ? `data/${fileName.toString()}.csv` : 'data/events.csv', { flags: 'a' })
    fastcsv.write(firstLoopEvents, { headers: false }).pipe(eventsCsv)
  }
}

let txFromTo: txFromToInterface[] = [];
const { Types: { Long } } = mongoose;

export const getTransaction = async (hash: string, rpcEndpoint: string | undefined, maxAttempts = 5) => {
  let error: boolean = true;
  let attempts = 0;

  while (error && attempts < maxAttempts) {
    try {
      const options = {
        method: "POST",
        url: rpcEndpoint,
        data: {
          jsonrpc: "2.0",
          method: "eth_getTransactionByHash",
          params: [hash],
          id: 1,
        },
      };

      const response = await axios(options);
      txFromTo.push({
        from: response?.data?.result?.from,
        to: response?.data?.result?.to,
        hash: response?.data?.result?.hash,
      });
      error = false;
      await new Promise((resolve) => setTimeout(resolve, 30));

    } catch (e: any) {
      console.log('Error', e)
      error = e;
      console.error(error, hash);
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
};

export const getTxs = async (fileNameFrom: string, fileNameTo: string) => {
  const cwd = process.cwd()
  fs.readFile(`${cwd}/${fileNameFrom ? fileNameFrom : 'data/events'}.csv`, 'utf-8', async (err: string, data: string) => {
    if (data) {
      const res = data.split(',')
      for (let i = 1; i < res.length; i += 4) {
        console.log('res', res[i])
        await getTransaction(res[i].toString(), process.env.RPC_ENDPOINT)
      }
      const txCsv = fs.createWriteStream(fileNameTo ? `${fileNameTo.toString()}.csv` : 'data/tx.csv', { flags: 'a' });
      fastcsv.write(txFromTo.map(({ from, to, hash }) => [to, from, hash]), { headers: true }).pipe(txCsv)
    }
  })
}

export const uniqueToAndFrom = async () => {

  const mongoUri = process.env.MONGO_URI;

  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = mongoose.connection;
  db.once("open", () => {
    console.log("Connected to DB.");
  });

  const schema = new mongoose.Schema({
    Block_Number: Int32,
    From: String,
    To: String,
    Tx_Hash: String,
    Validator_Amount: Long,
    Validator_Index: Int32,
    Validator_Public_Key: String,
    Withdrawal_Credentials: String,
  })

  const Model = mongoose.model("datas", schema)

  const res = await Model.aggregate([
    {
      "$group": {
        "_id": "$To",
      },
    },

  ])

  const txCsv = fs.createWriteStream('UniqueTo.csv', { flags: 'a' });
  fastcsv.write(res.map(({ _id }: any) => [_id]), { headers: true }).pipe(txCsv)

  console.log('Wrie to DB Completed.')

}


export const repeatingTxHashes = async () => {

  const mongoUri = process.env.MONGO_URI;

  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = mongoose.connection;
  db.once("open", () => {
    console.log("Connection Done.");
  });

  const schema = new mongoose.Schema({
    Block_Number: Int32,
    From: String,
    To: String,
    Tx_Hash: String,
    Validator_Amount: Long,
    Validator_Index: Int32,
    Validator_Public_Key: String,
    Withdrawal_Credentials: String,
  })

  const Model = mongoose.model("datas", schema)
  const agg1 = await Model.aggregate([
    {
      "$group": {
        "_id": "$Tx_Hash",
        "To": {
          $addToSet: "$To",
        },
        "count": {
          "$sum": 1
        }
      }
    },
  ]);
}

export const readUniqueFromCsv = async () => {

  fs.readFile('data/uniqueFrom.csv', 'utf-8', async (err: string, data: string) => {
    if (data) {
      console.log('data', data)
    }

  })
}

export const merge = async () => {
  fs.readFile('data/events.csv', 'utf-8', (err: string, data: string) => {
    if (data) {
      const events = data.split('\n')
      fs.readFile('data/tx.csv', 'utf-8', (err: string, tx: string) => {
        if ((tx != null) && !err) {
          const result: any = events.map((event, index) => {
            const res2: any = tx.split('\n')[index].split(',')
            const res3: any = event.split(',')
            return res3.concat(res2[0], res2[1])
          })
          console.log('result', result)

          const mergeCsv = fs.createWriteStream('data/merge.csv', { flags: 'a' });
          fastcsv.write(result, { headers: true }).pipe(mergeCsv)
        }
      })
    }
  })
}