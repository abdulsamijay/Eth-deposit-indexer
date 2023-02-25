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
    const web3 = new Web3(process.env.API);
    const newToBlock = toBlock == undefined ? await web3.eth.getBlockNumber() : toBlock;
  
    const ethContract = new web3.eth.Contract(Contract.ethContractAbi, Contract.contractAddress);
    const range:number = newToBlock - fromBlock;
    
    for(let i = -1; i < range; i += loopJump) {
  
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
        return [
          blockNumber,
          transactionHash,
          returnValues.pubkey,
          returnValues.withdrawal_credentials,
          removed,
        ]
    })
  
    const eventsCsv = fs.createWriteStream(fileName ? `${fileName.toString()}.csv` : 'events.csv', { flags: 'a' })
    fastcsv.write(firstLoopEvents, { headers: false } ).pipe(eventsCsv)
    }
}
  
  let txFromTo: txFromToInterface[] = [];
  const {Types: {Long}} = mongoose;
  
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
        console.log('======== error ========', e)
        error = e;
        console.error(error, hash);
        attempts++;
        // failedTxHash.push(JSON.parse(e.config.data).params[0]);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        // if(attempts == 5) failedTxs.push(hash)
      }
    }
};
  
export const getTxs = async (fileNameFrom: string, fileNameTo: string) => {
    const cwd = process.cwd()
    fs.readFile(`${cwd}/${fileNameFrom ? fileNameFrom : 'events'}.csv`, 'utf-8', async(err: string, data: string) => {
      if(data) {
        const res = data.split(',')
        for(let i=1; i < res.length; i+=4) {
          await getTransaction(res[i].toString(), process.env.RPC_ENDPOINT)
        }
        const txCsv = fs.createWriteStream(fileNameTo ? `${fileNameTo.toString()}.csv` : 'tx.csv', { flags: 'a' });
        fastcsv.write(txFromTo.map(({from, to, hash}) => [ to, from, hash ]), { headers: true }).pipe(txCsv)
      }
    })
}

export const uniqueToAndFrom = async() => {

  const mongoUri = process.env.MONGO_URI;
  
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = mongoose.connection;
  db.once("open", () => {
    console.log("connection done ====>>>>");
  });

  const schema = new mongoose.Schema ({
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

  Model.findOne().then((res: any) => console.log('res', res))
  const res =  await Model.aggregate([
    { 
      "$group": { 
        "_id": "$To",
      },
    },

  ])
  const txCsv = fs.createWriteStream('UniqueTo.csv', { flags: 'a' });
  fastcsv.write(res.map(({_id}: any) => [ _id ]), { headers: true }).pipe(txCsv)

}


export const repeatingTxHashes = async () => {
  const mongoUri = process.env.MONGO_URI;
  
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = mongoose.connection;
  db.once("open", () => {
    console.log("connection done ====>>>>");
  });

  const schema = new mongoose.Schema ({
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
  const agg1 =  await Model.aggregate([
    { "$group": {
      "_id": "$Tx_Hash",
        "To": {
        $addToSet: "$To",        
      },
      "count": {
        "$sum": 1
      }
    } },
  ]);

  console.log('Finished')

}

export const readUniqueFromCsv = async () => {
  console.log('readUniqueFromCsv')

  fs.readFile('UniqueFrom.csv', 'utf-8', async(err: string, data: string) => {
    if(data) {
      console.log('data', data)
    }

})
}

export const merge = async () => {
  fs.readFile('events.csv','utf-8', (err: string, data: string) => {
    if(data) {
      const events = data.split('\n') 
      fs.readFile('tx.csv', 'utf-8', (err2: string, data2: string) => {
        if(data2) {
          const result: any = events.map((event, index) => {
          const res2: any = data2.split('\n')[index].split(',')
          const res3: any = event.split(',')
          return res3.concat(res2[0], res2[1])
        })   
        const mergeCsv = fs.createWriteStream('Merge.csv', { flags: 'a' });
        fastcsv.write(result, { headers: true }).pipe(mergeCsv)
        }
      })  
    }
  })
}

export const rapidNetwork = async () => {
  console.log('rapidNetwork')

  const Validator_Public_Keys = [
    '0x933ad9491b62059dd065b560d256d8957a8c402cc6e8d8ee7290ae11e8f7329267a8811c397529dac52ae1342ba58c95',
    '0xa1d1ad0714035353258038e964ae9675dc0252ee22cea896825c01458e1807bfad2f9969338798548d9858a571f7425c',
    '0xb2ff4716ed345b05dd1dfc6a5a9fa70856d8c75dcc9e881dd2f766d5f891326f0d10e96f3a444ce6c912b69c22c6754d',
    '0x8e323fd501233cd4d1b9d63d74076a38de50f2f584b001a5ac2412e4e46adb26d2fb2a6041e7e8c57cd4df0916729219',
    '0xa62420543ceef8d77e065c70da15f7b731e56db5457571c465f025e032bbcd263a0990c8749b4ca6ff20d77004454b51',
    '0xb2ce0f79f90e7b3a113ca5783c65756f96c4b4673c2b5c1eb4efc2228025944106d601211e8866dc5b50dc48a244dd7c',
    '0xa16c530143fc72497a85e0de237be174f773cc1e496a94bd13d02708e0fdc1b5c7d25a9c2c05f09d5de8b8ed2bf8e0d2',
    '0xa25da1827014cd3bc6e7b70f1375750935a16f00fbe186cc477c204d330cac7ee060b68587c5cdcfae937176a4dd2962',
    '0x8078c7f4ab6f9eaaf59332b745be8834434af4ab3c741899abcff93563544d2e5a89acf2bec1eda2535610f253f73ee6',
    '0xb016e31f633a21fbe42a015152399361184f1e2c0803d89823c224994af74a561c4ad8cfc94b18781d589d03e952cd5b',
    '0x8efba2238a00d678306c6258105b058e3c8b0c1f36e821de42da7319c4221b77aa74135dab1860235e19d6515575c381',
    '0xa2dce641f347a9e46f58458390e168fa4b3a0166d74fc495457cb00c8e4054b5d284c62aa0d9578af1996c2e08e36fb6'
  ] 

  Validator_Public_Keys.map((pubKey) => {

      var config = {
      method: 'get',
      url: `https://api.rated.network/v0/eth/validators/${pubKey}`,
      headers: { 
        'accept': 'application/json', 
        'X-Rated-Network': 'mainnet', 
        'Authorization': 'Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzY29wZXMiOltdLCJpZCI6ImE0ODFkY2M3M2QxNTQ2Y2RiYjI1ZGE1YTEzZjJhNWU5Iiwic3ViIjoiZDM0ZTYxMmFhYjk5NDc3YTk0MWY5MGQ3ZWI0M2Q0MzYiLCJleHAiOjE3MDYwMDg5OTN9.hZZbF86R3J52v8HYQ6NfpsUrBFuzSkCON29vORIOnayH2Ly1a-ZXK8hVPlGwrXqm2gHAhxGKb5pmwbAegNPzzQ'
      }
    };

    axios(config)
      .then(function (response: any) {
        console.log(JSON.stringify(response.data));
      })
      .catch(function (error: any) {
        console.log('error', error)
      })

  })
}