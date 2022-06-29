import 'dotenv/config';
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from "fs";
import { zeroPad } from "ethers/lib/utils.js";
import { fromBech32, toHex} from "@cosmjs/encoding";
import {DirectSecp256k1HdWallet} from "@honsop/proto-signing";
import {SigningCosmWasmClient} from "@honsop/cosmwasm-stargate";
import {calculateFee, GasPrice} from "@honsop/stargate";


const node = "http://127.0.0.1:26657";
const mnemonic = process.env.MNEMONIC;
const gas_prices = process.env.GAS_PRICES;
const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: "sop",
});
const client = await SigningCosmWasmClient.connectWithSigner(
    node,
    wallet
);
const account = await wallet.getAccounts();
const acc_address = account[0].address;
const gasPrice = GasPrice.fromString(gas_prices);

// Upload wasm file
console.log("==== Upload ====");
const uploadFee = calculateFee(3_000_000, gasPrice);
const filepath = `../artifacts/cw20_wrapped_native_bound.wasm`;
const contract_bytes = readFileSync(filepath);
console.log(`Storing WASM: cw20_wrapped_native_bound.wasm (${contract_bytes.length} bytes)`);
const uploadRes = await client.upload(
    acc_address,
    contract_bytes,
    uploadFee,
    ""
);
console.log(JSON.stringify(uploadRes, "", " "));
const codeIdStr = uploadRes.codeId;
const codeId = parseInt(codeIdStr);
console.log("code id:", codeId);

// Instantiate
console.log("==== Instantiate ====");
const instantiateFee = calculateFee(2_500_000, gasPrice);
const inst_msg = {
    name: "MOCK",
    symbol: "MCK",
    decimals: 14,
    asset_chain: 20001,
    asset_address: Buffer.from("0000000000000000000000000000000000000000000000000000000000000008", "hex").toString("base64"),
    mint: {
        recipient: "sop1wk4manyfhfx3sgzgp8k0fjf3jmra796kllxdgs",
        amount: "100",
    },
}
let json = JSON.stringify(inst_msg);
console.log(json)
const instRes = await client.instantiate(
    acc_address,
    codeId,
    inst_msg,
    "test",
    instantiateFee,
    { memo: "" }
);
// console.log(JSON.stringify(instRes, "", " "));
const address = instRes.contractAddress;
console.log(
    `Instantiated cw20_wrapped_native_bound.wasm at ${address} (${convert_sophon_address_to_hex(
        address
    )})`
);
const denom = /"denom","value":"([^"]+)/gm.exec(JSON.stringify(instRes.logs))[1];
console.log("denom:", denom);

// Check balances
console.log("==== Balances ====");
let queryBalances = await client.getBalance(acc_address, denom);
console.log(`balance of ${acc_address}:`, queryBalances);

// Invoke Deposit
console.log("==== Deposit ====");
const executeFee = calculateFee(2_500_000, gasPrice);
const depositAmount = "10";
let executeMsg = {
    deposit: {}
};
json = JSON.stringify(executeMsg);
console.log(json)
const depositRes = await client.execute(acc_address, address, executeMsg, executeFee, "", [{denom: denom, amount: depositAmount}]);
// console.log(JSON.stringify(depositRes, "", " "));

queryBalances = await client.getBalance(acc_address, denom);
console.log(`balance of ${acc_address}:`, queryBalances);
queryBalances = await client.getBalance(address, denom);
console.log(`balance of ${address} contract:`, queryBalances);

// Invoke Mint
console.log("==== Mint ====");
const mintTarget = "sop1f44emghn4vs6p2kkapl5xluc0w2jf78j28x5ef";
executeMsg = {
    mint: {
        recipient: mintTarget,
        amount: "1",
    }
};
json = JSON.stringify(executeMsg);
console.log(json)
const mintRes = await client.execute(acc_address, address, executeMsg, executeFee);
// console.log(JSON.stringify(mintRes, "", " "));

queryBalances = await client.getBalance(mintTarget, denom);
console.log(`balance of ${mintTarget}:`, queryBalances);
queryBalances = await client.getBalance(address, denom);
console.log(`balance of ${address} contract:`, queryBalances);

// Invoke Burn
console.log("==== Burn ====");
executeMsg = {
    burn: {
        account: acc_address,
        amount: "3",
    }
};
json = JSON.stringify(executeMsg);
console.log(json)
const burnRes = await client.execute(acc_address, address, executeMsg, executeFee);
// console.log(JSON.stringify(burnRes, "", " "));

queryBalances = await client.getBalance(acc_address, denom);
console.log(`balance of ${acc_address}:`, queryBalances);
queryBalances = await client.getBalance(address, denom);
console.log(`balance of ${address} contract:`, queryBalances);

// Call WrappedAssetInfo
console.log("==== Call WrappedAssetInfo ====");
executeMsg = {
    wrapped_asset_info: {}
};
json = JSON.stringify(executeMsg);
console.log(json)
const wrappedAssetInfoRes = await client.queryContractSmart(address, executeMsg);
console.log(JSON.stringify(wrappedAssetInfoRes, "", " "));

// Call Balance
console.log("==== Call Balance ====");
executeMsg = {
    balance: { address: `${address}`}
};
json = JSON.stringify(executeMsg);
console.log(json)
const balanceRes = await client.queryContractSmart(address, executeMsg);
console.log(JSON.stringify(wrappedAssetInfoRes, "", " "));

// Call TokenInfo
console.log("==== Call TokenInfo ====");
executeMsg = {
    token_info: {}
};
json = JSON.stringify(executeMsg);
console.log(json)
const tokenInfoRes = await client.queryContractSmart(address, executeMsg);
console.log(JSON.stringify(tokenInfoRes, "", " "));

// Call Allowance



// Sophon addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_sophon_address_to_hex(human_addr) {
    return "0x" + toHex(zeroPad(fromBech32(human_addr).data, 32));
}
