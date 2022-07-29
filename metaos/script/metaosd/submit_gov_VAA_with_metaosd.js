import 'dotenv/config';
import { execSync } from 'child_process';

const node = process.env.NODE;
const chainID = process.env.CHAIN_ID;
const from = process.env.METAOSD_FROM;
const wormhole_address = process.env.WORMHOLE;
const vaa = process.env.VAA;
const gas_prices = process.env.GAS_PRICES;

const queryFlags = ` --chain-id ${chainID}  --node ${node}`;
const txFlags = ` --from ${from} ${queryFlags} --gas-prices ${gas_prices} --gas auto --gas-adjustment 1.3`;
const executeMsg = {
    submit_v_a_a: {
        vaa: Buffer.from(vaa, "hex").toString("base64"),
    }
};
const json = JSON.stringify(executeMsg);
console.log(json)
const submitVAARes = execSync(`metaosd tx wasm execute ${wormhole_address} '${json}' ${txFlags} -y --output json`);
console.log(`${submitVAARes}`);

