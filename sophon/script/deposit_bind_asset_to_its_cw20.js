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

const executeFee = calculateFee(2_500_000, gasPrice);

const cw20 = "sop1unyuj8qnmygvzuex3dwmg9yzt9alhvyeat0uu0jedg2wj33efl5qlt4vce";
const denom = "token/weth/1";
const amount = "100000000000";
const executeMsg = {
    deposit: {}
};
const json = JSON.stringify(executeMsg);
console.log(json)
const res = await client.execute(acc_address, cw20, executeMsg, executeFee,"", [{denom: denom, amount: amount}]);
console.log(JSON.stringify(res, "", " "));

