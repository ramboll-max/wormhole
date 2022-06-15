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
const redeem_vaa = "01000000000100bd6d5b444047f337de2c64dee6962f5d2d9f73c7ad10b241d110939131be34230bd37093e3ca17c483959e4fd64fff1e0e650e6676a65d1ac5fe0febcdb3814b01629335e900001985000200000000000000000000000042802649071b7e1226352af76624bb5dc7774e1300000000000000020f010000000000000000000000000000000000000000000000000000000000989680000000000000000000000000863bc2710723e9df0f035e8adaaa72780aacf4480002000000000000000000000000d0b5a34d542023128a36536b7adc95beffe4ca53000300000000000000000000000000000000000000000000000000000000000f4240";

console.log(`create wrapped token for token_bridge.wasm:`);
await wallet.createAndSignTx({
    msgs: [
      new MsgExecuteContract(
        wallet.key.accAddress,
        token_bridge_address,
        {
          submit_vaa: {
            data: Buffer.from(redeem_vaa, "hex").toString("base64"),
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
