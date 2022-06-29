const jsonfile = require("jsonfile");
const BigNumber = require("bignumber.js");

const WormholeImplementationFullABI = jsonfile.readFileSync("../build/contracts/Implementation.json").abi;
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi;
const TokenImplementationFullABI = jsonfile.readFileSync("../build/contracts/TokenImplementation.json").abi;
// const IERC20ABI = jsonfile.readFileSync("../build/contracts/IERC20.json").abi;

const wormholeAddress = process.env.WORMHOLE;
const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const tokenAddr = process.env.TOKEN_ADDR;
const recipientChain = "20001";
const recipient = "0x0000000000000000000000004c8d2dc4d82c23c51df9c7c5981353854957200f";

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const amount = "10000000000";
        const fee = "0";

        const ERC20 = new web3.eth.Contract(TokenImplementationFullABI, tokenAddr);

        const approveRes = await ERC20.methods.approve(ethTokenBridgeAddress, amount).send(
            {
                value: 0,
                from: accounts[0],
                gasLimit: 2000000,
            }
        );
        // console.log("approveRes", approveRes);
        const allowance = await ERC20.methods.allowance(accounts[0], ethTokenBridgeAddress).call();
        console.log("allowance", allowance);

        const totalSupply = await ERC20.methods.totalSupply().call();
        console.log("total supply", totalSupply);
        const balanceOfTokenBridge = await ERC20.methods.balanceOf(ethTokenBridgeAddress).call();
        console.log("balance of token bridge", balanceOfTokenBridge);



        const tokenBridge = new web3.eth.Contract(BridgeImplementationFullABI, ethTokenBridgeAddress);
        const nonce = Math.round(Math.random() * 10000);
        // transfer tokens
        const result = await tokenBridge.methods.transferTokens(
            tokenAddr,
            amount,
            recipientChain,
            recipient,
            fee,
            nonce
        ).send({
            value: 0,
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

        const totalWETHSupplyAfter = await ERC20.methods.totalSupply().call();
        console.log("total supply (New)", totalWETHSupplyAfter);
        const balanceOfTokenBridgeAfter = await ERC20.methods.balanceOf(ethTokenBridgeAddress).call();
        console.log("balance of token bridge (New)", balanceOfTokenBridgeAfter);

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


        callback();
    }
    catch (e) {
        callback(e);
    }
}