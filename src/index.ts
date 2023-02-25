const { Command } = require("commander");
require('dotenv').config();
import {
  getEvents,
  getTransaction,
  getTxs,
  uniqueToAndFrom,
  repeatingTxHashes,
  readUniqueFromCsv,
  merge,
} from './services';

const program = new Command();

// In these options default value for events and tx files will taken as 'events.csv' and 'tx.csv' respectively
program
  .version("1.0.0")
  .description("Hello sami!")
  .option("--from, --fromBlock <fromBlock>", "From Block")
  .option("--to, --toBlock <optional toBlock>", "To Block")
  .option("--fn, --fileName <optional fileName>", "File Name")
  .option("--fnFrom, --fileNameFrom <optional fileName>", "File Name From")
  .option("--fnTo, --fileNameTo <optional fileName>", "File Name To")
  .option("-h, hash", "Get tx hash")
  .option("-m, merge", "Merge")
  .option("-u, unique", "Unique")
  .option("-r, repeating tx hashes", "repeating")
  .option("-xyz, csv", "read csv")

program.parse(process.argv);
const options = program.opts();

if (options.fromBlock) {
  getEvents(parseInt(options.fromBlock), options.toBlock, options.fileName)
}


else if (options.hash) {
  getTxs(options.fileNameFrom, options.fileNameTo)
}

else if (options.merge) {
  merge()
}

else if (options.unique) {
  uniqueToAndFrom()
}

else if (options.repeating) {
  repeatingTxHashes()
}

else if (options.csv) {
  readUniqueFromCsv()
}

else if (options.rapid) {
  console.log('hello')
}