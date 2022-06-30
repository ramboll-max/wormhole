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
const signedVAA = "01000000000100cd9572ca33f07bdb9888c0afe24392f1bdded3f819f659ced599b85d46c7875e24b4fb7a725439f488f88ed1cfaaa3d05fe234d8ac985401151799bb62d125070062bd537b000147a04e219e28beafa966b2407bffb0d48651e94972a56e69f3c0897d9e8facbdaeb9838600000000000000010001000000000000000000000000000000000000000000000000000000174876e800000000000000000000000000a3b8f4ef8f1b981f7ff83dc7317a56dbddac83490002000000000000000000000000011e8f7d1b292d05779d43c62eaf3e200872d1df00020000000000000000000000000000000000000000000000000000000000000000"

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        // const wrappedAsset = new web3.eth.Contract(TokenImplementation.abi, wrappedAssetAddress);

        // const totalSupply = await wrappedAsset.methods.totalSupply().call();
        // console.log("total supply of wrapped asset", totalSupply);

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

        // const totalSupplyAfter = await wrappedAsset.methods.totalSupply().call();
        // console.log("total supply of wrapped asset (NEW)", totalSupplyAfter);
        // const accountBalanceAfter =  await wrappedAsset.methods.balanceOf(accounts[0]).call();
        // console.log("account balance of wrapped asset (NEW)", accountBalanceAfter);

        callback();
    }
    catch (e) {
        callback(e);
    }
}