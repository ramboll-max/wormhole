import 'dotenv/config'
import { LCDClient, MnemonicKey } from "@terra-money/terra.js";
import {
  StdFee,
  MsgInstantiateContract,
  MsgExecuteContract,
  MsgStoreCode,
} from "@terra-money/terra.js";
import { readFileSync, readdirSync } from "fs";
import { Bech32, toHex } from "@cosmjs/encoding";
import { zeroPad } from "ethers/lib/utils.js";


/* Set up terra client & wallet */

const terra = new LCDClient({
  URL: "http://206.190.233.64:1317",
  chainID: "localterra",
});

const wallet = terra.wallet(
  new MnemonicKey({
    mnemonic:
      "arrow section slim fame leopard differ narrow million drink will intact snack enrich usage milk soft cheese jeans position target cart beyond pave toilet",
  })
);

await wallet.sequence();

const token_bridge_address = "terra1yqlpux74ruv9485pqfg6athkh056ayq0lye67s";
const create_wrapped_vaa = "0100000000010041c205b8cabcf2883d65b649e775c9d9eaabbae5b172d97d32d3e977e9bb7ea81f00b4183298623a01bf1bccb1109c456ce4c069e5286fb0acab972bd1f1364b0062932e2b0000248a000200000000000000000000000042802649071b7e1226352af76624bb5dc7774e1300000000000000010f02000000000000000000000000bab52a39946ea20175debf9e174c0963bba85c14000212544b4e0000000000000000000000000000000000000000000000000000000000574f524d484f4c45205465737420546f6b656e00000000000000000000000000";

console.log(`create wrapped token for token_bridge.wasm:`);
await wallet.createAndSignTx({
    msgs: [
      new MsgExecuteContract(
        wallet.key.accAddress,
        token_bridge_address,
        {
          submit_vaa: {
            data: Buffer.from(create_wrapped_vaa, "hex").toString("base64"),
          },
        },
        { uluna: 10000 }
      ),
    ],
    memo: "",
    fee: new StdFee(2000000, {
      uluna: "1000000",
    }),
  })
  .then((tx) => terra.tx.broadcast(tx))
  .then((rs) => console.log(rs));


// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_terra_address_to_hex(human_addr) {
  return "0x" + toHex(zeroPad(Bech32.decode(human_addr).data, 32));
}
