const jsonfile = require("jsonfile");

const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const signedVAA = "01000000000100f49bdb3e124acfe2481deb212ee13dc1f0443255737982a7331c859b03b3916b5fa033009612225c1ae91d4b379c9aaa0386d8781275e06d809d9a434c0288700062c3a29d00000de54e216239c3644abd336fad322a24dd2930a5aa3fa844a5d239e3b02584e79c791053000000000000000500010000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000009f2615bd4c5252a6baf3982414cfbcebffedae010002000000000000000000000000011e8f7d1b292d05779d43c62eaf3e200872d1df00020000000000000000000000000000000000000000000000000000000000000000"

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        // const wrappedAsset = new web3.eth.Contract(TokenImplementation.abi, wrappedAssetAddress);

        // const totalSupply = await wrappedAsset.methods.totalSupply().call();
        // console.log("total supply of wrapped asset", totalSupply);

        const tokenBridge = new web3.eth.Contract(BridgeImplementationFullABI, ethTokenBridgeAddress);

        // complete transfer
        const result = await tokenBridge.methods.completeTransfer(
            "0x" + signedVAA
        ).send({
            value: 0,
            from: accounts[0],
            gasLimit: 2000000,
        });

        console.log(result);

        // const totalSupplyAfter = await wrappedAsset.methods.totalSupply().call();
        // console.log("total supply of wrapped asset (NEW)", totalSupplyAfter);
        // const accountBalanceAfter =  await wrappedAsset.methods.balanceOf(accounts[0]).call();
        // console.log("account balance of wrapped asset (NEW)", accountBalanceAfter);

        callback();
    }
    catch (e) {
        callback(e);
    }
}