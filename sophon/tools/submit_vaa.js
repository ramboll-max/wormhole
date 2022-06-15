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

/* Registrations: tell the bridge contracts to know about each other */
const token_bridge_address = process.env.TOKEN_BRIDGE_ADDRESS;
const vaa = process.env.VAA;


console.log(`Submit VAA for token_bridge_terra.wasm(${token_bridge_address}):`);
const msg = new MsgExecuteContract(
    wallet.key.accAddress,
    token_bridge_address,
    {
        submit_vaa: {
            data: Buffer.from(vaa, "hex").toString("base64"),
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

