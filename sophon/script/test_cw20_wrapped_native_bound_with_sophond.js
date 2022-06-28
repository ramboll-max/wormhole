import 'dotenv/config';
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from "fs";
import { zeroPad } from "ethers/lib/utils.js";
import { fromBech32, toHex} from "@cosmjs/encoding";


const node = "http://127.0.0.1:26657";
const chainID = process.env.CHAIN_ID;
const from = "alice";
const from_addr = "sop1wk4manyfhfx3sgzgp8k0fjf3jmra796kllxdgs";
const gas_prices = process.env.GAS_PRICES;

const queryFlags = ` --chain-id ${chainID} --node ${node}`;
const txFlags = ` --from ${from} ${queryFlags} --gas-prices ${gas_prices} --gas auto --gas-adjustment 1.3`;

// Upload wasm file
console.log("==== Upload ====");
const filepath = `../artifacts/cw20_wrapped_native_bound.wasm`;
const contract_bytes = readFileSync(filepath);
console.log(`Storing WASM: cw20_wrapped_native_bound.wasm (${contract_bytes.length} bytes)`);
const uploadRes = execSync(`sophond tx wasm store ${filepath} ${txFlags} -y --output json -b block`);
// console.log(`${uploadRes}`);
const codeIdStr = /"code_id","value":"([^"]+)/gm.exec(`${uploadRes}`)[1];
const codeId = parseInt(codeIdStr);
console.log("code id:", codeId);

// Instantiate
console.log("==== Instantiate ====");
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
const instRes = execSync(`sophond tx wasm instantiate ${codeId} '${json}' ${txFlags} --label "test" -y --no-admin --output json`);
const resJson = JSON.parse(`${instRes}`);
console.log(resJson);
const address = /"_contract_address","value":"([^"]+)/gm.exec(JSON.stringify(resJson))[1];
console.log(
    `Instantiated cw20_wrapped_native_bound.wasm at ${address} `
);
const denom = /"denom","value":"([^"]+)/gm.exec(JSON.stringify(resJson))[1];
console.log("denom:", denom);

// Check balances
console.log("==== Balances ====");
let queryBalances = execSync(`sophond query bank balances ${from_addr} --denom ${denom} ${queryFlags} --output json`);
let balanceJson = JSON.parse(queryBalances);
console.log(`balance of ${from_addr}:`, balanceJson);

// Invoke Deposit
console.log("==== Deposit ====");
const depositAmount = `10${denom}`;
let executeMsg = {
    deposit: {}
};
json = JSON.stringify(executeMsg);
console.log(json)
const depositRes = execSync(`sophond tx wasm execute ${address} '${json}' --amount ${depositAmount} ${txFlags} -y --output json`);
// console.log(JSON.parse(`${depositRes}`));

queryBalances = execSync(`sophond query bank balances ${from_addr} --denom ${denom} ${queryFlags} --output json`);
balanceJson = JSON.parse(queryBalances);
console.log(`balance of ${from_addr}:`, balanceJson);

queryBalances = execSync(`sophond query bank balances ${address} --denom ${denom} ${queryFlags} --output json`);
balanceJson = JSON.parse(queryBalances);
console.log(`balance of ${address} contract:`, balanceJson);

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
const mintRes = execSync(`sophond tx wasm execute ${address} '${json}' ${txFlags} -y --output json`);
// console.log(JSON.parse(`${mintRes}`));

queryBalances = execSync(`sophond query bank balances ${mintTarget} --denom ${denom} ${queryFlags} --output json`);
balanceJson = JSON.parse(queryBalances);
console.log(`balance of ${mintTarget}:`, balanceJson);

queryBalances = execSync(`sophond query bank balances ${address} --denom ${denom} ${queryFlags} --output json`);
balanceJson = JSON.parse(queryBalances);
console.log(`balance of ${address} contract:`, balanceJson);

// Invoke Burn
console.log("==== Burn ====");
executeMsg = {
    burn: {
        account: from_addr,
        amount: "3",
    }
};
json = JSON.stringify(executeMsg);
console.log(json)
const burnRes = execSync(`sophond tx wasm execute ${address} '${json}' ${txFlags} -y --output json`);
// console.log(JSON.parse(`${burnRes}`));

queryBalances = execSync(`sophond query bank balances ${from_addr} --denom ${denom} ${queryFlags} --output json`);
balanceJson = JSON.parse(queryBalances);
console.log(`balance of ${from_addr}:`, balanceJson);

queryBalances = execSync(`sophond query bank balances ${address} --denom ${denom} ${queryFlags} --output json`);
balanceJson = JSON.parse(queryBalances);
console.log(`balance of ${address} contract:`, balanceJson);

// Call WrappedAssetInfo
console.log("==== Call WrappedAssetInfo ====");
executeMsg = {
    wrapped_asset_info: {}
};
json = JSON.stringify(executeMsg);
console.log(json)
const wrappedAssetInfoRes = execSync(`sophond query wasm contract-state smart ${address} '${json}' ${queryFlags} --output json`);
console.log("wrapped asset info res:", `${wrappedAssetInfoRes}`)

// Call Balance
console.log("==== Call Balance ====");
executeMsg = {
    balance: { address: `${address}`}
};
json = JSON.stringify(executeMsg);
console.log(json)
const balanceRes = execSync(`sophond query wasm contract-state smart ${address} '${json}' ${queryFlags} --output json`);
console.log("balance res:", `${balanceRes}`)

// Call TokenInfo
console.log("==== Call TokenInfo ====");
executeMsg = {
    token_info: {}
};
json = JSON.stringify(executeMsg);
console.log(json)
const tokenInfoRes = execSync(`sophond query wasm contract-state smart ${address} '${json}' ${queryFlags} --output json`);
console.log("token info res:", `${tokenInfoRes}`)

// Call Allowance


