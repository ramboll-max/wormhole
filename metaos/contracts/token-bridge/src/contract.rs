use std::cmp::max;
use std::str::FromStr;

use cosmwasm_std::{
    BankMsg,
    Binary,
    CanonicalAddr,
    coin,
    Coin,
    CosmosMsg,
    Deps,
    DepsMut,
    Env,
    Event,
    from_binary,
    MessageInfo,
    QueryRequest,
    Reply,
    Response,
    StdError,
    StdResult,
    SubMsg,
    to_binary,
    Uint128,
    WasmMsg,
    WasmQuery
};
#[allow(unused_imports)]
use cosmwasm_std::entry_point;
use cw20::{
    BalanceResponse,
    TokenInfoResponse,
};
use cw20_base::msg::{
    ExecuteMsg as TokenMsg,
    QueryMsg as TokenQuery,
};

use custom_msg::{
    bank_msg::{
        BankMsg as CustomBankMsg,
        BankQuery,
        DenomMetadataResponse},
    custom_msg::{
        CustomQuery,
        CustomMsg},
    token_msg::{
        IssueResponse,
        TokenMsg as CustomTokenMsg
    }
};
use wormhole::{
    byte_utils::{
        ByteUtils,
        extend_address_to_32,
        extend_address_to_32_array,
        extend_string_to_32,
        get_string_from_32,
    },
    error::ContractError,
    msg::{
        ExecuteMsg as WormholeExecuteMsg,
        QueryMsg as WormholeQueryMsg,
    },
    state::{
        GovernancePacket,
        ParsedVAA,
        vaa_archive_add,
        vaa_archive_check,
    },
};

use crate::{
    asset::{
        Asset,
        AssetInfo,
    },
    CHAIN_ID,
    msg::{
        DenomWrappedAssetInfoResponse,
        ExecuteMsg,
        ExternalIdResponse,
        InstantiateMsg,
        MigrateMsg,
        QueryMsg,
        TransferInfoResponse,
        WrappedRegistryResponse,
    },
    state::{
        Action,
        AssetMeta,
        bridge_contracts,
        bridge_contracts_read,
        config,
        config_read,
        ConfigInfo,
        denom_wrapped_asset_address,
        denom_wrapped_asset_address_read,
        denom_wrapped_asset_chain_id,
        denom_wrapped_asset_chain_id_read,
        receive_native,
        RegisterChain,
        send_native,
        TokenBridgeMessage,
        TransferInfo,
        TransferState,
        TransferWithPayloadInfo,
        UpgradeContract,
        wrapped_asset_denom,
        wrapped_asset_denom_read,
        wrapped_asset_seq,
        wrapped_asset_seq_read,
        wrapped_asset_tmp,
        wrapped_transfer_tmp,
        WrappedAssetTemp
    },
    token_address::{
        ContractId,
        ExternalTokenId,
        TokenId,
    },
};

type HumanAddr = String;

const ISSUE_REPLY_ID: u64 = 1;
const TRANSFER_FROM_REPLY_ID: u64 = 2;

pub enum TransferType<A> {
    WithoutPayload,
    WithPayload { payload: A },
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> StdResult<Response<CustomMsg>> {
    Ok(Response::new())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response<CustomMsg>> {
    // Save general wormhole info
    let state = ConfigInfo {
        gov_chain: msg.gov_chain,
        gov_address: msg.gov_address.into(),
        wormhole_contract: msg.wormhole_contract,
    };
    config(deps.storage).save(&state)?;

    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn reply(deps: DepsMut, env: Env, msg: Reply) -> StdResult<Response<CustomMsg>> {
    match msg.id {
        ISSUE_REPLY_ID => handle_issue_reply(deps, env, msg),
        TRANSFER_FROM_REPLY_ID => handle_transfer_from_reply(deps, env, msg),
        id => Err(StdError::generic_err(format!("Unknown reply id: {}", id))),
    }
}

fn handle_issue_reply(deps: DepsMut, _env: Env, msg: Reply) -> StdResult<Response<CustomMsg>> {
    // Save wrapped asset denom
    let sub_res = msg.result.into_result().map_err(StdError::generic_err)?;
    if let Some(res) = sub_res.data {
        // Query wrapped asset info
        let wrapped_asset_temp = wrapped_asset_tmp(deps.storage).load()?;
        // We need to ensure that this registration request was initiated by the
        // token bridge contract. We do this by checking that the wrapped asset
        // already has an associated sequence number, but no address entry yet.
        // This is a necessary and sufficient condition, because having the sequence
        // number means that [`handle_create_wrapped`] has been called, and not having
        // an address entry yet means precisely that the callback hasn't finished
        // yet.
        let _ = wrapped_asset_seq_read(deps.storage, wrapped_asset_temp.chain_id)
            .load(&wrapped_asset_temp.foreign_address.as_slice())
            .map_err(|_| ContractError::RegistrationForbidden.std())?;

        let response: IssueResponse = from_binary(&res)?;
        let wrapped_denom = response.denom;
        wrapped_asset_tmp(deps.storage).remove();
        wrapped_asset_denom(deps.storage, wrapped_asset_temp.chain_id)
            .save(wrapped_asset_temp.foreign_address.as_slice(), &wrapped_denom)?;
        denom_wrapped_asset_chain_id(deps.storage)
            .save(wrapped_denom.as_bytes(), &wrapped_asset_temp.chain_id)?;
        denom_wrapped_asset_address(deps.storage)
            .save(wrapped_denom.as_bytes(), &wrapped_asset_temp.foreign_address)?;
        let event = Event::new("create_wrapped_reply")
            .add_attribute("wrapped_denom", wrapped_denom);
        Ok(Response::new().add_event(event))
    } else {
        return Err(StdError::generic_err("no denom return"))
    }
}

// When CW20 transfers complete, we need to verify the actual amount that is being transferred out
// of the bridge. This is to handle fee tokens where the amount expected to be transferred may be
// less due to burns, fees, etc.
fn handle_transfer_from_reply(deps: DepsMut, env: Env, _msg: Reply) -> StdResult<Response<CustomMsg>> {
    let cfg = config_read(deps.storage).load()?;

    let state = wrapped_transfer_tmp(deps.storage).load()?;
    // NOTE: Reentrancy protection. See note in `handle_initiate_transfer_token`
    // for why this is necessary.
    wrapped_transfer_tmp(deps.storage).remove();

    let token_bridge_message = TokenBridgeMessage::deserialize(&state.message)?;

    let (mut transfer_info, transfer_type) = match token_bridge_message.action {
        Action::TRANSFER => {
            let info = TransferInfo::deserialize(&token_bridge_message.payload)?;
            Ok((info, TransferType::WithoutPayload))
        }
        Action::TRANSFER_WITH_PAYLOAD => {
            let info = TransferWithPayloadInfo::deserialize(&token_bridge_message.payload)?;
            Ok((
                info.as_transfer_info(),
                TransferType::WithPayload {
                    // put both the payload and sender_address into the payload
                    // field here (which we can do, since [`TransferType`] is
                    // parametric)
                    payload: (info.payload, info.sender_address),
                },
            ))
        }
        _ => Err(StdError::generic_err("Unreachable")),
    }?;

    // Fetch CW20 Balance post-transfer.
    let new_balance: BalanceResponse =
        deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
            contract_addr: state.token_address.to_string(),
            msg: to_binary(&TokenQuery::Balance {
                address: env.contract.address.to_string(),
            })?,
        }))?;

