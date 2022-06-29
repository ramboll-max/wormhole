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
const eth_token_addr = "a3b8F4ef8F1B981F7fF83Dc7317a56DbDDaC8349";
const executeMsg = {
    wrapped_registry: {
        chain: 2,
        address: Buffer.from(zeroPad(fromHex(eth_token_addr.toLowerCase()), 32), "hex").toString("base64"),
    }
};
const json = JSON.stringify(executeMsg);
console.log(json)
const submitVAARes = await client.queryContractSmart(tokenBridgeAddress, executeMsg);
console.log(JSON.stringify(submitVAARes, "", " "));

