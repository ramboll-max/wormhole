import 'dotenv/config';
import { execSync } from 'child_process';

const node = process.env.NODE;
const chainID = process.env.CHAIN_ID;
const from = process.env.SOPHOND_FROM;
const wormhole = process.env.WORMHOLE;
const gas_prices = process.env.GAS_PRICES;

const queryFlags = ` --chain-id ${chainID}  --node ${node}`;
const txFlags = ` --from ${from} ${queryFlags} --gas-prices ${gas_prices} --gas auto --gas-adjustment 1.3`;
const nonce = Math.round(Math.random() * 100000);
const executeMsg = {
    post_message: {
        message: 'abc',
        nonce: nonce,
    }
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = execSync(`sophond tx wasm execute ${wormhole} '${json}' ${txFlags} -y --output json`);
console.log(JSON.parse(`${res}`));