    // Actual amount should be the difference in balance of the CW20 account in question to account
    // for fee tokens.
    let multiplier = Uint128::from_str(&state.multiplier)?;
    let real_amount = new_balance.balance - Uint128::from_str(&state.previous_balance)?;
    let real_amount = real_amount / multiplier;

    // If the fee is too large the user would receive nothing.
    if transfer_info.fee.1 > real_amount.u128() {
        return Err(StdError::generic_err("fee greater than sent amount"));
    }

    // Update Wormhole message to correct amount.
    transfer_info.amount.1 = real_amount.u128();

    let token_bridge_message = match transfer_type {
        TransferType::WithoutPayload => TokenBridgeMessage {
            action: Action::TRANSFER,
            payload: transfer_info.serialize(),
        },
        TransferType::WithPayload { payload } => TokenBridgeMessage {
            action: Action::TRANSFER_WITH_PAYLOAD,
            payload: TransferWithPayloadInfo {
                amount: transfer_info.amount,
                token_address: transfer_info.token_address,
                token_chain: transfer_info.token_chain,
                recipient: transfer_info.recipient,
                recipient_chain: transfer_info.recipient_chain,
                sender_address: payload.1,
                payload: payload.0,
            }
                .serialize(),
        },
    };

    // Post Wormhole Message
    let message = CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: cfg.wormhole_contract,
        funds: vec![],
        msg: to_binary(&WormholeExecuteMsg::PostMessage {
            message: Binary::from(token_bridge_message.serialize()),
            nonce: state.nonce,
        })?,
    });

    let external_id = ExternalTokenId::from_native_cw20(&state.token_address)?;
    send_native(deps.storage, &external_id, real_amount)?;
    Ok(Response::default()
        .add_message(message)
        .add_attribute("action", "reply_handler"))
}

fn parse_vaa(deps: Deps<CustomQuery>, block_time: u64, data: &Binary) -> StdResult<ParsedVAA> {
    let cfg = config_read(deps.storage).load()?;
    let vaa: ParsedVAA = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: cfg.wormhole_contract,
        msg: to_binary(&WormholeQueryMsg::VerifyVAA {
            vaa: data.clone(),
            block_time,
        })?,
    }))?;
    Ok(vaa)
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(deps: DepsMut<CustomQuery>, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response<CustomMsg>> {
    match msg {
        ExecuteMsg::DepositAndTransferBankTokens {
            denom,
            amount,
            recipient_chain,
            recipient,
            fee,
            nonce,
        } => handle_deposit_and_transfer(
            deps,
            env,
            info,
            recipient_chain,
            recipient.to_array()?,
            denom,
            amount,
            fee,
            TransferType::WithoutPayload,
            nonce,
        ),
        ExecuteMsg::DepositAndTransferBankTokensWithPayload {
            denom,
            amount,
            recipient_chain,
            recipient,
            fee,
            payload,
            nonce,
        } => handle_deposit_and_transfer(
            deps,
            env,
            info,
            recipient_chain,
            recipient.to_array()?,
            denom,
            amount,
            fee,
            TransferType::WithPayload {
                payload: payload.into(),
            },
            nonce,
        ),
        ExecuteMsg::InitiateTransfer {
            asset,
            recipient_chain,
            recipient,
            fee,
            nonce,
        } => handle_initiate_transfer(
            deps,
            env,
            info,
            asset,
            recipient_chain,
            recipient.to_array()?,
            fee,
            TransferType::WithoutPayload,
            nonce,
        ),
        ExecuteMsg::InitiateTransferWithPayload {
            asset,
            recipient_chain,
            recipient,
            fee,
            payload,
            nonce,
        } => handle_initiate_transfer(
            deps,
            env,
            info,
            asset,
            recipient_chain,
            recipient.to_array()?,
            fee,
            TransferType::WithPayload {
                payload: payload.into(),
            },
            nonce,
        ),
        ExecuteMsg::SubmitVaa { data } => submit_vaa(deps, env, info, &data),
        ExecuteMsg::CreateAssetMeta { asset_info, nonce } => {
            handle_create_asset_meta(deps, env, info, asset_info, nonce)
        }
        ExecuteMsg::CompleteTransferWithPayload { data, relayer } => {
            handle_complete_transfer_with_payload(deps, env, info, &data, &relayer)
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_deposit_and_transfer(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    recipient_chain: u16,
    recipient: [u8; 32],
    denom: String,
    amount: Uint128,
    fee: Uint128,
    transfer_type: TransferType<Vec<u8>>,
    nonce: u32,
) -> StdResult<Response<CustomMsg>> {
    // deposit
    let denoms_count = info.funds.len();
    if denoms_count == 0 {
        return Err(StdError::generic_err("no denom sent"));
    }
    let mut wormhole_fee: Vec<Coin> =  Vec::new();
    let mut found = false;
    for coin in info.clone().funds {
        if coin.denom == denom {
            if found {
                wormhole_fee.push(coin);
                continue;
            }
            if coin.amount < amount {
                return Err(StdError::generic_err(format!("send more {} please", denom)));
            }
            let mut last_coin = coin.clone();
            last_coin.amount -= amount;
            if last_coin.amount > Uint128::zero() {
                wormhole_fee.push(last_coin);
            }
            found = true;
        } else {
            wormhole_fee.push(coin);
        }
    }
    if !found {
        return Err(StdError::generic_err(format!("send more {} please", denom)));
    }

    // whether it is a wrapped denom
    let init_res = match denom_wrapped_asset_address_read(deps.storage).load(denom.as_bytes()) {
        Ok(asset_addr) => initiate_transfer_wrapped_token(
            deps,
            env,
            info,
            denom.clone(),
            amount,
            recipient_chain,
            recipient,
            fee,
            transfer_type,
            nonce,
            asset_addr,
            wormhole_fee,
        ),
        Err(_) => initiate_transfer_native_token(
            deps,
            env,
            info,
            denom.clone(),
            amount,
            recipient_chain,
            recipient,
            fee,
            transfer_type,
            nonce,
            wormhole_fee,
        )
    };
    match init_res {
        Ok(res) => Ok(res.add_attribute("action", "deposit_and_transfer")),
        Err(err) => Err(err)
    }
}

fn handle_create_wrapped(
    deps: DepsMut<CustomQuery>,
    _env: Env,
    emitter_chain: u16,
    emitter_address: Vec<u8>,
    sequence: u64,
    data: &Vec<u8>,
) -> StdResult<Response<CustomMsg>> {
    let meta = AssetMeta::deserialize(data)?;

    let expected_contract =
        bridge_contracts_read(deps.storage).load(&emitter_chain.to_be_bytes())?;

    // must be sent by a registered token bridge contract
    if expected_contract != emitter_address {
        return Err(StdError::generic_err("invalid emitter"));
    }

    let token_id = meta
        .token_address
        .to_token_id(deps.storage, emitter_chain)?;

    let (chain_id, token_address) = match token_id.clone() {
        TokenId::Bank { denom } => Err(StdError::generic_err(format!(
            "{} is native to this chain and should not be attested",
            denom
        ))),
        TokenId::Contract(ContractId::NativeCW20 { contract_address }) => {
            Err(StdError::generic_err(format!(
                "Contract {} is native to this chain and should not be attested",
                contract_address
            )))
        }
        TokenId::Contract(ContractId::ForeignToken {
                              chain_id,
                              foreign_address,
                          }) => Ok((chain_id, foreign_address)),
    }?;
    // If a Denom wrapped already exists, return an error. If not, we create a brand new token.
    match wrapped_asset_denom_read(deps.storage, chain_id)
        .load(token_address.as_slice()) {
        Ok(_) => {
            // A asset can be attested only once.
            Err(StdError::generic_err(
                "this asset has already been attested",
            ))
        },
        Err(_) => {
            // Invoke Issue for token module
            let name = get_string_from_32(&meta.name);
            let wrapped_name = name.clone() + " (Wormhole)";
            let wrapped_symbol = get_string_from_32(&meta.symbol).to_uppercase();
            let sub_msg = SubMsg::reply_on_success(
                CosmosMsg::Custom(CustomMsg::Token(CustomTokenMsg::Issue {
                    name: wrapped_name.clone(),
                    symbol: Some(wrapped_symbol.clone()),
                    decimals: Some(meta.decimals),
                    initial_supply: Some("0".to_string()),
                    max_supply: Some("0".to_string()),
                    description: Some(format!("Wormhole Wrapped {}", name).to_string()),
                })), ISSUE_REPLY_ID);
            wrapped_asset_seq(deps.storage, meta.token_chain).save(&token_address.as_slice(), &sequence)?;
            // Save temp wrapped asset info, and it will be removed on reply
            wrapped_asset_tmp(deps.storage).save(&WrappedAssetTemp { chain_id, foreign_address: token_address })?;
            let event = Event::new("create_wrapped")
                .add_attribute("token_chain", format!("{:?}", chain_id))
                .add_attribute("token_address", format!("{:?}", token_address))
                .add_attribute("wrapped_name", wrapped_name)
                .add_attribute("wrapped_symbol", wrapped_symbol)
                .add_attribute("wrapped_decimals", meta.decimals.to_string());

            Ok(Response::new().add_submessage(sub_msg).add_event(event))
        }
    }
}

fn handle_create_asset_meta(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    asset_info: AssetInfo,
    nonce: u32,
) -> StdResult<Response<CustomMsg>> {
    match asset_info {
        AssetInfo::Token { contract_addr } => {
            handle_create_asset_meta_token(deps, env, info, contract_addr, nonce)
        }
        AssetInfo::BankToken { ref denom } => {
            handle_create_asset_meta_native_token(deps, env, info, denom.clone(), nonce)
        }
    }
}

fn handle_create_asset_meta_token(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    asset_address: HumanAddr,
    nonce: u32,
) -> StdResult<Response<CustomMsg>> {
    let cfg = config_read(deps.storage).load()?;

    let request = QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: asset_address.clone(),
        msg: to_binary(&TokenQuery::TokenInfo {})?,
    });

    let asset_human = deps.api.addr_validate(&asset_address)?;
    let token_id = TokenId::Contract(ContractId::NativeCW20 {
        contract_address: asset_human,
    });
    let external_id = token_id.store(deps.storage)?;
    let token_info: TokenInfoResponse = deps.querier.query(&request)?;

    let meta: AssetMeta = AssetMeta {
        token_chain: CHAIN_ID,
        token_address: external_id.clone(),
        decimals: token_info.decimals,
        symbol: extend_string_to_32(&token_info.symbol),
        name: extend_string_to_32(&token_info.name),
    };

    let token_bridge_message = TokenBridgeMessage {
        action: Action::ATTEST_META,
        payload: meta.serialize().to_vec(),
    };

    Ok(Response::new()
        .add_message(CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: cfg.wormhole_contract,
            msg: to_binary(&WormholeExecuteMsg::PostMessage {
                message: Binary::from(token_bridge_message.serialize()),
                nonce,
            })?,
            // forward coins sent to this message
            funds: info.funds,
        }))
        .add_attribute("meta.token_chain", CHAIN_ID.to_string())
        .add_attribute("meta.token", asset_address)
        .add_attribute("meta.decimals", token_info.decimals.to_string())
        .add_attribute("meta.asset_id", hex::encode(external_id.serialize()))
        .add_attribute("meta.nonce", nonce.to_string())
        .add_attribute("meta.block_time", env.block.time.seconds().to_string()))
}

