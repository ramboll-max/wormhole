const jsonfile = require("jsonfile");
const TokenImplementation = artifacts.require("TokenImplementation");
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const assetAddress = process.env.ASSET_ADDR;

module.exports = async function (callback) {
    try {
        const tokenBridge = new web3.eth.Contract(BridgeImplementationFullABI, ethTokenBridgeAddress);

        const wrappedAddress = await tokenBridge.methods.wrappedAsset("0x4e21", "0x" + assetAddress).call();
        console.log("wrapped address:", wrappedAddress);
        const isWrapped = await tokenBridge.methods.isWrappedAsset(wrappedAddress).call();
        console.log("is wrapped:", isWrapped);

        const wrappedAsset = new web3.eth.Contract(TokenImplementation.abi, wrappedAddress);

        const symbol = await wrappedAsset.methods.symbol().call();
        console.log("symbol:", symbol);
        const name = await wrappedAsset.methods.name().call();
        console.log("name:", name);
        const decimals = await wrappedAsset.methods.decimals().call();
        console.log("decimals:", decimals);
        const chainId = await wrappedAsset.methods.chainId().call();
        console.log("chain id:", chainId);
        const nativeContract = await wrappedAsset.methods.nativeContract().call();
        console.log("native contract:", nativeContract);

        callback();
    }
    catch (e) {
        callback(e);
    }
}