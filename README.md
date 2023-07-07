# Interact with Substrate Network with Ethereum Wallet

This a POC project which shown how we can interact with Substrate with Ethereum Wallet (via Viem & wamgi). Tested with MetaMask.

## Pre-requirements

You can compile the parachain node here: https://github.com/jasl/account-mapping-research/

```bash
cargo build --release
target/release/node-template --dev --rpc-port=19944 --rpc-external --rpc-methods=Unsafe
```

For this project:

```bash
yarn && yarn dev
```
