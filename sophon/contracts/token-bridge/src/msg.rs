use cosmwasm_std::{Binary, Uint128};
use schemars::JsonSchema;
use serde::{
    Deserialize,
    Serialize,
};
use crate::asset::{
    Asset,
    AssetInfo,
};

use crate::token_address::{
    TokenId,
};

type HumanAddr = String;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    // governance contract details
    pub gov_chain: u16,
    pub gov_address: Binary,

    pub wormhole_contract: HumanAddr,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    DepositAndTransferBankTokens {
        denom: String,
        amount: Uint128,
        recipient_chain: u16,
        recipient: Binary,
        fee: Uint128,
        nonce: u32,
    },

    DepositAndTransferBankTokensWithPayload {
        denom: String,
        amount: Uint128,
        recipient_chain: u16,
        recipient: Binary,
        fee: Uint128,
        payload: Binary,
        nonce: u32,
    },

    InitiateTransfer {
        asset: Asset,
        recipient_chain: u16,
        recipient: Binary,
        fee: Uint128,
        nonce: u32,
    },

    InitiateTransferWithPayload {
        asset: Asset,
        recipient_chain: u16,
        recipient: Binary,
        fee: Uint128,
        payload: Binary,
        nonce: u32,
    },

    SubmitVaa {
        data: Binary,
    },

    CreateAssetMeta {
        asset_info: AssetInfo,
        nonce: u32,
    },

    CompleteTransferWithPayload {
        data: Binary,
        relayer: HumanAddr,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    WrappedRegistry { chain: u16, address: Binary },
    TransferInfo { vaa: Binary },
    ExternalId { external_id: Binary },
    DenomWrappedAssetInfo { denom: String },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct WrappedRegistryResponse {
    pub denom: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct TransferInfoResponse {
    pub amount: Uint128,
    pub token_address: [u8; 32],
    pub token_chain: u16,
    pub recipient: [u8; 32],
    pub recipient_chain: u16,
    pub fee: Uint128,
    pub payload: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct ExternalIdResponse {
    pub token_id: TokenId,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct DenomWrappedAssetInfoResponse {
    pub found: u8,
    pub is_wrapped: u8,
    pub asset_chain: u16,       // Asset chain id
    pub asset_address: Binary,  // Asset smart contract address in the original chain
}
