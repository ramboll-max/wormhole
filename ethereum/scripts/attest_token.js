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

const wormholeAddress = "0xEE4c5370a391b177220624DAA790778d4A9B8698"
const ethTokenBridgeAddress = "0xFF41b429B3f0a46524A3885E9798CF01Af03DEaA"
const TokenAddress = "0x531f740e48De14F58789d61E05c4a6A1D56aF37c"

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();

        const tokenBridge = new web3.eth.Contract(BridgeImplementationFullABI, ethTokenBridgeAddress);

        // attest token
        const result = await tokenBridge.methods.attestToken(
            TokenAddress, Math.round(Math.random() * 10000)
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

        // check transfer log
        const wormhole = new web3.eth.Contract(WormholeImplementationFullABI, wormholeAddress);
        const log = (await wormhole.getPastEvents('LogMessagePublished', {
            fromBlock: blockNum
        }))[0].returnValues

        // console.log(log);

        // sender
        console.log("sender", log.sender);

        // sequence
        console.log("sequence", log.sequence);

        // nonce
        console.log("nonce", log.nonce);

        // payload
        // console.log("payload", log.payload);
        // assert.equal(log.payload.length - 2, 266);

        // payload id
        console.log("payload id", log.payload.substr(2, 2));

        // token address
        console.log("token address", log.payload.substr(4, 64));

        // chain id
        console.log("chain id", log.payload.substr(68, 4));

        // decimals
        console.log("recipient", log.payload.substr(72, 2));

        // symbol
        console.log("symbol", log.payload.substr(74, 64));

        // name
        console.log("name", log.payload.substr(138, 64));

        callback();
    }
    catch (e) {
        callback(e);
    }
}