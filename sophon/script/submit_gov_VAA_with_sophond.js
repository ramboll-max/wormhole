import 'dotenv/config';
import { spawn, execSync } from 'child_process';
import { readFileSync, readdirSync } from "fs";
import { zeroPad } from "ethers/lib/utils.js";
import {Bech32, fromBech32, toHex} from "@cosmjs/encoding";

const node = process.env.NODE;
const chainID = process.env.CHAIN_ID;
const from = process.env.SOPHOND_FROM;
const wormhole_address = process.env.WORMHOLE;
const vaa = process.env.VAA;

const queryFlags = ` --chain-id ${chainID}  --node ${node}`;
const txFlags = ` --from ${from} ${queryFlags} --gas-prices 0.025sop1zrr6f0se68v95l4zq35t2zuzecd2a6zmakx3ux --gas auto --gas-adjustment 1.3`;
const executeMsg = {
    submit_v_a_a: {
        vaa: Buffer.from(vaa, "hex").toString("base64"),
    }
};
const json = JSON.stringify(executeMsg);
console.log(json)
const submitVAARes = execSync(`sophond tx wasm execute ${wormhole_address} '${json}' ${txFlags} -y --output json`);
console.log(`${submitVAARes}`);

