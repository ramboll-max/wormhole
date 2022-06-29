use std::string::String;

use cosmwasm_std::{
    Binary,
    Coin,
    CosmosMsg,
    Deps,
    DepsMut,
    Env,
    from_binary,
    MessageInfo,
    Reply, Response, StdError, StdResult, SubMsg, to_binary, Uint128, WasmMsg};
#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cw20::TokenInfoResponse;
use cw20_base::ContractError;
use cw2::set_contract_version;

use crate::{
    bank_msg::{BalanceResponse, BankMsg, BankQuery, DenomMetadataResponse, SupplyOfResponse},
    custom_msg::{CustomMsg, CustomQuery},
    msg::{
        ExecuteMsg,
        InstantiateMsg,
        MigrateMsg,
        QueryMsg,
        WrappedAssetInfoResponse,
    },
    state::{
        bind_native_asset,
        bind_native_asset_read,
        BindNativeAsset,
        deposit_balance,
        deposit_balance_read,
        wrapped_asset_info,
        wrapped_asset_info_read,
        WrappedAssetInfo,
    },
    token_msg::{IssueResponse, TokenMsg},
};

type HumanAddr = String;

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:cw20-base";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

const ISSUE_REPLY_ID: u64 = 1;
// const MINT_REPLY_ID: u64 = 2;

const STD_ERR_UNSUPPORTED_EXECUTE_MESSAGE: &str = "unsupported execute message";
const STD_ERR_UNSUPPORTED_QUERY_MESSAGE: &str = "unsupported query message";

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response<CustomMsg>> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    // store token info using cw20-base format
    // let data = TokenInfo {
    //     name: msg.name.clone(),
    //     symbol: msg.symbol.clone(),
    //     decimals: msg.decimals,
    //     total_supply: Uint128::new(0),
    //     // set creator as minter
    //     mint: Some(MinterData {
    //         minter: deps.api.addr_validate(info.sender.as_str())?,
    //         cap: None,
    //     }),
    // };
    // TOKEN_INFO.save(deps.storage, &data)?;

    // save wrapped asset info
    let data = WrappedAssetInfo {
        asset_chain: msg.asset_chain,
        asset_address: msg.asset_address,
        bridge: deps.api.addr_canonicalize(info.sender.as_str())?,
    };
    wrapped_asset_info(deps.storage).save(&data)?;

    // if let Some(mint_info) = msg.mint {
    //     execute_mint(deps, env, info, mint_info.recipient, mint_info.amount)
    //         .map_err(|e| StdError::generic_err(format!("{}", e)))?;
    // }

    let mut msgs: Vec<SubMsg<CustomMsg>> = Vec::new();

    // add token issue msg
    msgs.push(SubMsg::reply_on_success(
        CosmosMsg::Custom(CustomMsg::Token(TokenMsg::Issue {
            name: msg.name.clone() + " (Wormhole)",
            symbol: Some(msg.symbol.to_uppercase()),
            decimals: Some(msg.decimals),
            initial_supply: Some("0".to_string()),
            max_supply: Some("0".to_string()),
            description: Some(format!("Wormhole Wrapped {}", msg.name).to_string()),
        })), ISSUE_REPLY_ID));

    if let Some(mint_info) = msg.mint {
        msgs.push(SubMsg::new(CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: env.contract.address.to_string(),
            msg: to_binary(&ExecuteMsg::Mint {
                recipient: mint_info.recipient,
                amount: mint_info.amount,
            })?,
            funds: vec![],
        })));
        // execute_mint(deps, env, info, mint_info.recipient, mint_info.amount)
        //     .map_err(|e| StdError::generic_err(format!("{}", e)))?;
    }

    if let Some(hook) = msg.init_hook {
        msgs.push(SubMsg::new(CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: hook.contract_addr,
            msg: hook.msg,
            funds: vec![],
        })));
        // Ok(
        //     Response::new().add_message(CosmosMsg::Wasm(WasmMsg::Execute {
        //         contract_addr: hook.contract_addr,
        //         msg: hook.msg,
        //         funds: vec![],
        //     })),
        // )
    } else {
        // Ok(Response::default())
    }
    Ok(Response::new().add_submessages(msgs))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response<CustomMsg>, ContractError> {
    match msg {
        // these all come from cw20-base to implement the cw20 standard
        ExecuteMsg::Transfer { recipient: _, amount: _ } => {
            // execute_transfer(deps, env, info, recipient, amount)
            Err(ContractError::Std(StdError::generic_err(STD_ERR_UNSUPPORTED_EXECUTE_MESSAGE)))
        }
        ExecuteMsg::Burn { account, amount } =>
        // execute_burn_from(deps, env, info, account, amount),
            execute_burn_wrapped(deps, env, info, account, amount),
        ExecuteMsg::Send {
            contract: _,
            amount: _,
            msg: _,
        } =>
        // execute_send(deps, env, info, contract, amount, msg),
            Err(ContractError::Std(StdError::generic_err(STD_ERR_UNSUPPORTED_EXECUTE_MESSAGE))),
        ExecuteMsg::Mint { recipient, amount } => {
            execute_mint_wrapped(deps, env, info, recipient, amount)
        }
        ExecuteMsg::IncreaseAllowance {
            spender: _,
            amount: _,
            expires: _,
        } =>
        // execute_increase_allowance(deps, env, info, spender, amount, expires),
            Err(ContractError::Std(StdError::generic_err(STD_ERR_UNSUPPORTED_EXECUTE_MESSAGE))),
        ExecuteMsg::DecreaseAllowance {
            spender: _,
            amount: _,
            expires: _,
        } =>
        // execute_decrease_allowance(deps, env, info, spender, amount, expires),
            Err(ContractError::Std(StdError::generic_err(STD_ERR_UNSUPPORTED_EXECUTE_MESSAGE))),
        ExecuteMsg::TransferFrom {
            owner: _,
            recipient: _,
            amount: _,
        } =>
        // execute_transfer_from(deps, env, info, owner, recipient, amount),
            Err(ContractError::Std(StdError::generic_err(STD_ERR_UNSUPPORTED_EXECUTE_MESSAGE))),
        ExecuteMsg::BurnFrom { owner: _, amount: _ } =>
        // execute_burn_from(deps, env, info, owner, amount),
            Err(ContractError::Std(StdError::generic_err(STD_ERR_UNSUPPORTED_EXECUTE_MESSAGE))),
        ExecuteMsg::SendFrom {
            owner: _,
            contract: _,
            amount: _,
            msg: _,
        } =>
        // execute_send_from(deps, env, info, owner, contract, amount, msg),
            Err(ContractError::Std(StdError::generic_err(STD_ERR_UNSUPPORTED_EXECUTE_MESSAGE))),
        ExecuteMsg::UpdateMetadata { name: _, symbol: _ } => {
            // execute_update_metadata(deps, env, info, name, symbol)
            Err(ContractError::Std(StdError::generic_err(STD_ERR_UNSUPPORTED_EXECUTE_MESSAGE)))
        },

        ExecuteMsg::Deposit {} => execute_deposit(deps, env, info)
    }
}

