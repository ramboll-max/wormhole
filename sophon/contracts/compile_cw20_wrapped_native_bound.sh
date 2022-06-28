echo "compiling cw20_wrapped_native_bound.wasm"
cd ./cw20-wrapped-native-bound
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/cw20_wrapped_native_bound.wasm" ]; then
  rm ../../artifacts/cw20_wrapped_native_bound.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/cw20_wrapped_native_bound.wasm ../../artifacts
echo "finish cw20_wrapped_native_bound.wasm"