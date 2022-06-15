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

const wormholeAddress = "0x098809840f2473734C6E08316F64a42c84f72ecC"
const ethTokenBridgeAddress = "0x0fa39beE01f74B2707B0B74c64203e8D66C464A2"
const TokenAddress = "0xBab52a39946EA20175DEbF9E174c0963bBA85c14"

module.exports = async function (callback) {
    try {
        const signedAttestTokenVAA = "010000000001002b61b4ec149cf200d2581583feca8af266adebbeb34e87f60b53f67bc15f3cf7006928165f2ace07dba1da6a3c24d31b272d3a530076900540cf9fab4b960a9401628de68b0000271200010000000000000000000000000fa39bee01f74b2707b0b74c64203e8d66c464a200000000000000080f02000000000000000000000000bab52a39946ea20175debf9e174c0963bba85c14000112544b4e0000000000000000000000000000000000000000000000000000000000574f524d484f4c45205465737420546f6b656e00000000000000000000000000"
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

        const wrappedAddress = await tokenBridge.methods.wrappedAsset("0x0001", "0x000000000000000000000000" + TokenAddress.substr(2)).call();
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