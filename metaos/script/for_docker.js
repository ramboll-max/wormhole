import "dotenv/config";
import { SigningCosmWasmClient } from "@honsop/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@honsop/proto-signing";
import { calculateFee, GasPrice } from "@honsop/stargate";
import { fromBech32, toHex } from "@honsop/encoding";
import { zeroPad } from "ethers/lib/utils.js";
import * as fs from "fs";

const node = process.env.NODE;
const mnemonic = process.env.MNEMONIC;
const gas_prices = process.env.GAS_PRICES;
const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
  prefix: "mtos",
});
const client = await SigningCosmWasmClient.connectWithSigner(
    node,
    wallet
);
const account = await wallet.getAccounts();
const address = account[0].address;
const gasPrice = GasPrice.fromString(gas_prices);
const uploadFee = calculateFee(3_000_000, gasPrice);
const instantiateFee = calculateFee(2_500_000, gasPrice);
// console.log(account, address, gasPrice, uploadFee);
const artifacts = [
  "wormhole.wasm",
  "token_bridge_metaos.wasm",
  "cw20_base.wasm",
];

/* Check that the artifact folder contains all the wasm files we expect and nothing else */
const path = "../artifacts/";
const actual_artifacts = fs
  .readdirSync(path)
  .filter((a) => a.endsWith(".wasm"));

const missing_artifacts = artifacts.filter(
  (a) => !actual_artifacts.includes(a)
);
if (missing_artifacts.length) {
  console.log(
    "Error during metaos deployment. The following files are expected to be in the artifacts folder:"
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
    "Error during metaos deployment. The following files are not expected to be in the artifacts folder:"
  );
  unexpected_artifacts.forEach((file) => console.log(`  - ${file}`));
  console.log("Hint: you might need to modify tools/deploy_metaos.js");
  process.exit(1);
}

// const codeIds = { "cw20_base.wasm": 113 };
const codeIds = {};
for (const file of artifacts) {
  const contract_bytes = fs.readFileSync(`${path}${file}`);

  try {
    const uploadReceipt = await client.upload(
      address,
      contract_bytes,
      uploadFee,
      ""
    );

    const ci = uploadReceipt.codeId;
    codeIds[file] = parseInt(ci);
    console.log(`${file} code id: ${ci}`);
  } catch (e) {
    console.log(`${e}`);
  }
}

// console.log("codeIds:", codeIds);

/* Instantiate contracts.
 *
 * We instantiate the core contracts here (i.e. wormhole itself and the bridge contracts).
 * The wrapped asset contracts don't need to be instantiated here, because those
 * will be instantiated by the on-chain bridge contracts on demand.
 * */

async function instantiate(contract, inst_msg) {
  const { contractAddress } = await client.instantiate(
    address,
    codeIds[contract],
    inst_msg,
    "My instance",
    instantiateFee,
    { memo: "" }
  );
  return contractAddress;
}

// Instantiate contracts.  NOTE: Only append at the end, the ordering must be
// deterministic for the addresses to work
const init_guardians = JSON.parse(process.env.INIT_SIGNERS);
if (!init_guardians || init_guardians.length === 0) {
  throw "failed to get initial guardians from .env file.";
}

// Governance constants defined by the Wormhole spec.
const govChain = parseInt(process.env.INIT_GOV_CHAIN_ID);
const govAddress = process.env.INIT_GOV_ADDRESS;
const govAddressBase64 = Buffer.from(govAddress, "hex").toString("base64");

const wormholeAddress = await instantiate("wormhole.wasm", {
  gov_chain: govChain,
  gov_address: govAddressBase64,
  guardian_set_expirity: 86400,
  initial_guardian_set: {
    addresses: init_guardians.map((hex) => {
      return {
        bytes: Buffer.from(hex, "hex").toString("base64"),
      };
    }),
    expiration_time: 0,
  },
});

console.log(`Wormhole Contract address: ${wormholeAddress}`);

const tokenBridgeAddress = await instantiate(
  "token_bridge_metaos.wasm",
  {
    gov_chain: govChain,
    gov_address: govAddressBase64,
    wormhole_contract: wormholeAddress,
  }
);

console.log(`TokenBridge Contract address: ${tokenBridgeAddress}`);

const mockCW20Address = await instantiate("cw20_base.wasm", {
  name: "MOCK",
  symbol: "MCK",
  decimals: 18,
  initial_balances: [
    {
      address: address,
      amount: "100000000000000000000",
    },
  ],
  mint: null,
});

console.log(`MOCK CW20 Token Contract address: ${mockCW20Address}`);
