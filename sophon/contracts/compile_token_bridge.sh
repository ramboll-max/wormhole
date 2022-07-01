echo "compiling token_bridge_sophon.wasm"
cd ./token-bridge
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/token_bridge_sophon.wasm" ]; then
  rm ../../artifacts/token_bridge_sophon.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/token_bridge_sophon.wasm ../../artifacts
echo "finish token_bridge_sophon.wasm"