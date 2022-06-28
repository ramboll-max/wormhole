use cosmwasm_std::CosmosMsg;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use crate::bank_msg::{BankMsg, BankQuery};
use crate::token_msg::TokenMsg;

#[non_exhaustive]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum CustomMsg {
    Token(TokenMsg),
    Bank(BankMsg),
}

impl cosmwasm_std::CustomMsg for CustomMsg {}

impl From<CustomMsg> for CosmosMsg<CustomMsg> {
    fn from(r: CustomMsg) -> Self {
        CosmosMsg::Custom(r)
    }
}

#[non_exhaustive]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum CustomQuery {
    Bank(BankQuery),
}

impl cosmwasm_std::CustomQuery for CustomQuery {}
