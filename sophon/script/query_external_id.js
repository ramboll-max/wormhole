import 'dotenv/config';
import {DirectSecp256k1HdWallet} from "@honsop/proto-signing";
import {SigningCosmWasmClient} from "@honsop/cosmwasm-stargate";
import { zeroPad } from "ethers/lib/utils.js";
import {fromHex} from "cosmwasm";

const node = process.env.NODE;
const mnemonic = process.env.MNEMONIC;
const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: "sop",
});
const client = await SigningCosmWasmClient.connectWithSigner(
    node,
    wallet
);

const tokenBridgeAddress = process.env.TOKEN_BRIDGE_ADDRESS;
const external_id = process.env.EXTERNAL_ID;
const executeMsg = {
    external_id: {
        external_id: Buffer.from(external_id, "hex").toString("base64"),
    },
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = await client.queryContractSmart(tokenBridgeAddress, executeMsg);
console.log(JSON.stringify(res, "", " "));
