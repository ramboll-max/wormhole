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
const denom = process.env.DENOM;
const executeFee = calculateFee(2_500_000, gasPrice);
const amount = process.env.AMOUNT;
const recipient_chain = 2;
const eth_recipient = process.env.ETH_RECIPIENT;
const recipient = "0000000000000000000000000" + eth_recipient.substring(2);
const nonce = Math.round(Math.random() * 100000);
const executeMsg = {
    initiate_transfer: {
        asset: {
            amount: amount,
            info: {
                bank_token:{
                    denom: denom
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
const logJson = JSON.stringify(res.logs);
const message_sender = /"message.sender","value":"([^"]+)/gm.exec(`${logJson}`)[1];
const message_chain_id = /"message.chain_id","value":"([^"]+)/gm.exec(`${logJson}`)[1];
const message_sequence = /"message.sequence","value":"([^"]+)/gm.exec(`${logJson}`)[1];
console.log("message_id:", `${message_chain_id}/${message_sender}/${message_sequence}`)
