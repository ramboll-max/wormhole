// run this script with truffle exec

const jsonfile = require("jsonfile");
// const TokenBridge = artifacts.require("TokenBridge");
// const TokenImplementation = artifacts.require("TokenImplementation");
const WormholeImplementationFullABI = jsonfile.readFileSync("../build/contracts/Implementation.json").abi
const submitNewGuardianSetVAA = process.env.SUBMIT_NEW_GUARDIAN_SET_VAA
const wormholeAddr = process.env.WORMHOLE

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const initialized = new web3.eth.Contract(WormholeImplementationFullABI, wormholeAddr);

        // Register the ETH endpoint
        const result = await initialized.methods.submitNewGuardianSet("0x" + submitNewGuardianSetVAA).send({
            value: 0,
            from: accounts[0],
            gasLimit: 200000
        });
        console.log(result);
        console.log("Finished");
        callback();
    }
    catch (e) {
        callback(e);
    }
}

