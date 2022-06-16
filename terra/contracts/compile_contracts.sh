# cw20-wrapped.wasm
echo "compiling cw20-wrapped.wasm"
cd ./cw20-wrapped
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/cw20_wrapped.wasm" ]; then
  rm ../../artifacts/cw20_wrapped.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/cw20_wrapped.wasm ../../artifacts
echo "finish cw20-wrapped.wasm"

# wormhole.wasm
echo "compiling wormhole.wasm"
cd ../wormhole
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/wormhole.wasm" ]; then
  rm ../../artifacts/wormhole.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/wormhole.wasm ../../artifacts
echo "finish wormhole.wasm"

# token_bridge_terra.wasm
echo "compiling token_bridge_terra.wasm"
cd ../token-bridge
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/token_bridge_terra.wasm" ]; then
  rm ../../artifacts/token_bridge_terra.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/token_bridge_terra.wasm ../../artifacts
echo "finish token_bridge_terra.wasm"

# nft_bridge.wasm
echo "compiling nft_bridge.wasm"
cd ../nft-bridge
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/nft_bridge.wasm" ]; then
  rm ../../artifacts/nft_bridge.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/nft_bridge.wasm ../../artifacts
echo "finish nft_bridge.wasm"

# cw721_wrapped.wasm
echo "compiling cw721_wrapped.wasm"
cd ../cw721-wrapped
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/cw721_wrapped.wasm" ]; then
  rm ../../artifacts/cw721_wrapped.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/cw721_wrapped.wasm ../../artifacts
echo "finish cw721_wrapped.wasm"

# cw721_base.wasm
echo "compiling cw721_base.wasm"
cd ../cw721-base
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/cw721_base.wasm" ]; then
  rm ../../artifacts/cw721_base.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/cw721_base.wasm ../../artifacts
echo "finish cw721_base.wasm"

# mock_bridge_integration.wasm
echo "compiling mock_bridge_integration.wasm"
cd ../mock-bridge-integration
RUSTFLAGS='-C link-arg=-s' cargo wasm
if [ -f "../../artifacts/mock_bridge_integration.wasm" ]; then
  rm ../../artifacts/mock_bridge_integration.wasm
fi
mv ../../target/wasm32-unknown-unknown/release/mock_bridge_integration.wasm ../../artifacts
echo "finish mock_bridge_integration.wasm"