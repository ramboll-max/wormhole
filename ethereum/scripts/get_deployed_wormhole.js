const Wormhole = artifacts.require("Wormhole");
const WETH9 = artifacts.require("MockWETH9");

const TokenBridge = artifacts.require("TokenBridge");

module.exports = async function(callback) {
    try {
        console.log("WORMHOLE:", Wormhole.address);

        callback();
    } catch (e) {
        callback(e);
    }
};