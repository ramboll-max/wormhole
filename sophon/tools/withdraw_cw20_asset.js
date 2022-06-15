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

const token_bridge_address = process.env.TOKEN_BRIDGE_ADDRESS;
const cw20Address = process.env.TOKEN_CONTRACT_ADDR;

console.log(`attest cw20 asset for token_bridge.wasm:`);
const nonce = Math.round(Math.random() * 100000);
const msg = new MsgExecuteContract(
    wallet.key.accAddress,
    token_bridge_address,
    {
        withdraw_tokens: {
            asset: {
                token: { contract_addr: cw20Address },
            },
            nonce: nonce,
        },
    },
    {}
)
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