fn handle_create_asset_meta_native_token(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    denom: String,
    nonce: u32,
) -> StdResult<Response<CustomMsg>> {
    // make sure it is not a wrapped denom
    if let Ok(_) = denom_wrapped_asset_address_read(deps.storage).load(denom.as_bytes()) {
        return Err(StdError::generic_err("Denom is wrapped asset"));
    }

    let cfg = config_read(deps.storage).load()?;
    // Call query DenomMetadata for bank module
    let metadata_req = CustomQuery::Bank(BankQuery::DenomMetadata { denom: denom.clone() }).into();
    let metadata_res: DenomMetadataResponse = deps.querier.query(&metadata_req)?;
    let display = metadata_res.metadata.display.unwrap();
    let symbol = metadata_res.metadata.symbol.
        unwrap_or(display.clone());
    let mut dec: u8 = 0;
    for u in metadata_res.metadata.denom_units {
        if display == u.denom {
            dec = u.exponent.unwrap_or(0);
            break;
        }
    }

    let token_id = TokenId::Bank { denom };
    let external_id = token_id.store(deps.storage)?;

    let meta: AssetMeta = AssetMeta {
        token_chain: CHAIN_ID,
        token_address: external_id.clone(),
        decimals: dec,
        symbol: extend_string_to_32(
            symbol.clone().as_str()),
        name: extend_string_to_32(
            metadata_res.metadata.name.
                unwrap_or(metadata_res.metadata.base).
                as_str()),
    };
    let token_bridge_message = TokenBridgeMessage {
        action: Action::ATTEST_META,
        payload: meta.serialize().to_vec(),
    };
    Ok(Response::new()
        .add_message(CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: cfg.wormhole_contract,
            msg: to_binary(&WormholeExecuteMsg::PostMessage {
                message: Binary::from(token_bridge_message.serialize()),
                nonce,
            })?,
            // forward coins sent to this message
            funds: info.funds,
        }))
        .add_attribute("meta.token_chain", CHAIN_ID.to_string())
        .add_attribute("meta.symbol", symbol)
        .add_attribute("meta.decimals", dec.to_string())
        .add_attribute("meta.asset_id", hex::encode(external_id.serialize()))
        .add_attribute("meta.nonce", nonce.to_string())
        .add_attribute("meta.block_time", env.block.time.seconds().to_string()))
}

