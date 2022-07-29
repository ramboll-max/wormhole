import 'dotenv/config';
import {DirectSecp256k1HdWallet} from "@honsop/proto-signing";
import {SigningCosmWasmClient} from "@honsop/cosmwasm-stargate";

const node = process.env.NODE;
const mnemonic = process.env.MNEMONIC;
const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: "mtos",
});
const client = await SigningCosmWasmClient.connectWithSigner(
    node,
    wallet
);

const cw20_addr = "mtos17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9jfksztgw5uh69wac2pgsye5na3";
const account = await wallet.getAccounts();
const acc_addr = account[0].address;
console.log(acc_addr)
const executeMsg = {
    balance: {
        address: acc_addr,
    }
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = await client.queryContractSmart(cw20_addr, executeMsg);
console.log(JSON.stringify(res, "", " "));

