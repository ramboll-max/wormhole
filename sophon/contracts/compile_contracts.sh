echo "compiling cw20-wrapped.wasm"
cd ./cw20-wrapped
RUSTFLAGS='-C link-arg=-s' cargo wasm
rm ../../artifacts/cw20_wrapped.wasm
mv ../../target/wasm32-unknown-unknown/release/cw20_wrapped.wasm ../../artifacts
echo "finish cw20-wrapped.wasm"

echo "compiling wormhole.wasm"
cd ../wormhole
RUSTFLAGS='-C link-arg=-s' cargo wasm
rm ../../artifacts/wormhole.wasm
mv ../../target/wasm32-unknown-unknown/release/wormhole.wasm ../../artifacts
echo "finish wormhole.wasm"

echo "compiling token_bridge_sophon.wasm"
cd ../token-bridge
RUSTFLAGS='-C link-arg=-s' cargo wasm
rm ../../artifacts/token_bridge_sophon.wasm
mv ../../target/wasm32-unknown-unknown/release/token_bridge_sophon.wasm ../../artifacts
echo "finish token_bridge_sophon.wasm"