fn handle_complete_transfer_with_payload(
    mut deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    data: &Binary,
    relayer_address: &HumanAddr,
) -> StdResult<Response<CustomMsg>> {
    let (vaa, payload) = parse_and_archive_vaa(deps.branch(), env.clone(), data)?;

    if let Either::Right(message) = payload {
        match message.action {
            Action::TRANSFER_WITH_PAYLOAD => handle_complete_transfer(
                deps,
                env,
                info,
                vaa.emitter_chain,
                vaa.emitter_address,
                TransferType::WithPayload { payload: () },
                &message.payload,
                relayer_address,
            ),
            _ => ContractError::InvalidVAAAction.std_err(),
        }
    } else {
        ContractError::InvalidVAAAction.std_err()
    }
}

enum Either<A, B> {
    Left(A),
    Right(B),
}

fn parse_and_archive_vaa(
    deps: DepsMut<CustomQuery>,
    env: Env,
    data: &Binary,
) -> StdResult<(ParsedVAA, Either<GovernancePacket, TokenBridgeMessage>)> {
    let state = config_read(deps.storage).load()?;

    let vaa = parse_vaa(deps.as_ref(), env.block.time.seconds(), data)?;

    if vaa_archive_check(deps.storage, vaa.hash.as_slice()) {
        return ContractError::VaaAlreadyExecuted.std_err();
    }
    vaa_archive_add(deps.storage, vaa.hash.as_slice())?;

    // check if vaa is from governance
    if is_governance_emitter(&state, vaa.emitter_chain, &vaa.emitter_address) {
        let gov_packet = GovernancePacket::deserialize(&vaa.payload)?;
        return Ok((vaa, Either::Left(gov_packet)));
    }

    let message = TokenBridgeMessage::deserialize(&vaa.payload)?;
    Ok((vaa, Either::Right(message)))
}

fn submit_vaa(
    mut deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    data: &Binary,
) -> StdResult<Response<CustomMsg>> {
    let (vaa, payload) = parse_and_archive_vaa(deps.branch(), env.clone(), data)?;
    match payload {
        Either::Left(governance_packet) => handle_governance_payload(deps, env, &governance_packet),
        Either::Right(message) => match message.action {
            Action::TRANSFER => {
                let sender = info.sender.to_string();
                handle_complete_transfer(
                    deps,
                    env,
                    info,
                    vaa.emitter_chain,
                    vaa.emitter_address,
                    TransferType::WithoutPayload,
                    &message.payload,
                    &sender,
                )
            }
            Action::ATTEST_META => handle_create_wrapped(
                deps,
                env,
                vaa.emitter_chain,
                vaa.emitter_address,
                vaa.sequence,
                &message.payload,
            ),
            _ => ContractError::InvalidVAAAction.std_err(),
        },
    }
}

fn handle_governance_payload(
    deps: DepsMut<CustomQuery>,
    env: Env,
    gov_packet: &GovernancePacket,
) -> StdResult<Response<CustomMsg>> {
    let module = get_string_from_32(&gov_packet.module);

    if module != "TokenBridge" {
        return Err(StdError::generic_err("this is not a valid module"));
    }

    if gov_packet.chain != 0 && gov_packet.chain != CHAIN_ID {
        return Err(StdError::generic_err(
            "the governance VAA is for another chain",
        ));
    }

    match gov_packet.action {
        1u8 => handle_register_chain(deps, env, &gov_packet.payload),
        2u8 => handle_upgrade_contract(deps, env, &gov_packet.payload),
        _ => ContractError::InvalidVAAAction.std_err(),
    }
}

fn handle_upgrade_contract(_deps: DepsMut<CustomQuery>, env: Env, data: &Vec<u8>) -> StdResult<Response<CustomMsg>> {
    let UpgradeContract { new_contract } = UpgradeContract::deserialize(data)?;

    Ok(Response::new()
        .add_message(CosmosMsg::Wasm(WasmMsg::Migrate {
            contract_addr: env.contract.address.to_string(),
            new_code_id: new_contract,
            msg: to_binary(&MigrateMsg {})?,
        }))
        .add_attribute("action", "contract_upgrade"))
}

fn handle_register_chain(deps: DepsMut<CustomQuery>, _env: Env, data: &Vec<u8>) -> StdResult<Response<CustomMsg>> {
    let RegisterChain {
        chain_id,
        chain_address,
    } = RegisterChain::deserialize(data)?;

    let existing = bridge_contracts_read(deps.storage).load(&chain_id.to_be_bytes());
    if existing.is_ok() {
        return Err(StdError::generic_err(
            "bridge contract already exists for this chain",
        ));
    }

    let mut bucket = bridge_contracts(deps.storage);
    bucket.save(&chain_id.to_be_bytes(), &chain_address)?;

    Ok(Response::new()
        .add_attribute("chain_id", chain_id.to_string())
        .add_attribute("chain_address", hex::encode(chain_address)))
}

#[allow(clippy::too_many_arguments)]
fn handle_complete_transfer(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    emitter_chain: u16,
    emitter_address: Vec<u8>,
    transfer_type: TransferType<()>,
    data: &Vec<u8>,
    relayer_address: &HumanAddr,
) -> StdResult<Response<CustomMsg>> {
    let transfer_info = TransferInfo::deserialize(data)?;
    let token_id = transfer_info
        .token_address
        .to_token_id(deps.storage, transfer_info.token_chain)?;
    match token_id {
        TokenId::Bank { denom } => handle_complete_transfer_token_native(
            deps,
            env,
            info,
            emitter_chain,
            emitter_address,
            denom,
            transfer_type,
            data,
            relayer_address,
        ),
        TokenId::Contract(contract) => handle_complete_transfer_token(
            deps,
            env,
            info,
            emitter_chain,
            emitter_address,
            contract,
            transfer_type,
            data,
            relayer_address,
        ),
    }
}