fn execute_burn_wrapped(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    recipient: HumanAddr,
    amount: Uint128,
) -> Result<Response<CustomMsg>, ContractError> {
    // Only bridge and ourselves can burn
    let wrapped_info = wrapped_asset_info_read(deps.storage).load()?;
    if env.contract.address.to_string() != info.sender.to_string()
        && wrapped_info.bridge != deps.api.addr_canonicalize(info.sender.as_str())? {
        return Err(ContractError::Unauthorized {});
    }

    // Query balance user deposited
    let denom = bind_native_asset_read(deps.storage).load()?.denom;
    let deposit_key = format!("{}:{}", recipient.to_string(), denom);
    let deposit_balance = deposit_balance_read(deps.storage).load(deposit_key.as_bytes())?;
    if deposit_balance < amount {
        return Err(ContractError::Std(StdError::generic_err("balances deposited not enough")));
    }

    // Call token module to burn native token bound
    let amount_denom = amount.to_string() + &denom;
    let burn_msg: CosmosMsg<CustomMsg> =
        CosmosMsg::Custom(CustomMsg::Token(TokenMsg::Burn { amount: amount_denom })).into();

    Ok(Response::new().add_message(burn_msg))
}

fn execute_mint_wrapped(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    recipient: HumanAddr,
    amount: Uint128,
) -> Result<Response<CustomMsg>, ContractError> {
    // Only bridge and ourselves can mint
    let wrapped_info = wrapped_asset_info_read(deps.storage).load()?;
    if env.contract.address.to_string() != info.sender.to_string()
        && wrapped_info.bridge != deps.api.addr_canonicalize(info.sender.as_str())? {
        return Err(ContractError::Unauthorized {});
    }

    // Call token module to mint native token bound
    let denom = bind_native_asset_read(deps.storage).load()?.denom;
    let amount_denom = amount.to_string() + &denom;
    let mint_msg: CosmosMsg<CustomMsg> =
        CosmosMsg::Custom(CustomMsg::Token(TokenMsg::Mint { amount: amount_denom }));
    // Send native token minted to recipient
    let send_msg: CosmosMsg<CustomMsg> = CosmosMsg::Custom(CustomMsg::Bank(BankMsg::Send {
        from_address: Some(env.contract.address.to_string()),
        to_address: recipient.to_string(),
        amount: vec![Coin { denom, amount }],
    }));

    Ok(Response::new().
        add_message(mint_msg).
        add_message(send_msg))
    // execute_mint(deps, env, info, recipient, amount)
}

