import { Wallet } from '@ethersproject/wallet';
import { Base58 } from '@ethersproject/basex';
import { createMessageSend } from '@tharsis/transactions';
import {
    broadcast,
    getSender,
    LOCALNET_CHAIN,
    LOCALNET_FEE,
    signTransaction,
    singTransactionUsingEIP712,
} from '@hanchon/evmos-ts-wallet';
import { fromBech32, toBech32, toHex } from "@cosmjs/encoding";
import {ethToEvmos, ETH, EVMOS, evmosToEth} from "@tharsis/address-converter";
import {Bip39, EnglishMnemonic, stringToPath, Secp256k1} from "@cosmjs/crypto";
import {fromHex, Secp256k1HdWallet} from "cosmwasm";
import {defaultPath, HDNode} from "@ethersproject/hdnode"

const mnemonic = "fox riot often good surge spider negative abuse lemon robot order key avocado north lock little math click nut jacket later route fruit laugh";
const hdNode = HDNode.fromMnemonic(mnemonic, "").derivePath(defaultPath);
console.log(hdNode.address);
console.log(ethToEvmos(hdNode.address));
console.log(Base58.encode(fromHex(hdNode.publicKey.substring(2))));
// console.log(evmosToEth("evmos1j4hmsz5u48wz05w8mquq3w8k75nr3wugt67uux"));

// const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
//     prefix: "sop",
//     hdPaths: [stringToPath("m/44'/60'/0'/0/0")],
//     bip39Password: "",
// });
// const accounts = await wallet.getAccounts();
// console.log(accounts[0].address);
// const em = new EnglishMnemonic(mnemonic);
// const seed = await Bip39.mnemonicToSeed(em, "");
// const hdNode = HDNode.fromSeed(seed).derivePath("m/44'/60'/0'/0/0");
// console.log(hdNode.address);






const wallet = Wallet.fromMnemonic(mnemonic);
const ethAddr = await wallet.getAddress().then((s)=>{
    return s
});
console.log("eth address:", ethAddr);
//
// const sopAddr = ethToEvmos(ethAddr);
// console.log("sop address:", sopAddr);

// const target = "sop17gxqqequrm2rmehknpataddssugl4ef6auunuc";
// const {prefix, data} = fromBech32(target);
// const hex = toHex(pk);
//
// const e = EVMOS.encoder(Buffer.from(hex));
// console.log(e);


