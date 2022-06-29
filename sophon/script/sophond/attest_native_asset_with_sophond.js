import 'dotenv/config';
import { execSync } from 'child_process';

const node = process.env.NODE;
const chainID = process.env.CHAIN_ID;
const from = process.env.SOPHOND_FROM;
const tokenBridgeAddress = process.env.TOKEN_BRIDGE_ADDRESS;
const gas_prices = process.env.GAS_PRICES;
const asset = process.env.NATIVE_DENOM;

const queryFlags = ` --chain-id ${chainID}  --node ${node}`;
const txFlags = ` --from ${from} ${queryFlags} --gas-prices ${gas_prices} --gas auto --gas-adjustment 1.3`;
const nonce = Math.round(Math.random() * 100000);
const executeMsg = {
    create_asset_meta: {
        asset_info: {
            native_token: { denom: asset },
        },
        nonce: nonce,
    }
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = execSync(`sophond tx wasm execute ${tokenBridgeAddress} '${json}' ${txFlags} -y --output json`);
console.log(JSON.parse(`${res}`));

