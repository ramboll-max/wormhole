import 'dotenv/config';
import {keccak256} from "@ethersproject/keccak256";

const asset = process.env.TOKEN_CONTRACT_ADDR;
const buffer = Buffer.from(asset, "utf8");
const hash = Buffer.from(keccak256(buffer).substring(2), "hex");
hash[0] = 0;
console.log("asset_address(Wormhole format):", hash.toString("hex"));
