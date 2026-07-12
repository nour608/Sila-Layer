## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Smart contract design notes

### ConversionVault

The contract uses a fixed-point exchange-rate model with $RATE\_PRECISION = 10^{18}$.
Rates are stored as scaled values such that:

$$
rate = \frac{amountOut\_raw \times RATE\_PRECISION}{amountIn\_raw}
$$

For the demo flow, AED-PT uses 2 decimal places and USDC uses 6 decimal places. That means the rate must encode the decimal re-scaling between the two tokens rather than only the economic ratio.

The router must quote an exact input amount before calling the swap. Because the vault uses a ceiling-rounded quote for the input side and a floor-rounded output side, the payer may over-supply by at most one raw unit of the input token while the vault never pays out more than it holds.

The quoting formula is:

$$
amountIn\_raw = \left\lceil \frac{amountOut\_raw \times RATE\_PRECISION}{rate} \right\rceil
$$

Operationally, the vault is a demo-only seeded liquidity pool, not a DEX or market maker. Rates are owner-configurable and not oracle-sourced, liquidity is finite, and the contract reverts on insufficient liquidity rather than paying a partial amount.

### MerchantRegistry

The registry is the source of truth for merchant compliance data. It stores each merchant's regulatory zone, active status, and label, and it determines whether a foreign payment token is permitted for a given merchant and transaction purpose. The rules are intentionally simple for the demo and are used by the settlement router to select the correct rail.

### MerchantRegistryReceiver

This receiver is the CRE adapter for KYB results. It receives authenticated reports from the forwarder, decodes the merchant registration payload, and writes the merchant into the registry. It does not implement compliance logic itself; it only forwards already-verified data.

### MockAEDPT

MockAEDPT is a simulated AED-pegged token used for demo settlement flows. It exposes 2 decimals to match the minor-unit behavior of AED and provides a mint function for demo funding.

### SettlementReceiver

This receiver is the CRE adapter for settlement instructions. It decodes the forwarded checkout payload, validates the purpose enum value, and calls the settlement router with the decoded parameters.

### SettlementRouter

The router is the settlement entry point for compliant payments. It checks merchant registration and active status, asks the registry whether a foreign token is permitted, and then transfers the payment using the selected rail token (USDC or AED-PT).

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
