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
  URL: "http://192.168.3.201:1317",
  chainID: "localterra",
});

const wallet = terra.wallet(
  new MnemonicKey({
    mnemonic:
      "arrow section slim fame leopard differ narrow million drink will intact snack enrich usage milk soft cheese jeans position target cart beyond pave toilet",
  })
);

await wallet.sequence();

const token_bridge_address = "terra10pyejy66429refv3g35g2t7am0was7ya7kz2a4";
const create_wrapped_vaa = "010000000001004d8b6e036e8fea8f6e738c6663abc8b6a8ad2e15c0e7d2b1cb2584eb3c68459a7e5d9b20e0023d59baeb748faeccb2be14d9750442895c6d47f3fd12b8ea011a0062b18fdb0000132600020000000000000000000000003b86ae4b1e9c906ef18e3dc3c6cbffe599a6a5e000000000000000000f020000000000000000000000006879f07e65f37cb4a003de1ac89157c550170d0600021257455448000000000000000000000000000000000000000000000000000000005772617070656420457468657200000000000000000000000000000000000000";

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
