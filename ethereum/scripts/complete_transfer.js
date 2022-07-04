const jsonfile = require("jsonfile");

const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

const ethTokenBridgeAddress = process.env.ETH_TOKEN_BRIDGE_ADDR;
const signedVAA = "010000000001000d737f0832207abc35f92def28e7640cd5e8cceff7ee95463dd9dc4de2b20da2194afc39302e9ce8aab72881828c038e31ebe12bf31e5ca1590ab76855bed04e0162c2daa30001380a4e216239c3644abd336fad322a24dd2930a5aa3fa844a5d239e3b02584e79c791053000000000000000300010000000000000000000000000000000000000000000000000000000005f5e10000b5ae2086e5ff00859248bb39fc1f1e96a7a052e3916e9497c21aacd72f8f784e21000000000000000000000000011e8f7d1b292d05779d43c62eaf3e200872d1df00020000000000000000000000000000000000000000000000000000000000000000"

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