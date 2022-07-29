const Wormhole = artifacts.require("Wormhole");
const WETH9 = artifacts.require("MockWETH9");

const TokenBridge = artifacts.require("TokenBridge");

module.exports = async function(callback) {
    try {
        console.log("WETH:", WETH9.address);

        callback();
    } catch (e) {
        callback(e);
    }
};