import 'dotenv/config';
import {DirectSecp256k1HdWallet} from "@honsop/proto-signing";
import {SigningCosmWasmClient} from "@honsop/cosmwasm-stargate";
import {calculateFee, GasPrice} from "@honsop/stargate";

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
const acc_address = account[0].address;
const gasPrice = GasPrice.fromString(gas_prices);

const tokenBridgeAddress = process.env.TOKEN_BRIDGE_ADDRESS;
const vaa = process.env.VAA;
const executeFee = calculateFee(2_500_000, gasPrice);
const executeMsg = {
    submit_vaa: {
        data: Buffer.from(vaa, "hex").toString("base64"),
    }
};
const json = JSON.stringify(executeMsg);
console.log(json)
const submitVAARes = await client.execute(acc_address, tokenBridgeAddress, executeMsg, executeFee);
console.log(JSON.stringify(submitVAARes, "", " "));

