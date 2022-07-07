const jsonfile = require("jsonfile");

const WormholeImplementationFullABI = jsonfile.readFileSync("../build/contracts/Implementation.json").abi
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

const wormholeAddress = process.env.WORMHOLE;
const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const TokenAddress = process.env.TOKEN_ADDR;
// const TokenAddress = process.env.WETH;

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
        console.log("sender:", log.sender);

        // sequence
        console.log("sequence:", log.sequence);

        // nonce
        console.log("nonce:", log.nonce);

        // payload
        // console.log("payload", log.payload);
        // assert.equal(log.payload.length - 2, 266);

        // payload id
        console.log("payload id:", log.payload.substr(2, 2));

        // token address
        console.log("token address:", log.payload.substr(4, 64));

        // chain id
        console.log("chain id:", log.payload.substr(68, 4));

        // decimals
        console.log("recipient:", log.payload.substr(72, 2));

        // symbol
        console.log("symbol:", log.payload.substr(74, 64));

        // name
        console.log("name:", log.payload.substr(138, 64));

        console.log("");

        console.log("message_id:", `2/000000000000000000000000${log.sender.substring(2)}/${log.sequence}`);
        callback();
    }
    catch (e) {
        callback(e);
    }
}