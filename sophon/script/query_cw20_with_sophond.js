import 'dotenv/config';
import { execSync } from 'child_process';

const node = process.env.NODE;
const chainID = process.env.CHAIN_ID;
const from = process.env.SOPHOND_FROM;
const tokenAddress = process.env.TOKEN_CONTRACT_ADDR;
const accountAddress = "sop1fjxjm3xc9s3u280eclzesy6ns4y4wgq0fc5a9k";

const queryFlags = ` --chain-id ${chainID}  --node ${node}`;

// Balance
const balanceMsg = {
    balance: {
        address: accountAddress,
    }
};
let json = JSON.stringify(balanceMsg);
// console.log(json)
const balanceRes = execSync(`sophond query wasm contract-state smart ${tokenAddress} '${json}' ${queryFlags} --output json`);
console.log("balance res:", JSON.parse(`${balanceRes}`));

// TokenInfo
const tokenInfoMsg = {
    token_info:{}
}
json = JSON.stringify(tokenInfoMsg);
const tokenInfoRes = execSync(`sophond query wasm contract-state smart ${tokenAddress} '${json}' ${queryFlags} --output json`);
console.log("token info res:", JSON.parse(`${tokenInfoRes}`));

// WrappedAssetInfo (wrapped asset only)
const wrappedAssetInfo = {
    wrapped_asset_info:{}
}
json = JSON.stringify(wrappedAssetInfo);
const wrappedAssetInfoRes = execSync(`sophond query wasm contract-state smart ${tokenAddress} '${json}' ${queryFlags} --output json`);
console.log("wrapped asset info res:", JSON.parse(`${wrappedAssetInfoRes}`));