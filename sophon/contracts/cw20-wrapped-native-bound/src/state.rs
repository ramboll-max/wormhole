use cosmwasm_std::{Binary, CanonicalAddr, Storage, Uint128};
use cosmwasm_storage::{
    Bucket,
    bucket, bucket_read, ReadonlyBucket, ReadonlySingleton, singleton, Singleton, singleton_read};
use schemars::JsonSchema;
use serde::{
    Deserialize,
    Serialize,
};

pub const KEY_WRAPPED_ASSET: &[u8] = b"wrappedAsset";
pub const KEY_BIND_NATIVE_ASSET: &[u8] = b"bindNativeAsset";
pub const KEY_DEPOSITED_BALANCES: &[u8] = b"depositedBalances";

// Created at initialization and reference original asset and bridge address
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct WrappedAssetInfo {
    pub asset_chain: u16,
    // Asset chain id
    pub asset_address: Binary,
    // Asset smart contract address on the original chain
    pub bridge: CanonicalAddr, // Bridge address, authorized to mint and burn wrapped tokens
}

pub fn wrapped_asset_info(storage: &mut dyn Storage) -> Singleton<WrappedAssetInfo> {
    singleton(storage, KEY_WRAPPED_ASSET)
}

pub fn wrapped_asset_info_read(
    storage: &dyn Storage,
) -> ReadonlySingleton<WrappedAssetInfo> {
    singleton_read(storage, KEY_WRAPPED_ASSET)
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct BindNativeAsset {
    pub denom: String, // Native denom be bound to this CW20 token
}

pub fn bind_native_asset(storage: &mut dyn Storage) -> Singleton<BindNativeAsset> {
    singleton(storage, KEY_BIND_NATIVE_ASSET)
}

pub fn bind_native_asset_read(storage: &dyn Storage) -> ReadonlySingleton<BindNativeAsset> {
    singleton_read(storage, KEY_BIND_NATIVE_ASSET)
}

pub fn deposit_balance(storage: &mut dyn Storage) -> Bucket<Uint128> {
    bucket(storage, KEY_DEPOSITED_BALANCES)
}

pub fn deposit_balance_read(storage: &dyn Storage) -> ReadonlyBucket<Uint128> {
    bucket_read(storage, KEY_DEPOSITED_BALANCES)
}
