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
const TokenAddress = "0x00b5ae2086e5ff00859248bb39fc1f1e96a7a052e3916e9497c21aacd72f8f78"

module.exports = async function (callback) {
    try {
        const signedAttestTokenVAA = "0100000000010051e617ee3748bd5933085d93214e3d5d74be33c383b435b175b203ad4c8f3eb87861a9414d0651e5c470e4866fe2cbad77600bdf5928a1f05388cfa7f7d64a1f0062c2d9c90001686b4e216239c3644abd336fad322a24dd2930a5aa3fa844a5d239e3b02584e79c7910530000000000000002000200b5ae2086e5ff00859248bb39fc1f1e96a7a052e3916e9497c21aacd72f8f784e21124d434b00000000000000000000000000000000000000000000000000000000004d4f434b00000000000000000000000000000000000000000000000000000000"
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