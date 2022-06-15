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

const wormholeAddress = "0x098809840f2473734C6E08316F64a42c84f72ecC"
const ethTokenBridgeAddress = "0x0fa39beE01f74B2707B0B74c64203e8D66C464A2"
const WETHAddress = "0x863bC2710723E9Df0f035E8aDAaA72780aaCF448"
const wrappedAssetAddress = "0xE56dff9beA2C40F3f5886b72582e6E79F4c21591"
const signedVAA = "0100000000010055cedfd9e09a1a98da1ebb78f9608ac697714f265614fe2e45a5303c576150f11b015733a53e63d992a1ba92bcb12be327570d37fe82eaa7957b31d1efaa2b6800628b3db50000000400010000000000000000000000000fa39bee01f74b2707b0b74c64203e8d66c464a200000000000000030f010000000000000000000000000000000000000000000000000000000000989680000000000000000000000000863bc2710723e9df0f035e8adaaa72780aacf448000100000000000000000000000071e92dd01db6baad6a6c964e4cdde29e252e4b93000200000000000000000000000000000000000000000000000000000000000f4240"

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