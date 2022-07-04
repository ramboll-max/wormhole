import 'dotenv/config';
import {DirectSecp256k1HdWallet} from "@honsop/proto-signing";
import {SigningCosmWasmClient} from "@honsop/cosmwasm-stargate";
import {calculateFee, GasPrice} from "@honsop/stargate";

const node = process.env.NODE;
const mnemonic = process.env.MNEMONIC;
const gas_prices = process.env.GAS_PRICES;
const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: "sop",
});
const client = await SigningCosmWasmClient.connectWithSigner(
    node,
    wallet
);
const account = await wallet.getAccounts();
const acc_address = account[0].address;
const gasPrice = GasPrice.fromString(gas_prices);

const tokenBridgeAddress = process.env.TOKEN_BRIDGE_ADDRESS;
const asset = process.env.TOKEN_CONTRACT_ADDR;
const executeFee = calculateFee(2_500_000, gasPrice);
const amount = "1000000000000000000";
const recipient_chain = 2;
const recipient = "000000000000000000000000011e8F7D1B292d05779d43c62EAF3e200872D1df";
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
const res = await client.execute(acc_address, tokenBridgeAddress, executeMsg, executeFee);
console.log(JSON.stringify(res, "", " "));

