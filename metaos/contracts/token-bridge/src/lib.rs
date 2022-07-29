#[cfg(test)]
extern crate lazy_static;

pub mod contract;
pub mod msg;
pub mod state;
pub mod token_address;
pub mod asset;

#[cfg(test)]
mod testing;

// Chain ID of MetaOS
pub const CHAIN_ID: u16 = 20001;
