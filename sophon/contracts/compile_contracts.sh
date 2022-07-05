#echo "compiling cw20_wrapped_native_bound.wasm"
#cd ./cw20-wrapped-native-bound
#RUSTFLAGS='-C link-arg=-s' cargo wasm
#if [ -f "../../artifacts/cw20_wrapped_native_bound.wasm" ]; then
#  rm ../../artifacts/cw20_wrapped_native_bound.wasm
#fi
#mv ../../target/wasm32-unknown-unknown/release/cw20_wrapped_native_bound.wasm ../../artifacts
#echo "finish cw20_wrapped_native_bound.wasm"

echo "compiling wormhole.wasm"
cd ./wormhole
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