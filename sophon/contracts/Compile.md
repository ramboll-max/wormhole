## Compiling contracts

- First, make sure `rustup` installed.
- Check target list use `rustup target list --installed`.
- If `wasm32-unknown-unknown` not found in list, install it with `rustup target add wasm32-unknown-unknown`.
- Run `./compile_contracts.sh` to compile the contracts.
- If success, wasm contract files will be found in `../artifacts` path.

### Contracts List

- cw20_wrapped.wasm
- wormhole.wasm
- token_bridge_sophon.wasm

