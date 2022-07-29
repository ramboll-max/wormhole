import 'dotenv/config';
import { execSync } from 'child_process';

const node = process.env.NODE;
const chainID = process.env.CHAIN_ID;
const from = process.env.METAOSD_FROM;
const tokenBridgeAddress = process.env.TOKEN_BRIDGE_ADDRESS;
const gas_prices = process.env.GAS_PRICES;
const asset = process.env.TOKEN_CONTRACT_ADDR;
const amount = "100";

const queryFlags = ` --chain-id ${chainID}  --node ${node}`;
const txFlags = ` --from ${from} ${queryFlags} --gas-prices ${gas_prices} --gas auto --gas-adjustment 1.3`;
const executeMsg = {
    increase_allowance: {
        spender: tokenBridgeAddress,
        amount: amount,
        expires: {
            never: {},
        },
    },
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = execSync(`metaosd tx wasm execute ${asset} '${json}' ${txFlags} -y --output json`);
console.log(JSON.parse(`${res}`));

