import 'dotenv/config'
import { readFileSync, readdirSync } from "fs";
import { Bech32, toHex } from "@cosmjs/encoding";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import { zeroPad } from "ethers/lib/utils.js";
import { SigningCosmWasmClient, Secp256k1HdWallet } from "cosmwasm";


/*
  NOTE: Only append to this array: keeping the ordering is crucial, as the
  contracts must be imported in a deterministic order so their addresses remain
  deterministic.
*/
const artifacts = [
  "wormhole.wasm",
  "token_bridge_sophon.wasm",
  "cw20_wrapped.wasm",
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

/* Set up terra client & wallet */
const lcdURL = process.env.LCD_URL;
const chainID = process.env.CHAIN_ID;
const mnemonic = process.env.MNEMONIC;


const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "sop"});
const accounts = await wallet.getAccounts();
// const address = accounts[0].address;
// console.log(address);
const address = "sop1wk4manyfhfx3sgzgp8k0fjf3jmra796kllxdgs";
const client = await SigningCosmWasmClient.connectWithSigner(lcdURL, wallet,
    { prefix: "sop", gasPrice: GasPrice.fromString("0.025sop1zrr6f0se68v95l4zq35t2zuzecd2a6zmakx3ux")});

/* Deploy artifacts */

const codeIds = {};
for (const file of artifacts) {
  const contract_bytes = readFileSync(`../artifacts/${file}`);
  console.log(`Storing WASM: ${file} (${contract_bytes.length} bytes)`);

  const res = await client.upload(address, contract_bytes, "auto", "");
  codeIds[file] = res.codeId;
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

async function instantiate(contract, inst_msg) {
  client.instantiate()
  var address;
  await wallet
    .createAndSignTx({
      msgs: [
        new MsgInstantiateContract(
          wallet.key.accAddress,
          wallet.key.accAddress,
          codeIds[contract],
          inst_msg
        ),
      ],
      memo: "",
    })
    .then((tx) => terra.tx.broadcast(tx))
    .then((rs) => {
      address = /"contract_address","value":"([^"]+)/gm.exec(rs.raw_log)[1];
    });
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

const init_guardians = JSON.parse(process.env.INIT_SIGNERS)
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
});

addresses["token_bridge_sophon.wasm"] = await instantiate("token_bridge_sophon.wasm", {
  gov_chain: govChain,
  gov_address: Buffer.from(govAddress, "hex").toString("base64"),
  wormhole_contract: addresses["wormhole.wasm"],
  wrapped_asset_code_id: codeIds["cw20_wrapped.wasm"],
});

addresses["mock.wasm"] = await instantiate("cw20_base.wasm", {
  name: "MOCK",
  symbol: "MCK",
  decimals: 6,
  initial_balances: [
    {
      address: wallet.key.accAddress,
      amount: "100000000",
    },
  ],
  mint: null,
});

// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_terra_address_to_hex(human_addr) {
  return "0x" + toHex(zeroPad(Bech32.decode(human_addr).data, 32));
}