#[allow(clippy::too_many_arguments)]
#[allow(clippy::bind_instead_of_map)]
fn handle_complete_transfer_token(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    emitter_chain: u16,
    emitter_address: Vec<u8>,
    token_contract: ContractId,
    transfer_type: TransferType<()>,
    data: &Vec<u8>,
    relayer_address: &HumanAddr,
) -> StdResult<Response<CustomMsg>> {
    let transfer_info = match transfer_type {
        TransferType::WithoutPayload => TransferInfo::deserialize(data)?,
        TransferType::WithPayload { payload: _ } => {
            TransferWithPayloadInfo::deserialize(data)?.as_transfer_info()
        }
    };

    let expected_contract =
        bridge_contracts_read(deps.storage).load(&emitter_chain.to_be_bytes())?;

    // must be sent by a registered token bridge contract
    if expected_contract != emitter_address {
        return Err(StdError::generic_err("invalid emitter"));
    }

    if transfer_info.recipient_chain != CHAIN_ID {
        return Err(StdError::generic_err(
            "this transfer is not directed at this chain",
        ));
    }

    let target_address = (&transfer_info.recipient.as_slice()).get_address(0);
    let recipient = deps.api.addr_humanize(&target_address)?;

    if let TransferType::WithPayload { payload: _ } = transfer_type {
        if recipient != info.sender {
            return Err(StdError::generic_err(
                "transfers with payload can only be redeemed by the recipient",
            ));
        }
    };

    let (not_supported_amount, mut amount) = transfer_info.amount;
    let (not_supported_fee, mut fee) = transfer_info.fee;

    amount = amount.checked_sub(fee).unwrap();

    // Check high 128 bit of amount value to be empty
    if not_supported_amount != 0 || not_supported_fee != 0 {
        return ContractError::AmountTooHigh.std_err();
    }

    let external_id = ExternalTokenId::from_token_id(&TokenId::Contract(token_contract.clone()))?;

    match token_contract {
        ContractId::ForeignToken {
            chain_id,
            foreign_address,
        } => {
            // Check if this asset is already deployed
            match wrapped_asset_denom_read(deps.storage, chain_id)
                .load(foreign_address.as_slice()) {
                Ok(wrapped_denom) => {
                    // undo normalization to 8 decimals
                    // Call query DenomMetadata for bank module
                    let metadata_req = CustomQuery::Bank(BankQuery::DenomMetadata { denom: wrapped_denom.clone() }).into();
                    let metadata_res: DenomMetadataResponse = deps.querier.query(&metadata_req)?;
                    let display = metadata_res.metadata.display.unwrap();
                    let mut decimals: u8 = 0;
                    for u in metadata_res.metadata.denom_units {
                        if display == u.denom {
                            decimals = u.exponent.unwrap_or(0);
                            break;
                        }
                    }
                    let multiplier = 10u128.pow((max(decimals, 8u8) - 8u8) as u32);
                    amount = amount.checked_mul(multiplier).unwrap();
                    fee = fee.checked_mul(multiplier).unwrap();

                    // Asset already deployed, just mint
                    if amount + fee == 0 {
                        return Err(StdError::generic_err("Zero amount and fee total"));
                    }
                    // Call token module to mint native token bound
                    let total_denom = (amount + fee).to_string() + &wrapped_denom.clone();
                    let mint_msg: CosmosMsg<CustomMsg> =
                        CosmosMsg::Custom(CustomMsg::Token(CustomTokenMsg::Mint { amount: total_denom }));
                    let mut messages = vec![mint_msg];

                    // Send wrapped token minted to recipient
                    if amount > 0 {
                        messages.push(CosmosMsg::Custom(CustomMsg::Bank(CustomBankMsg::Send {
                            from_address: Some(env.contract.address.to_string()),
                            to_address: recipient.to_string(),
                            amount: vec![Coin { denom: wrapped_denom.clone(), amount: Uint128::from(amount) }],
                        })));
                    }

                    // Send wrapped fee minted to fee recipient
                    if fee > 0 {
                        messages.push(CosmosMsg::Custom(CustomMsg::Bank(CustomBankMsg::Send {
                            from_address: Some(env.contract.address.to_string()),
                            to_address: relayer_address.to_string(),
                            amount: vec![Coin { denom: wrapped_denom.clone(), amount: Uint128::from(fee) }],
                        })));
                    }

                    // emit Event
                    let event = Event::new("complete_transfer_wrapped")
                        .add_attribute("wrapped_denom", wrapped_denom)
                        .add_attribute("recipient", recipient.to_string())
                        .add_attribute("amount", amount.to_string())
                        .add_attribute("relayer", relayer_address.to_string())
                        .add_attribute("fee", fee.to_string());

                    Ok(Response::new().add_messages(messages).add_event(event))
                },
                Err(_) => {
                    Err(StdError::generic_err(format!("Wrapped asset not deployed. To deploy, invoke CreateWrapped with the associated AssetMeta")))
                }
            }
            // let wrapped_asset_info = wrapped_asset_read(deps.storage, chain_id).load(foreign_address.as_slice()).
            //     or_else(|_| Err(StdError::generic_err(format!("Wrapped asset not deployed. To deploy, invoke CreateWrapped with the associated AssetMeta{:?}" , foreign_address))))?;
        }
        ContractId::NativeCW20 { contract_address } => {
            // note -- here the amount is the amount the recipient will receive;
            // amount + fee is the total sent
            receive_native(deps.storage, &external_id, Uint128::new(amount + fee))?;

            // undo normalization to 8 decimals
            let token_info: TokenInfoResponse =
                deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
                    contract_addr: contract_address.to_string(),
                    msg: to_binary(&TokenQuery::TokenInfo {})?,
                }))?;

            let decimals = token_info.decimals;
            let multiplier = 10u128.pow((max(decimals, 8u8) - 8u8) as u32);
            amount = amount.checked_mul(multiplier).unwrap();
            fee = fee.checked_mul(multiplier).unwrap();

            let mut messages: Vec<CosmosMsg<CustomMsg>> = vec![];

            if amount > 0 {
                messages.push(CosmosMsg::Wasm(WasmMsg::Execute {
                    contract_addr: contract_address.to_string(),
                    msg: to_binary(&TokenMsg::Transfer {
                        recipient: recipient.to_string(),
                        amount: Uint128::from(amount),
                    })?,
                    funds: vec![],
                }));
            }

            if fee > 0 {
                messages.push(CosmosMsg::Wasm(WasmMsg::Execute {
                    contract_addr: contract_address.to_string(),
                    msg: to_binary(&TokenMsg::Transfer {
                        recipient: relayer_address.to_string(),
                        amount: Uint128::from(fee),
                    })?,
                    funds: vec![],
                }));
            }

            // emit Event
            let event = Event::new("complete_transfer_native_cw20")
                .add_attribute("contract", contract_address)
                .add_attribute("recipient", recipient.to_string())
                .add_attribute("amount", amount.to_string())
                .add_attribute("relayer", relayer_address.to_string())
                .add_attribute("fee", fee.to_string());

            Ok(Response::new().add_messages(messages).add_event(event))
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_complete_transfer_token_native(
    deps: DepsMut<CustomQuery>,
    _env: Env,
    info: MessageInfo,
    emitter_chain: u16,
    emitter_address: Vec<u8>,
    denom: String,
    transfer_type: TransferType<()>,
    data: &Vec<u8>,
    relayer_address: &HumanAddr,
) -> StdResult<Response<CustomMsg>> {
    let transfer_info = match transfer_type {
        TransferType::WithoutPayload => TransferInfo::deserialize(data)?,
        TransferType::WithPayload { payload: () } => {
            TransferWithPayloadInfo::deserialize(data)?.as_transfer_info()
        }
    };

    let expected_contract =
        bridge_contracts_read(deps.storage).load(&emitter_chain.to_be_bytes())?;

    // must be sent by a registered token bridge contract
    if expected_contract != emitter_address {
        return Err(StdError::generic_err("invalid emitter"));
    }

    if transfer_info.recipient_chain != CHAIN_ID {
        return Err(StdError::generic_err(
            "this transfer is not directed at this chain",
        ));
    }

    let target_address = (&transfer_info.recipient.as_slice()).get_address(0);
    let recipient = deps.api.addr_humanize(&target_address)?;

    if let TransferType::WithPayload { payload: _ } = transfer_type {
        if recipient != info.sender {
            return Err(StdError::generic_err(
                "transfers with payload can only be redeemed by the recipient",
            ));
        }
    };

    let (not_supported_amount, mut amount) = transfer_info.amount;
    let (not_supported_fee, mut fee) = transfer_info.fee;

    amount = amount.checked_sub(fee).unwrap();

    // Check high 128 bit of amount value to be empty
    if not_supported_amount != 0 || not_supported_fee != 0 {
        return ContractError::AmountTooHigh.std_err();
    }

    let external_address = ExternalTokenId::from_bank_token(&denom)?;
    receive_native(deps.storage, &external_address, Uint128::new(amount + fee))?;

    // undo normalization to 8 decimals
    // Call query DenomMetadata for bank module
    let metadata_req = CustomQuery::Bank(BankQuery::DenomMetadata { denom: denom.clone() }).into();
    let metadata_res: DenomMetadataResponse = deps.querier.query(&metadata_req)?;
    let display = metadata_res.metadata.display.unwrap();
    let mut decimals: u8 = 0;
    for u in metadata_res.metadata.denom_units {
        if display == u.denom {
            decimals = u.exponent.unwrap_or(0);
            break;
        }
    }
    let multiplier = 10u128.pow((max(decimals, 8u8) - 8u8) as u32);
    amount = amount.checked_mul(multiplier).unwrap();
    fee = fee.checked_mul(multiplier).unwrap();


    let mut messages: Vec<CosmosMsg<CustomMsg>> = Vec::new();

    if amount > 0 {
        messages.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: recipient.to_string(),
            amount: vec![coin(amount, &denom)],
        }));
    }

    if fee > 0 {
        messages.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: relayer_address.to_string(),
            amount: vec![coin(fee, &denom)],
        }));
    }

    // emit Event
    let event = Event::new("complete_transfer_metaos_native")
        .add_attribute("denom", denom)
        .add_attribute("recipient", recipient.to_string())
        .add_attribute("amount", amount.to_string())
        .add_attribute("relayer", relayer_address.to_string())
        .add_attribute("fee", fee.to_string());

    Ok(Response::new().add_messages(messages).add_event(event))
}

