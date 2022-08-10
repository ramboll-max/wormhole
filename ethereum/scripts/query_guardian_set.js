// run this script with truffle exec

const jsonfile = require("jsonfile");
// const TokenBridge = artifacts.require("TokenBridge");
// const TokenImplementation = artifacts.require("TokenImplementation");
const WormholeImplementationFullABI = jsonfile.readFileSync("../build/contracts/Implementation.json").abi
const wormholeAddr = process.env.WORMHOLE

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const initialized = new web3.eth.Contract(WormholeImplementationFullABI, wormholeAddr);

        // Register the ETH endpoint
        const i = await initialized.methods.getCurrentGuardianSetIndex().call();
        const result = await initialized.methods.getGuardianSet(i).call();
        console.log("Current Guardian Set:", result)
        callback();
    }
    catch (e) {
        callback(e);
    }
}

