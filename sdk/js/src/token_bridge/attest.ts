import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import {
  Algodv2,
  bigIntToBytes,
  decodeAddress,
  getApplicationAddress,
  makeApplicationCallTxnFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  OnApplicationComplete,
  SuggestedParams,
} from "algosdk";
import { Account as nearAccount } from "near-api-js";
const BN = require("bn.js");
import { ethers, PayableOverrides } from "ethers";
import { isNativeDenom } from "..";
import { getMessageFee, optin, TransactionSignerPair } from "../algorand";
import { Bridge__factory } from "../ethers-contracts";
import { getBridgeFeeIx, ixFromRust } from "../solana";
import { importTokenWasm } from "../solana/wasm";
import { textToHexString, textToUint8Array, uint8ArrayToHex } from "../utils";
import { safeBigIntToNumber } from "../utils/bigint";
import { createNonce } from "../utils/createNonce";
import { parseSequenceFromLogNear } from "../bridge/parseSequenceFromLog";

export async function attestFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  overrides: PayableOverrides & { from?: string | Promise<string> } = {}
): Promise<ethers.ContractReceipt> {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.attestToken(tokenAddress, createNonce(), overrides);
  const receipt = await v.wait();
  return receipt;
}

export async function attestFromTerra(
  tokenBridgeAddress: string,
  walletAddress: string,
  asset: string
): Promise<MsgExecuteContract> {
  const nonce = Math.round(Math.random() * 100000);
  const isNativeAsset = isNativeDenom(asset);
  return new MsgExecuteContract(walletAddress, tokenBridgeAddress, {
    create_asset_meta: {
      asset_info: isNativeAsset
        ? {
            native_token: { denom: asset },
          }
        : {
            token: {
              contract_addr: asset,
            },
          },
      nonce: nonce,
    },
  });
}

export async function attestFromSolana(
  connection: Connection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  mintAddress: string
): Promise<Transaction> {
  const nonce = createNonce().readUInt32LE(0);
  const transferIx = await getBridgeFeeIx(
    connection,
    bridgeAddress,
    payerAddress
  );
  const { attest_ix } = await importTokenWasm();
  const messageKey = Keypair.generate();
  const ix = ixFromRust(
    attest_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      messageKey.publicKey.toString(),
      mintAddress,
      nonce
    )
  );
  const transaction = new Transaction().add(transferIx, ix);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  transaction.partialSign(messageKey);
  return transaction;
}

/**
 * Attest an already created asset
 * If you create a new asset on algorand and want to transfer it elsewhere,
 * you create an attestation for it on algorand... pass that vaa to the target chain..
 * submit it.. then you can transfer from algorand to that target chain
 * @param client An Algodv2 client
 * @param tokenBridgeId The ID of the token bridge
 * @param senderAcct The account paying fees
 * @param assetId The asset index
 * @returns Transaction ID
 */
export async function attestFromAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  senderAddr: string,
  assetId: bigint
): Promise<TransactionSignerPair[]> {
  const tbAddr: string = getApplicationAddress(tokenBridgeId);
  const decTbAddr: Uint8Array = decodeAddress(tbAddr).publicKey;
  const aa: string = uint8ArrayToHex(decTbAddr);
  const txs: TransactionSignerPair[] = [];
  // "attestFromAlgorand::emitterAddr"
  const { addr: emitterAddr, txs: emitterOptInTxs } = await optin(
    client,
    senderAddr,
    bridgeId,
    BigInt(0),
    aa
  );
  txs.push(...emitterOptInTxs);
  let wormhole: boolean = false;
  let creatorAcctInfo: any = false;
  let creatorAddr = "";
  const bPgmName: Uint8Array = textToUint8Array("attestToken");

  if (assetId !== BigInt(0)) {
    const assetInfo = await client
      .getAssetByID(safeBigIntToNumber(assetId))
      .do();
    const creatorAddr = assetInfo.params.creator;
    creatorAcctInfo = await client.accountInformation(creatorAddr).do();
    wormhole = creatorAcctInfo["auth-addr"] === tbAddr;
  } else {
    wormhole = false;
  }

  if (!wormhole) {
    // "notWormhole"
    const result = await optin(
      client,
      senderAddr,
      tokenBridgeId,
      assetId,
      textToHexString("native")
    );
    creatorAddr = result.addr;
    txs.push(...result.txs);
  }
  const suggParams: SuggestedParams = await client.getTransactionParams().do();

  const firstTxn = makeApplicationCallTxnFromObject({
    from: senderAddr,
    appIndex: safeBigIntToNumber(tokenBridgeId),
    onComplete: OnApplicationComplete.NoOpOC,
    appArgs: [textToUint8Array("nop")],
    suggestedParams: suggParams,
  });
  txs.push({ tx: firstTxn, signer: null });

  const mfee = await getMessageFee(client, bridgeId);
  if (mfee > BigInt(0)) {
    const feeTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      suggestedParams: suggParams,
      to: getApplicationAddress(tokenBridgeId),
      amount: mfee,
    });
    txs.push({ tx: feeTxn, signer: null });
  }

  let accts: string[] = [
    emitterAddr,
    creatorAddr,
    getApplicationAddress(bridgeId),
  ];

  if (creatorAcctInfo) {
    accts.push(creatorAcctInfo["address"]);
  }

  let appTxn = makeApplicationCallTxnFromObject({
    appArgs: [bPgmName, bigIntToBytes(assetId, 8)],
    accounts: accts,
    appIndex: safeBigIntToNumber(tokenBridgeId),
    foreignApps: [safeBigIntToNumber(bridgeId)],
    foreignAssets: [safeBigIntToNumber(assetId)],
    from: senderAddr,
    onComplete: OnApplicationComplete.NoOpOC,
    suggestedParams: suggParams,
  });
  if (mfee > BigInt(0)) {
    appTxn.fee *= 3;
  } else {
    appTxn.fee *= 2;
  }
  txs.push({ tx: appTxn, signer: null });

  return txs;
}

/**
 * Attest an already created asset
 * If you create a new asset on near and want to transfer it elsewhere,
 * you create an attestation for it on near... pass that vaa to the target chain..
 * submit it.. then you can transfer from near to that target chain
 * @param client An Near account client
 * @param tokenBridge The account for the token bridge
 * @param asset The account for the asset
 * @returns sequenceNumber
 */
export async function attestTokenFromNear(
  client: nearAccount,
  tokenBridge: string,
  asset: string
): Promise<string> {
  let result = await client.functionCall({
    contractId: tokenBridge,
    methodName: "attest_token",
    args: { token: asset },
    attachedDeposit: new BN("7900000000000000000"),
    gas: new BN("100000000000000"),
  });

  return parseSequenceFromLogNear(result);
}

/**
 * Attest NEAR
 * @param client An Near account client
 * @param tokenBridge The account for the token bridge
 * @returns sequenceNumber
 */
export async function attestNearFromNear(
  client: nearAccount,
  tokenBridge: string
): Promise<string> {
  let result = await client.functionCall({
    contractId: tokenBridge,
    methodName: "attest_near",
    args: {},
    attachedDeposit: new BN("7900000000000000000"),
    gas: new BN("100000000000000"),
  });

  return parseSequenceFromLogNear(result);
}
