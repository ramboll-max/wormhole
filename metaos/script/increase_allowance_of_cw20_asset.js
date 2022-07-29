import 'dotenv/config';
import {DirectSecp256k1HdWallet} from "@honsop/proto-signing";
import {SigningCosmWasmClient} from "@honsop/cosmwasm-stargate";
import {calculateFee, GasPrice} from "@honsop/stargate";

const node = process.env.NODE;
const mnemonic = process.env.MNEMONIC;
const gas_prices = process.env.GAS_PRICES;
const amount = process.env.AMOUNT;
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
const asset = process.env.TOKEN_CONTRACT_ADDR;
const executeFee = calculateFee(2_500_000, gasPrice);
const executeMsg = {
    increase_allowance: {
        spender: tokenBridgeAddress,
        amount: amount,
        expires: {
            never: {},
        },
    },
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = await client.execute(acc_address, asset, executeMsg, executeFee);
console.log(JSON.stringify(res, "", " "));

