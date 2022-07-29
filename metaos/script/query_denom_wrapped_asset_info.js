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
const asset = process.env.DENOM;
const executeMsg = {
    denom_wrapped_asset_info: {
        denom: asset
    },
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = await client.queryContractSmart(tokenBridgeAddress, executeMsg);
console.log(JSON.stringify(res, "", " "));

console.log("asset_address(Wormhole format):", Buffer.from(res.asset_address, "base64").toString("hex"))

