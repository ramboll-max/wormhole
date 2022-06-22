echo "compiling cw20-wrapped.wasm"
cd ./cw20-wrapped
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/cw20_wrapped.wasm" ]; then
  rm ../../artifacts/cw20_wrapped.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/cw20_wrapped.wasm ../../artifacts
echo "finish cw20-wrapped.wasm"

echo "compiling wormhole.wasm"
cd ../wormhole
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/wormhole.wasm" ]; then
  rm ../../artifacts/wormhole.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/wormhole.wasm ../../artifacts
echo "finish wormhole.wasm"

echo "compiling token_bridge_sophon.wasm"
cd ../token-bridge
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/token_bridge_sophon.wasm" ]; then
  rm ../../artifacts/token_bridge_sophon.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/token_bridge_sophon.wasm ../../artifacts
echo "finish token_bridge_sophon.wasm"