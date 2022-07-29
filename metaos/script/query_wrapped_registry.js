import 'dotenv/config';
import {DirectSecp256k1HdWallet} from "@honsop/proto-signing";
import {SigningCosmWasmClient} from "@honsop/cosmwasm-stargate";
import { zeroPad } from "ethers/lib/utils.js";
import {fromHex} from "cosmwasm";

const node = process.env.NODE;
const mnemonic = process.env.MNEMONIC;
const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: "mtos",
});
const client = await SigningCosmWasmClient.connectWithSigner(
    node,
    wallet
);

const tokenBridgeAddress = process.env.TOKEN_BRIDGE_ADDRESS;
const eth_token_addr = process.env.ETH_ERC20;
const executeMsg = {
    wrapped_registry: {
        chain: 2,
        address: Buffer.from(zeroPad(fromHex(eth_token_addr.substring(2).toLowerCase()), 32), "hex").toString("base64"),
    }
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = await client.queryContractSmart(tokenBridgeAddress, executeMsg);
console.log(JSON.stringify(res, "", " "));
console.log("wrapped denom:", res.denom);

