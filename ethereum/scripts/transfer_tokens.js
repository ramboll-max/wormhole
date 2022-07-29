const jsonfile = require("jsonfile");
const {toHex, fromBech32} = require("@honsop/encoding");
const {zeroPad} = require("ethers/lib/utils.js");

const WormholeImplementationFullABI = jsonfile.readFileSync("../build/contracts/Implementation.json").abi;
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi;
const TokenImplementationFullABI = jsonfile.readFileSync("../build/contracts/TokenImplementation.json").abi;

const wormholeAddress = process.env.WORMHOLE;
const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const tokenAddr = process.env.TOKEN_ADDR;
const recipientMetaOS = process.env.METAOS_RECIPIENT;
const recipientChain = process.env.RECIPIENT_CHAIN;
const amount = process.env.AMOUNT;

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const fee = "0";
        const recipient = "0x" + toHex(zeroPad(fromBech32(recipientMetaOS).data, 32));
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

        console.log("message_id:", `2/000000000000000000000000${log.sender.substring(2)}/${log.sequence}`);
        callback();
    }
    catch (e) {
        callback(e);
    }
}