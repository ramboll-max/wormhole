const jsonfile = require("jsonfile");

const TokenImplementation = artifacts.require("TokenImplementation");

const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const asset_address = process.env.ASSET_ADDR;
const signedAttestTokenVAA = process.env.ATTEST_TOKEN_VAA;

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const tokenBridge = new web3.eth.Contract(BridgeImplementationFullABI, ethTokenBridgeAddress);

        // attest token
        const result = await tokenBridge.methods.createWrapped(
            "0x" + signedAttestTokenVAA
        ).send({
            value: 0,
            from: accounts[0],
            gasLimit: 20000000,
        });

        console.log(result);

        // tx hash
        console.log("tx hash:", result.transactionHash);
        // block hash
        console.log("block hash:", result.blockHash);
        // block num
        const blockNum = result.blockNumber;
        console.log("block num:", blockNum);

        const wrappedAddress = await tokenBridge.methods.wrappedAsset("0x4e21", "0x" + asset_address).call();
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
        console.log("native asset address:", nativeContract);

        callback();
    }
    catch (e) {
        callback(e);
    }
}