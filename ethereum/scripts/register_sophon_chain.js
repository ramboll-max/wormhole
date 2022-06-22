// run this script with truffle exec

const jsonfile = require("jsonfile");
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi
const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR
const sophonTokenBridgeVAA = process.env.REGISTER_SOPHON_TOKEN_BRIDGE_VAA

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const tokenBridge = new web3.eth.Contract(BridgeImplementationFullABI, ethTokenBridgeAddress);

        // Register the terra token bridge endpoint
        await tokenBridge.methods.registerChain("0x" + sophonTokenBridgeVAA).send({
            value: 0,
            from: accounts[0],
            gasLimit: 200000
        });

        callback();
    }
    catch (e) {
        callback(e);
    }
}