#[allow(clippy::too_many_arguments)]
fn handle_initiate_transfer(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    asset: Asset,
    recipient_chain: u16,
    recipient: [u8; 32],
    fee: Uint128,
    transfer_type: TransferType<Vec<u8>>,
    nonce: u32,
) -> StdResult<Response<CustomMsg>> {
    match asset.info {
        AssetInfo::Token { contract_addr } => handle_initiate_transfer_token(
            deps,
            env,
            info,
            contract_addr,
            asset.amount,
            recipient_chain,
            recipient,
            fee,
            transfer_type,
            nonce,
        ),
        AssetInfo::BankToken { denom: _ } =>
            Err(
                StdError::generic_err("use deposit_and_transfer_bank_tokens to transfer denom")
            ),
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_initiate_transfer_token(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    asset: HumanAddr,
    mut amount: Uint128,
    recipient_chain: u16,
    recipient: [u8; 32],
    mut fee: Uint128,
    transfer_type: TransferType<Vec<u8>>,
    nonce: u32,
) -> StdResult<Response<CustomMsg>> {
    if recipient_chain == CHAIN_ID {
        return ContractError::SameSourceAndTarget.std_err();
    }
    if amount.is_zero() {
        return ContractError::AmountTooLow.std_err();
    }

    let asset_chain: u16;

    let asset_canonical: CanonicalAddr = deps.api.addr_canonicalize(&asset)?;

    let mut submessages: Vec<SubMsg<CustomMsg>> = vec![];

    // we'll only need this for payload 3 transfers
    let sender_address = deps.api.addr_canonicalize(&info.sender.to_string())?;
    let sender_address = extend_address_to_32_array(&sender_address);

    // normalize amount to 8 decimals when it sent over the wormhole
    let token_info: TokenInfoResponse =
        deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
            contract_addr: asset.clone(),
            msg: to_binary(&TokenQuery::TokenInfo {})?,
        }))?;

    let decimals = token_info.decimals;
    let multiplier = 10u128.pow((max(decimals, 8u8) - 8u8) as u32);

    // chop off dust
    amount = Uint128::new(
        amount
            .u128()
            .checked_sub(amount.u128().checked_rem(multiplier).unwrap())
            .unwrap(),
    );

    fee = Uint128::new(
        fee.u128()
            .checked_sub(fee.u128().checked_rem(multiplier).unwrap())
            .unwrap(),
    );

    // This is a regular asset, transfer its balance
    submessages.push(SubMsg::reply_on_success(
        CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: asset.clone(),
            msg: to_binary(&TokenMsg::TransferFrom {
                owner: info.sender.to_string(),
                recipient: env.contract.address.to_string(),
                amount,
            })?,
            funds: vec![],
        }),
        TRANSFER_FROM_REPLY_ID,
    ));

    asset_chain = CHAIN_ID;
    let address_human = deps.api.addr_humanize(&asset_canonical)?;
    // we store here just in case the token is transferred out before it's attested
    let external_id = TokenId::Contract(ContractId::NativeCW20 {
        contract_address: address_human,
    })
        .store(deps.storage)?;

    // convert to normalized amounts before recording & posting vaa
    let wormhole_amount = Uint128::new(amount.u128().checked_div(multiplier).unwrap());
    let wormhole_fee = Uint128::new(fee.u128().checked_div(multiplier).unwrap());

    // Fetch current CW20 Balance pre-transfer.
    let balance: BalanceResponse =
        deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
            contract_addr: asset.to_string(),
            msg: to_binary(&TokenQuery::Balance {
                address: env.contract.address.to_string(),
            })?,
        }))?;

    // NOTE: Reentrancy protection. It is crucial that there's no
    // ongoing transfer in progress here, otherwise we would override
    // its state.  This could happen if the asset's TransferFrom handler
    // sends us an InitiateTransfer message, which would be executed
    // before the reply handler due the the depth-first semantics of
    // message execution.  A simple protection mechanism is to require
    // that there's no execution in progress. The reply handler takes
    // care of clearing out this temporary storage when done.
    assert!(wrapped_transfer_tmp(deps.storage).load().is_err());

    let token_bridge_message: TokenBridgeMessage = match transfer_type {
        TransferType::WithoutPayload => {
            let transfer_info = TransferInfo {
                amount: (0, wormhole_amount.u128()),
                token_address: external_id.clone(),
                token_chain: asset_chain,
                recipient,
                recipient_chain,
                fee: (0, wormhole_fee.u128()),
            };
            TokenBridgeMessage {
                action: Action::TRANSFER,
                payload: transfer_info.serialize(),
            }
        }
        TransferType::WithPayload { payload } => {
            let transfer_info = TransferWithPayloadInfo {
                amount: (0, wormhole_amount.u128()),
                token_address: external_id.clone(),
                token_chain: asset_chain,
                recipient,
                recipient_chain,
                sender_address,
                payload,
            };
            TokenBridgeMessage {
                action: Action::TRANSFER_WITH_PAYLOAD,
                payload: transfer_info.serialize(),
            }
        }
    };

    let token_address = deps.api.addr_validate(&asset)?;

    // Wrap up state to be captured by the submessage reply.
    wrapped_transfer_tmp(deps.storage).save(&TransferState {
        previous_balance: balance.balance.to_string(),
        account: info.sender.to_string(),
        token_address,
        message: token_bridge_message.serialize(),
        multiplier: Uint128::new(multiplier).to_string(),
        nonce,
    })?;

    // emit Event
    let event = Event::new("initiate_transfer_token")
        .add_attribute("transfer.token_chain", asset_chain.to_string())
        .add_attribute("transfer.token", hex::encode(external_id.serialize()))
        .add_attribute("transfer.cw20", asset)
        .add_attribute(
            "transfer.sender",
            hex::encode(extend_address_to_32(
                &deps.api.addr_canonicalize(info.sender.as_str())?,
            )),
        )
        .add_attribute("transfer.recipient_chain", recipient_chain.to_string())
        .add_attribute("transfer.recipient", hex::encode(recipient))
        .add_attribute("transfer.amount", amount.to_string())
        .add_attribute("transfer.nonce", nonce.to_string())
        .add_attribute("transfer.block_time", env.block.time.seconds().to_string());

    Ok(Response::new().add_submessages(submessages).add_event(event))
}

