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

const wormholeAddress = process.env.WORMHOLE;
const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const WETHAddress = process.env.WETH;
const recipient = "0x0000000000000000000000004c8d2dc4d82c23c51df9c7c5981353854957200f";
const recipientChain = "20001";

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const amount = "1000000000000000000";
        const fee = "0";

        const WETH = new web3.eth.Contract(MockWETH9.abi, WETHAddress);

        const totalWETHSupply = await WETH.methods.totalSupply().call();
        console.log("total WETH supply", totalWETHSupply);
        const balanceOfTokenBridge = await WETH.methods.balanceOf(ethTokenBridgeAddress).call();
        console.log("WETH balance of token bridge", balanceOfTokenBridge);

        const tokenBridge = new web3.eth.Contract(BridgeImplementationFullABI, ethTokenBridgeAddress);

        // deposit
        const nonce = Math.round(Math.random() * 10000);
        const result = await tokenBridge.methods.wrapAndTransferETH(
            recipientChain,
            recipient,
            fee,
            nonce
        ).send({
            value: amount,
            from: accounts[0],
            gasLimit: 2000000,
        });

        // console.log(result);

        // tx hash
        console.log("tx hash", result.transactionHash);
        // block hash
        console.log("block hash", result.blockHash);
        // block num
        const blockNum = result.blockNumber;
        console.log("block num", blockNum);

        const totalWETHSupplyAfter = await WETH.methods.totalSupply().call();
        console.log("total WETH supply (New)", totalWETHSupplyAfter);
        const balanceOfTokenBridgeAfter = await WETH.methods.balanceOf(ethTokenBridgeAddress).call();
        console.log("WETH balance of token bridge (New)", balanceOfTokenBridgeAfter);

        // check transfer log
        const wormhole = new web3.eth.Contract(WormholeImplementationFullABI, wormholeAddress);
        const log = (await wormhole.getPastEvents('LogMessagePublished', {
            fromBlock: blockNum
        }))[0].returnValues

        // console.log(log)

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
        // assert.equal(log.payload.substr(2, 2), "01");

        // amount
        console.log("amount", log.payload.substr(4, 64));
        // assert.equal(log.payload.substr(4, 64), web3.eth.abi.encodeParameter("uint256", new BigNumber(amount).div(1e10).toString()).substring(2));

        // token
        console.log("token", log.payload.substr(68, 64));
        // assert.equal(log.payload.substr(68, 64), web3.eth.abi.encodeParameter("address", WETH).substring(2));

        // chain id
        console.log("chain id", log.payload.substr(132, 4));
        // assert.equal(log.payload.substr(132, 4), web3.eth.abi.encodeParameter("uint16", testChainId).substring(2 + 64 - 4))

        // recipient
        console.log("recipient", log.payload.substr(136, 64));
        // assert.equal(log.payload.substr(136, 64), "000000000000000000000000b7a2211e8165943192ad04f5dd21bedc29ff003e");

        // to chain id
        console.log("recipient chain id", log.payload.substr(200, 4));
        // assert.equal(log.payload.substr(200, 4), web3.eth.abi.encodeParameter("uint16", 10).substring(2 + 64 - 4))

        // fee
        console.log("fee", log.payload.substr(204, 64));
        // assert.equal(log.payload.substr(204, 64), web3.eth.abi.encodeParameter("uint256", new BigNumber(fee).div(1e10).toString()).substring(2))

        // Register the ETH endpoint
        // await initialized.methods.registerChain("0x" + ethTokenBridgeVAA).send({
        //     value: 0,
        //     from: accounts[0],
        //     gasLimit: 2000000
        // });

        callback();
    }
    catch (e) {
        callback(e);
    }
}