// fn execute_update_metadata(
//     deps: DepsMut,
//     _env: Env,
//     info: MessageInfo,
//     name: String,
//     symbol: String,
// ) -> Result<Response, ContractError> {
//     // Only bridge can update.
//     let wrapped_info = wrapped_asset_info_read(deps.storage).load()?;
//     if wrapped_info.bridge != deps.api.addr_canonicalize(info.sender.as_str())? {
//         return Err(ContractError::Unauthorized {});
//     }
//
//     let mut state = TOKEN_INFO.load(deps.storage)?;
//     state.name = name;
//     state.symbol = symbol;
//     TOKEN_INFO.save(deps.storage, &state)?;
//     Ok(Response::default())
// }

fn execute_deposit(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
) -> Result<Response<CustomMsg>, ContractError> {
    let denom = bind_native_asset_read(deps.storage).load()?.denom;
    for coin in info.funds {
        if coin.denom != denom {
            return Err(ContractError::Std(StdError::generic_err("denom mismatch bound")));
        };
        let deposit_key = format!("{}:{}", info.sender, coin.denom);
        deposit_balance(deps.storage).update(
            deposit_key.as_bytes(),
            |amount: Option<Uint128>| -> StdResult<Uint128> {
                Ok(amount.unwrap_or(Uint128::new(0)) + coin.amount)
            },
        )?;
    }
    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps<CustomQuery>, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::WrappedAssetInfo {} => to_binary(&query_wrapped_asset_info(deps)?),
        // inherited from cw20-base
        QueryMsg::TokenInfo {} => to_binary(&query_token_info(deps)?),
        QueryMsg::Balance { address } => to_binary(&query_balance(deps, address)?),
        QueryMsg::Allowance { owner: _, spender: _ } => {
            // to_binary(&query_allowance(deps, owner, spender)?)
            Err(StdError::generic_err(STD_ERR_UNSUPPORTED_QUERY_MESSAGE))
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> StdResult<Response> {
    Ok(Response::new())
}

pub fn query_balance(deps: Deps<CustomQuery>, address: HumanAddr) -> StdResult<BalanceResponse> {
    // Call query Balance for bank module
    let denom = bind_native_asset_read(deps.storage).load()?.denom;
    let req = CustomQuery::Bank(BankQuery::Balance { address, denom }).into();
    let res: StdResult<BalanceResponse> = deps.querier.query(&req);
    res
}

pub fn query_token_info(deps: Deps<CustomQuery>) -> StdResult<TokenInfoResponse> {
    // Call query DenomMetadata for bank module
    let denom = bind_native_asset_read(deps.storage).load()?.denom;
    let metadata_req = CustomQuery::Bank(BankQuery::DenomMetadata { denom: denom.clone() }).into();
    let metadata_res: DenomMetadataResponse = deps.querier.query(&metadata_req)?;
    let display = metadata_res.metadata.display.unwrap();
    let mut dec:u8 = 0;
    for u in metadata_res.metadata.denom_units {
        if display == u.denom {
            dec = u.exponent.unwrap_or(0);
            break;
        }
    }
    // Call query SupplyOf for bank module
    let supply_req = CustomQuery::Bank(BankQuery::SupplyOf { denom }).into();
    let supply_res: SupplyOfResponse = deps.querier.query(&supply_req)?;
    Ok(TokenInfoResponse {
        name: metadata_res.metadata.name.unwrap_or(metadata_res.metadata.base),
        symbol: metadata_res.metadata.symbol.unwrap_or(display),
        decimals: dec,
        total_supply: supply_res.amount.amount,
        // total_supply: Uint128::new(0),
    })
}

pub fn query_wrapped_asset_info(deps: Deps<CustomQuery>) -> StdResult<WrappedAssetInfoResponse> {
    let info = wrapped_asset_info_read(deps.storage).load()?;
    Ok(WrappedAssetInfoResponse {
        asset_chain: info.asset_chain,
        asset_address: info.asset_address,
        bridge: deps.api.addr_humanize(&info.bridge)?,
    })
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn reply(deps: DepsMut, _env: Env, msg: Reply) -> StdResult<Response<CustomMsg>> {
    match msg.id {
        ISSUE_REPLY_ID => handle_issue_reply(deps, msg),
        id => Err(StdError::generic_err(format!("Unknown reply id: {}", id))),
    }
}

fn handle_issue_reply(deps: DepsMut, msg: Reply) -> StdResult<Response<CustomMsg>> {
    let sub_msg = msg.result.into_result().map_err(StdError::generic_err)?;
    // Get new denom and save to storage
    if let Some(res) = sub_msg.data {
        let response: IssueResponse = from_binary(&res)?;
        let native_data = BindNativeAsset {
            denom: response.denom,
        };
        bind_native_asset(deps.storage).save(&native_data)?;
        Ok(Response::new())
    } else {
        return Err(StdError::generic_err("no denom return"))
    }
}

