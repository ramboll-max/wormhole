import 'dotenv/config'
import { LCDClient, MnemonicKey } from "@terra-money/terra.js";
import {
  MsgExecuteContract,
} from "@terra-money/terra.js";


/* Set up terra client & wallet */
const lcdURL = process.env.LCD_URL;
const chainID = process.env.CHAIN_ID;
const terra = new LCDClient({
    URL: lcdURL,
    chainID: chainID,
});

const mnemonic = process.env.MNEMONIC;
const wallet = terra.wallet(
  new MnemonicKey({
    mnemonic:mnemonic,
  })
);

await wallet.sequence();

const wormhole_address = process.env.WORMHOLE;
const vaa = process.env.VAA;


console.log(`Submit VAA for wormhole.wasm(${wormhole_address}):`);
const msg = new MsgExecuteContract(
    wallet.key.accAddress,
    wormhole_address,
    {
        submit_v_a_a: {
            vaa: Buffer.from(vaa, "hex").toString("base64"),
        },
    },
    {}
);
const gasPrices = await terra.config.gasPrices;
const feeEstimate = await terra.tx.estimateFee(
    wallet.key.accAddress,
    [msg],
    {
        memo: "",
        feeDenoms: ["uluna"],
        gasPrices,
    }
);
await wallet.createAndSignTx({
    msgs: [msg],
    memo: "",
    feeDenoms: ["uluna"],
    gasPrices,
    fee: feeEstimate,
  })
  .then((tx) => terra.tx.broadcast(tx))
  .then((rs) => console.log(rs));

