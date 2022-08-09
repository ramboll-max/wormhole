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
        const result = await initialized.methods.getCurrentGuardianSetIndex().call();
        console.log("Current Guardian Set Index:", result)
        callback();
    }
    catch (e) {
        callback(e);
    }
}