#[allow(clippy::too_many_arguments)]
fn initiate_transfer_wrapped_token(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    denom: String,
    amount: Uint128,
    recipient_chain: u16,
    recipient: [u8; 32],
    fee: Uint128,
    transfer_type: TransferType<Vec<u8>>,
    nonce: u32,
    asset_address: [u8; 32],
    wormhole_fees: Vec<Coin>,
) -> StdResult<Response<CustomMsg>> {
    if recipient_chain == CHAIN_ID {
        return ContractError::SameSourceAndTarget.std_err();
    }
    if amount.is_zero() {
        return ContractError::AmountTooLow.std_err();
    }
    // If the fee is too large the user will receive nothing.
    if fee > amount {
        return Err(StdError::generic_err("fee greater than sent amount"));
    }

    let cfg: ConfigInfo = config_read(deps.storage).load()?;
    let mut messages: Vec<CosmosMsg<CustomMsg>> = vec![];

    // This is a wrapped asset, burn it
    // Call token module to burn native token bound
    let amount_denom = amount.to_string() + &denom;
    messages.push(
        CosmosMsg::Custom(CustomMsg::Token(CustomTokenMsg::Burn { amount: amount_denom }))
    );

    let asset_chain = denom_wrapped_asset_chain_id_read(deps.storage)
        .load(denom.as_bytes())?;

    let external_id = ExternalTokenId::from_foreign_token(asset_chain, asset_address);

    // Call query DenomMetadata for bank module
    let metadata_req = CustomQuery::Bank(BankQuery::DenomMetadata { denom: denom.clone() }).into();
    let metadata_res: DenomMetadataResponse = deps.querier.query(&metadata_req)?;
    let display = metadata_res.metadata.display.unwrap();
    let mut decimals: u8 = 0;
    for u in metadata_res.metadata.denom_units {
        if display == u.denom {
            decimals = u.exponent.unwrap_or(0);
            break;
        }
    }
    let multiplier = 10u128.pow((max(decimals, 8u8) - 8u8) as u32);

    // chop off dust
    let wormhole_amount = Uint128::new(
        amount
            .u128()
            .checked_sub(amount.u128().checked_rem(multiplier).unwrap())
            .unwrap(),
    ).u128() / multiplier;

    let wormhole_fee = Uint128::new(
        fee.u128()
            .checked_sub(fee.u128().checked_rem(multiplier).unwrap())
            .unwrap(),
    ).u128() / multiplier;

    let token_bridge_message: TokenBridgeMessage = match transfer_type {
        TransferType::WithoutPayload => {
            let transfer_info = TransferInfo {
                amount: (0, wormhole_amount),
                token_address: external_id,
                token_chain: asset_chain,
                recipient,
                recipient_chain,
                fee: (0, wormhole_fee),
            };
            TokenBridgeMessage {
                action: Action::TRANSFER,
                payload: transfer_info.serialize(),
            }
        }
        TransferType::WithPayload { payload } => {
            let sender_address = deps.api.addr_canonicalize(&info.sender.to_string())?;
            let sender_address = extend_address_to_32_array(&sender_address);
            let transfer_info = TransferWithPayloadInfo {
                amount: (0, wormhole_amount),
                token_address: external_id,
                token_chain: asset_chain,
                recipient,
                recipient_chain,
                sender_address,
                payload,
            };
            TokenBridgeMessage {
                action: Action::TRANSFER_WITH_PAYLOAD,
                payload: transfer_info.serialize(),
            }
        }
    };

    let sender = deps.api.addr_canonicalize(info.sender.as_str())?;
    messages.push(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: cfg.wormhole_contract,
        msg: to_binary(&WormholeExecuteMsg::PostMessage {
            message: Binary::from(token_bridge_message.serialize()),
            nonce,
        })?,
        // forward fee coins sent to this message
        funds: wormhole_fees,
    }));

    // emit Event
    let event = Event::new("initiate_transfer_wrapped_token")
        .add_attribute("transfer.token_chain", asset_chain.to_string())
        .add_attribute("transfer.token", hex::encode(asset_address.as_slice()))
        .add_attribute("transfer.wrapped_denom", denom)
        .add_attribute(
            "transfer.sender",
            hex::encode(extend_address_to_32(&sender)),
        )
        .add_attribute("transfer.recipient_chain", recipient_chain.to_string())
        .add_attribute("transfer.recipient", hex::encode(recipient))
        .add_attribute("transfer.amount", amount.to_string())
        .add_attribute("transfer.nonce", nonce.to_string())
        .add_attribute("transfer.block_time", env.block.time.seconds().to_string());

    Ok(Response::new().add_messages(messages).add_event(event))
}

