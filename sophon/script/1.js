import 'dotenv/config'

const lcdURL = process.env.LCD_URL;
const chainID = process.env.CHAIN_ID;
const mnemonic = process.env.MNEMONIC;
const govChain = Number.parseInt(process.env.INIT_GOV_CHAIN_ID);
const govAddress = process.env.INIT_GOV_ADDRESS;
const init_guardians = JSON.parse(process.env.INIT_SIGNERS)

const govAddressBinary = Buffer.from(govAddress, "hex").toString("base64");
console.log("gov address binary:", govAddressBinary);

const init_guardian_set = init_guardians.map(hex => {
    return {
        bytes: Buffer.from(hex, "hex").toString("base64")
    }
})
console.log("init guardian set:", init_guardian_set);

