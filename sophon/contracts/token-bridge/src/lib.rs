#[cfg(test)]
extern crate lazy_static;

pub mod contract;
pub mod msg;
pub mod state;
pub mod token_address;

#[cfg(test)]
mod testing;

// Chain ID of Sophon
pub const CHAIN_ID: u16 = 20001;