#[allow(clippy::too_many_arguments)]
fn initiate_transfer_native_token(
    deps: DepsMut<CustomQuery>,
    env: Env,
    info: MessageInfo,
    denom: String,
    amount: Uint128,
    recipient_chain: u16,
    recipient: [u8; 32],
    fee: Uint128,
    transfer_type: TransferType<Vec<u8>>,
    nonce: u32,
    wormhole_fees: Vec<Coin>,
) -> StdResult<Response<CustomMsg>> {
    if recipient_chain == CHAIN_ID {
        return ContractError::SameSourceAndTarget.std_err();
    }
    if amount.is_zero() {
        return ContractError::AmountTooLow.std_err();
    }
    if fee > amount {
        return Err(StdError::generic_err("fee greater than sent amount"));
    }

    let cfg: ConfigInfo = config_read(deps.storage).load()?;
    let mut messages: Vec<CosmosMsg<CustomMsg>> = vec![];

    let asset_chain: u16 = CHAIN_ID;
    // we store here just in case the token is transferred out before it's attested
    let asset_address = TokenId::Bank { denom: denom.clone() }.store(deps.storage)?;

    // Call query DenomMetadata for bank module
    let metadata_req = CustomQuery::Bank(BankQuery::DenomMetadata { denom: denom.clone() }).into();
    let metadata_res: DenomMetadataResponse = deps.querier.query(&metadata_req)?;
    let display = metadata_res.metadata.display.unwrap();
    let mut decimals: u8 = 0;
    for u in metadata_res.metadata.denom_units {
        if display == u.denom {
            decimals = u.exponent.unwrap_or(0);
            break;
        }
    }
    let multiplier = 10u128.pow((max(decimals, 8u8) - 8u8) as u32);

    // chop off dust
    let wormhole_amount = Uint128::new(
        amount
            .u128()
            .checked_sub(amount.u128().checked_rem(multiplier).unwrap())
            .unwrap() / multiplier,
    );

    let wormhole_fee = Uint128::new(
        fee.u128()
            .checked_sub(fee.u128().checked_rem(multiplier).unwrap())
            .unwrap() / multiplier,
    );

    send_native(deps.storage, &asset_address, wormhole_amount)?;

    let token_bridge_message: TokenBridgeMessage = match transfer_type {
        TransferType::WithoutPayload => {
            let transfer_info = TransferInfo {
                amount: (0, wormhole_amount.u128()),
                token_address: asset_address.clone(),
                token_chain: asset_chain,
                recipient,
                recipient_chain,
                fee: (0, wormhole_fee.u128()),
            };
            TokenBridgeMessage {
                action: Action::TRANSFER,
                payload: transfer_info.serialize(),
            }
        }
        TransferType::WithPayload { payload } => {
            let sender_address = deps.api.addr_canonicalize(&info.sender.to_string())?;
            let sender_address = extend_address_to_32_array(&sender_address);
            let transfer_info = TransferWithPayloadInfo {
                amount: (0, wormhole_amount.u128()),
                token_address: asset_address.clone(),
                token_chain: asset_chain,
                recipient,
                recipient_chain,
                sender_address,
                payload,
            };
            TokenBridgeMessage {
                action: Action::TRANSFER_WITH_PAYLOAD,
                payload: transfer_info.serialize(),
            }
        }
    };

    let sender = deps.api.addr_canonicalize(info.sender.as_str())?;
    messages.push(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: cfg.wormhole_contract,
        msg: to_binary(&WormholeExecuteMsg::PostMessage {
            message: Binary::from(token_bridge_message.serialize()),
            nonce,
        })?,
        funds: wormhole_fees,
    }));

    // emit Event
    let event = Event::new("initiate_transfer_native_token")
        .add_attribute("transfer.token_chain", asset_chain.to_string())
        .add_attribute("transfer.token", hex::encode(asset_address.serialize()))
        .add_attribute("transfer.denom", denom)
        .add_attribute(
            "transfer.sender",
            hex::encode(extend_address_to_32(&sender)),
        )
        .add_attribute("transfer.recipient_chain", recipient_chain.to_string())
        .add_attribute("transfer.recipient", hex::encode(recipient))
        .add_attribute("transfer.amount", amount.to_string())
        .add_attribute("transfer.nonce", nonce.to_string())
        .add_attribute("transfer.block_time", env.block.time.seconds().to_string());

    Ok(Response::new().add_messages(messages).add_event(event))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps<CustomQuery>, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::WrappedRegistry { chain, address } => {
            to_binary(&query_wrapped_registry(deps, chain, address.as_slice())?)
        }
        QueryMsg::TransferInfo { vaa } => to_binary(&query_transfer_info(deps, env, &vaa)?),
        QueryMsg::ExternalId { external_id } => to_binary(&query_external_id(deps, external_id)?),
        QueryMsg::DenomWrappedAssetInfo { denom } => to_binary(&query_denom_asset_info(deps, denom)?),
    }
}

fn query_denom_asset_info(deps: Deps<CustomQuery>, denom: String) -> StdResult<DenomWrappedAssetInfoResponse> {
    // Query asset chain
    match denom_wrapped_asset_chain_id_read(deps.storage).load(denom.as_bytes()) {
        Ok(asset_chain) => {
            // Query asset address
            let asset_address = denom_wrapped_asset_address_read(deps.storage).load(denom.as_bytes())?;
            Ok(DenomWrappedAssetInfoResponse {
                found: 1,
                is_wrapped: 1,
                asset_chain,
                asset_address: Binary::from(asset_address)
            })
        },
        Err(_) => {
            // If it is not a wrapped asset, query denom metadata
            let metadata_req = CustomQuery::Bank(BankQuery::DenomMetadata { denom: denom.clone() }).into();
            if let Ok(_) = deps.querier.query::<DenomMetadataResponse>(&metadata_req) {
                Ok(DenomWrappedAssetInfoResponse {
                    found: 1,
                    is_wrapped: 0,
                    asset_chain: CHAIN_ID,
                    asset_address: Binary::from(ExternalTokenId::from_bank_token(&denom)?.serialize())
                })
            } else {
                // asset not found
                Ok(DenomWrappedAssetInfoResponse {
                    found: 0,
                    is_wrapped: 0,
                    asset_chain: CHAIN_ID,
                    asset_address: Binary::default()
                })
            }
        }
    }
}

fn query_external_id(deps: Deps<CustomQuery>, external_id: Binary) -> StdResult<ExternalIdResponse> {
    let external_id = ExternalTokenId::deserialize(external_id.to_array()?);
    Ok(ExternalIdResponse {
        token_id: external_id.to_token_id(deps.storage, CHAIN_ID)?,
    })
}

pub fn query_wrapped_registry(
    deps: Deps<CustomQuery>,
    chain: u16,
    address: &[u8],
) -> StdResult<WrappedRegistryResponse> {
    // Check if this asset is already deployed
    match wrapped_asset_denom_read(deps.storage, chain).load(address) {
        Ok(wrapped_denom) => Ok(WrappedRegistryResponse {
            denom: wrapped_denom,
        }),
        Err(_) => ContractError::AssetNotFound.std_err(),
    }
}

fn query_transfer_info(deps: Deps<CustomQuery>, env: Env, vaa: &Binary) -> StdResult<TransferInfoResponse> {
    let cfg = config_read(deps.storage).load()?;

    let parsed = parse_vaa(deps, env.block.time.seconds(), vaa)?;
    let data = parsed.payload;

    // check if vaa is from governance
    if is_governance_emitter(&cfg, parsed.emitter_chain, &parsed.emitter_address) {
        return ContractError::InvalidVAAAction.std_err();
    }

    let message = TokenBridgeMessage::deserialize(&data)?;
    match message.action {
        Action::ATTEST_META => ContractError::InvalidVAAAction.std_err(),
        Action::TRANSFER => {
            let core = TransferInfo::deserialize(&message.payload)?;

            Ok(TransferInfoResponse {
                amount: core.amount.1.into(),
                token_address: core.token_address.serialize(),
                token_chain: core.token_chain,
                recipient: core.recipient,
                recipient_chain: core.recipient_chain,
                fee: core.fee.1.into(),
                payload: vec![],
            })
        }
        Action::TRANSFER_WITH_PAYLOAD => {
            let info = TransferWithPayloadInfo::deserialize(&message.payload)?;
            let core = info.as_transfer_info();

            Ok(TransferInfoResponse {
                amount: core.amount.1.into(),
                token_address: core.token_address.serialize(),
                token_chain: core.token_chain,
                recipient: core.recipient,
                recipient_chain: core.recipient_chain,
                fee: core.fee.1.into(),
                payload: info.payload,
            })
        }
        other => Err(StdError::generic_err(format!("Invalid action: {}", other))),
    }
}

fn is_governance_emitter(cfg: &ConfigInfo, emitter_chain: u16, emitter_address: &[u8]) -> bool {
    cfg.gov_chain == emitter_chain && cfg.gov_address == emitter_address
}
