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
// const TokenImplementationFullABI = jsonfile.readFileSync("../build/contracts/TokenImplementation.json").abi

const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const TokenAddress = "0x0019da61c726129972d11c4da58a7153cb9beff008baa03f63767543740ed45f"

module.exports = async function (callback) {
    try {
        const signedAttestTokenVAA = "0100000000010050d4c0b8e8a2217974924a4b4175e61f04b1af342b22769f43b5c2156f6dc5b573349d322969dd08b6a8db6abefc2e377ec126915717bc5c35e713a97c573f680062b45ee6000090e54e21190aed381dc7e577997e7a5bd6ed542ceecbf07a731e93df618a0686bb09adef000000000000000200020019da61c726129972d11c4da58a7153cb9beff008baa03f63767543740ed45f4e21064d434b00000000000000000000000000000000000000000000000000000000004d4f434b00000000000000000000000000000000000000000000000000000000"
        const accounts = await web3.eth.getAccounts();
        const tokenBridge = new web3.eth.Contract(BridgeImplementationFullABI, ethTokenBridgeAddress);

        // attest token
        const result = await tokenBridge.methods.createWrapped(
            "0x" + signedAttestTokenVAA
        ).send({
            value: 0,
            from: accounts[0],
            gasLimit: 2000000,
        });

        console.log(result);

        // tx hash
        console.log("tx hash", result.transactionHash);
        // block hash
        console.log("block hash", result.blockHash);
        // block num
        const blockNum = result.blockNumber;
        console.log("block num", blockNum);

        const wrappedAddress = await tokenBridge.methods.wrappedAsset("0x4e21", TokenAddress).call();
        console.log("wrapped address", wrappedAddress);
        const isWrapped = await tokenBridge.methods.isWrappedAsset(wrappedAddress).call();
        console.log("is wrapped", isWrapped);

        const wrappedAsset = new web3.eth.Contract(TokenImplementation.abi, wrappedAddress);

        const symbol = await wrappedAsset.methods.symbol().call();
        console.log("symbol", symbol);
        const name = await wrappedAsset.methods.name().call();
        console.log("name", name);
        const decimals = await wrappedAsset.methods.decimals().call();
        console.log("decimals", decimals);
        const chainId = await wrappedAsset.methods.chainId().call();
        console.log("chain id", chainId);
        const nativeContract = await wrappedAsset.methods.nativeContract().call();
        console.log("native contract", nativeContract);

        callback();
    }
    catch (e) {
        callback(e);
    }
}