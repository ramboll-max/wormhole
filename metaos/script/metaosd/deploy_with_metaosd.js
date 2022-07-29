import 'dotenv/config';
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from "fs";
import { zeroPad } from "ethers/lib/utils.js";
import { fromBech32, toHex} from "@cosmjs/encoding";


/*
  NOTE: Only append to this array: keeping the ordering is crucial, as the
  contracts must be imported in a deterministic order so their addresses remain
  deterministic.
*/
const artifacts = [
    "wormhole.wasm",
    "token_bridge_metaos.wasm",
    "cw20_base.wasm"
];

/* Check that the artifact folder contains all the wasm files we expect and nothing else */

const actual_artifacts = readdirSync("../artifacts/").filter((a) =>
    a.endsWith(".wasm")
);

const missing_artifacts = artifacts.filter(
    (a) => !actual_artifacts.includes(a)
);
if (missing_artifacts.length) {
    console.log(
        "Error during terra deployment. The following files are expected to be in the artifacts folder:"
    );
    missing_artifacts.forEach((file) => console.log(`  - ${file}`));
    console.log(
        "Hint: the deploy script needs to run after the contracts have been built."
    );
    console.log(
        "External binary blobs need to be manually added in tools/Dockerfile."
    );
    process.exit(1);
}

const unexpected_artifacts = actual_artifacts.filter(
    (a) => !artifacts.includes(a)
);
if (unexpected_artifacts.length) {
    console.log(
        "Error during terra deployment. The following files are not expected to be in the artifacts folder:"
    );
    unexpected_artifacts.forEach((file) => console.log(`  - ${file}`));
    console.log("Hint: you might need to modify tools/deploy.js");
    process.exit(1);
}

/* Set up metaos client & wallet */
const node = process.env.NODE;
const chainID = process.env.CHAIN_ID;
const from = process.env.METAOSD_FROM;
const gas_prices = process.env.GAS_PRICES;

const queryFlags = ` --chain-id ${chainID} --node ${node}`;
const txFlags = ` --from ${from} ${queryFlags} --gas-prices ${gas_prices} --gas auto --gas-adjustment 1.3`;

/* Deploy artifacts */

const codeIds = {};
for (const file of artifacts) {
    const filepath = `../artifacts/${file}`;
    const contract_bytes = readFileSync(filepath);
    console.log(`Storing WASM: ${file} (${contract_bytes.length} bytes)`);
    const uploadRes = execSync(`metaosd tx wasm store ${filepath} ${txFlags} -y --output json -b block`);
    // console.log(`${uploadRes}`);
    const codeId = /"code_id","value":"([^"]+)/gm.exec(`${uploadRes}`)[1];
    codeIds[file] = parseInt(codeId);
}

console.log(codeIds);

/* Instantiate contracts.
 *
 * We instantiate the core contracts here (i.e. wormhole itself and the bridge contracts).
 * The wrapped asset contracts don't need to be instantiated here, because those
 * will be instantiated by the on-chain bridge contracts on demand.
 * */

// Governance constants defined by the Wormhole spec.
const govChain = Number.parseInt(process.env.INIT_GOV_CHAIN_ID);
const govAddress = process.env.INIT_GOV_ADDRESS;

async function instantiate(contract, inst_msg, label) {
    const json = JSON.stringify(inst_msg);
    const instRes = execSync(`metaosd tx wasm instantiate ${codeIds[contract]} '${json}' ${txFlags} --label "${label}" -y --no-admin --output json`);
    const resJson = JSON.parse(`${instRes}`);
    // console.log(resJson);
    const address = /"_contract_address","value":"([^"]+)/gm.exec(JSON.stringify(resJson))[1];
    console.log(
        `Instantiated ${contract} at ${address} (${convert_terra_address_to_hex(
            address
        )})`
    );
    return address;
}

// Instantiate contracts.  NOTE: Only append at the end, the ordering must be
// deterministic for the addresses to work

const addresses = {};

const init_guardians = JSON.parse(process.env.INIT_SIGNERS);
if (!init_guardians || init_guardians.length === 0) {
    throw "failed to get initial guardians from .env file."
}
addresses["wormhole.wasm"] = await instantiate("wormhole.wasm", {
    gov_chain: govChain,
    gov_address: Buffer.from(govAddress, "hex").toString("base64"),
    guardian_set_expirity: 86400,
    initial_guardian_set: {
        addresses: init_guardians.map(hex => {
            return {
                bytes: Buffer.from(hex, "hex").toString("base64")
            }
        }),
        expiration_time: 0,
    },
}, "wormhole metaos");

addresses["token_bridge_metaos.wasm"] = await instantiate("token_bridge_metaos.wasm", {
    gov_chain: govChain,
    gov_address: Buffer.from(govAddress, "hex").toString("base64"),
    wormhole_contract: addresses["wormhole.wasm"],
    wrapped_asset_code_id: codeIds["cw20_wrapped.wasm"],
}, "wormhole metaos");

const showKeyRes = execSync(`metaosd keys show ${from} ${queryFlags} --output json`)
const senderAddr = JSON.parse(`${showKeyRes}`).address;

addresses["mock.wasm"] = await instantiate("cw20_base.wasm", {
    name: "MOCK",
    symbol: "MCK",
    decimals: 6,
    initial_balances: [
        {
            address: senderAddr,
            amount: "100000000",
        },
    ],
    mint: null,
}, "wormhole metaos");

// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_terra_address_to_hex(human_addr) {
    return "0x" + toHex(zeroPad(fromBech32(human_addr).data, 32));
}
