const jsonfile = require("jsonfile");
const BigNumber = require("bignumber.js");

const Wormhole = artifacts.require("Wormhole");
const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementation = artifacts.require("BridgeImplementation");
const TokenImplementation = artifacts.require("TokenImplementation");
const FeeToken = artifacts.require("FeeToken");
const MockBridgeImplementation = artifacts.require("MockBridgeImplementation");
const MockWETH9 = artifacts.require("MockWETH9");

const WormholeImplementationFullABI = jsonfile.readFileSync("../build/contracts/Implementation.json").abi
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi
const TokenImplementationFullABI = jsonfile.readFileSync("../build/contracts/TokenImplementation.json").abi

const wrappedAssetAddress = "0xDEE3a565D2b761EdE10adDF2813a11fbb931763d"
const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const signedVAA = "010000000001004ff2df6b5dc5112b513d3d0e2ada7136780c803b12f49e6472c8f8acf3f7d75702ad4f7e5c6e28cf21cbbe95533227ec36fd98d7002eeccec7e29fc523170af10062b46021000098ef4e21190aed381dc7e577997e7a5bd6ed542ceecbf07a731e93df618a0686bb09adef0000000000000003000100000000000000000000000000000000000000000000000000000000000000640019da61c726129972d11c4da58a7153cb9beff008baa03f63767543740ed45f4e21000000000000000000000000011e8f7d1b292d05779d43c62eaf3e200872d1df00020000000000000000000000000000000000000000000000000000000000000000"

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const wrappedAsset = new web3.eth.Contract(TokenImplementation.abi, wrappedAssetAddress);

        const totalSupply = await wrappedAsset.methods.totalSupply().call();
        console.log("total supply of wrapped asset", totalSupply);

        const tokenBridge = new web3.eth.Contract(BridgeImplementationFullABI, ethTokenBridgeAddress);

        // complete transfer
        const result = await tokenBridge.methods.completeTransfer(
            "0x" + signedVAA
        ).send({
            value: 0,
            from: accounts[0],
            gasLimit: 2000000,
        });

        console.log(result);

        const totalSupplyAfter = await wrappedAsset.methods.totalSupply().call();
        console.log("total supply of wrapped asset (NEW)", totalSupplyAfter);
        const accountBalanceAfter =  await wrappedAsset.methods.balanceOf(accounts[0]).call();
        console.log("account balance of wrapped asset (NEW)", accountBalanceAfter);

        callback();
    }
    catch (e) {
        callback(e);
    }
}