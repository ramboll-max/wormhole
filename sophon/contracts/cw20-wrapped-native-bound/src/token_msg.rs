use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[non_exhaustive]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum TokenMsg {
    Issue {
        name: String,
        symbol: Option<String>,
        decimals: Option<u8>,
        initial_supply: Option<String>,
        max_supply: Option<String>,
        description: Option<String>,
    },
    Mint {
        amount: String,
    },
    Burn {
        amount: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct IssueResponse {
    pub denom: String,
}