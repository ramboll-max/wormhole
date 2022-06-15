import 'dotenv/config'
import { LCDClient, MnemonicKey } from "@terra-money/terra.js";
import {
  StdFee,
  MsgInstantiateContract,
  MsgExecuteContract,
  MsgStoreCode,
} from "@terra-money/terra.js";


/* Set up terra client & wallet */

const terra = new LCDClient({
  URL: "http://206.190.233.64:1317",
  chainID: "localterra",
});

const txHash = "F8F6371A891079E637CF39BF30BDCE6264E911D164A4FD487A187EE2D6D54E27";

const result = await terra.tx.txInfo(txHash);
const json = JSON.stringify(JSON.parse(result.toJSON()), null, 2)
console.log(json);



