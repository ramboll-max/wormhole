import 'dotenv/config';
import { execSync } from 'child_process';

const node = process.env.NODE;
const chainID = process.env.CHAIN_ID;
const from = process.env.METAOSD_FROM;
const tokenBridgeAddress = process.env.TOKEN_BRIDGE_ADDRESS;
const gas_prices = process.env.GAS_PRICES;
const asset = process.env.TOKEN_CONTRACT_ADDR;
const amount = "100";
const recipient_chain = 2;
const recipient = "000000000000000000000000011e8F7D1B292d05779d43c62EAF3e200872D1df";

const queryFlags = ` --chain-id ${chainID}  --node ${node}`;
const txFlags = ` --from ${from} ${queryFlags} --gas-prices ${gas_prices} --gas auto --gas-adjustment 1.3`;
const nonce = Math.round(Math.random() * 100000);
const executeMsg = {
    initiate_transfer: {
        asset: {
            amount: amount,
            info: {
                token:{
                    contract_addr: asset
                }
            },
        },
        recipient_chain: recipient_chain,
        recipient: Buffer.from(recipient.toLowerCase(), "hex").toString("base64"),
        fee: "0",
        nonce: nonce,
    },
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = execSync(`metaosd tx wasm execute ${tokenBridgeAddress} '${json}' ${txFlags} -y --output json`);
console.log(JSON.parse(`${res}`));

