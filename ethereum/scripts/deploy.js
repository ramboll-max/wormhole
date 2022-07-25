require('dotenv').config({ path: "../.env" });

const Setup = artifacts.require("Setup");
const Implementation = artifacts.require("Implementation");
const Wormhole = artifacts.require("Wormhole");
const WETH9 = artifacts.require("MockWETH9");

const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementation = artifacts.require("BridgeImplementation");
const BridgeSetup = artifacts.require("BridgeSetup");
const TokenImplementation = artifacts.require("TokenImplementation");

// CONFIG
const initialSigners = JSON.parse(process.env.INIT_SIGNERS);
const chainId = process.env.INIT_CHAIN_ID;
const governanceChainId = process.env.INIT_GOV_CHAIN_ID;
const governanceContract = process.env.INIT_GOV_CONTRACT; // bytes32
const finality = process.env.BRIDGE_INIT_FINALITY;

module.exports = async function(callback) {
    try {
        // deploy Wormhole core
        const wormholeSetupAddr = (await Setup.new()).address;
        const wormholeImplementation = (await Implementation.new()).address;
        const wormholeSetup = new web3.eth.Contract(Setup.abi, wormholeSetupAddr);
        const initData = wormholeSetup.methods.setup(
            wormholeImplementation,
            initialSigners,
            chainId,
            governanceChainId,
            governanceContract
        ).encodeABI();

        const wormholeAddr = (await Wormhole.new(wormholeSetupAddr, initData)).address;

        console.log("WORMHOLE:", wormholeAddr);

        // deploy WETH
        var wethAddr = process.env.BRIDGE_INIT_WETH
        if (wethAddr == null || wethAddr === "") {
            wethAddr = (await WETH9.new()).address;
        }
        console.log("WETH:", wethAddr);

        // deploy TokenBridge
        const bridgeSetupAddr = (await BridgeSetup.new()).address;
        const bridgeImplementation = (await BridgeImplementation.new()).address;
        const bridgeSetup = new web3.eth.Contract(BridgeSetup.abi, bridgeSetupAddr);
        const bridgeInitData = bridgeSetup.methods.setup(
            bridgeImplementation,
            chainId,
            wormholeAddr,
            governanceChainId,
            governanceContract,
            bridgeImplementation,
            wethAddr,
            finality
        ).encodeABI();

        const bridgeAddr = (await TokenBridge.new(bridgeSetupAddr, bridgeInitData)).address;
        console.log("TOKEN BRIDGE:", bridgeAddr);

        callback();
    } catch (e) {
        callback(e);
    }
};