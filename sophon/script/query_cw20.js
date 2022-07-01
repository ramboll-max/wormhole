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

const cw20_addr = "sop1qpd37axsflmamluefjszlu4ktgcnrps98rhr9lmkfn99mpwqhx3sg94f3e";
const acc_addr = wallet.getAccounts()[0];
const executeMsg = {
    banlance: {
        address: acc_addr,
    }
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = await client.queryContractSmart(cw20_addr, executeMsg);
console.log(JSON.stringify(res, "", " "));

