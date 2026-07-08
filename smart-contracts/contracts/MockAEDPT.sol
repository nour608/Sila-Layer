// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockAEDPT — Simulated AED Payment Token
/// @notice Stand-in for a CBUAE-licensed AED-pegged Dirham Payment Token (e.g. AE Coin).
///         No public AE Coin developer sandbox exists to integrate for real, so this is a
///         disclosed mock used for the mainland-retail settlement rail.
/// @dev The on-chain token NAME itself discloses the simulation (ARCHITECTURE.md §2.3), so
///      anyone inspecting it on a testnet explorer sees the disclosure, not just the writeup.
///      Owner-gated faucet mint is fine for funding demo accounts.
contract MockAEDPT is ERC20, Ownable {
    /// @param initialOwner Address permitted to mint (the demo admin).
    constructor(address initialOwner) ERC20("AED Payment Token (Simulated)", "sAEDPT") Ownable(initialOwner) {}

    /// @notice AED-PT mirrors fiat AED minor units (fils): 2 decimals.
    function decimals() public pure override returns (uint8) {
        return 2;
    }

    /// @notice Faucet-style mint for demo accounts. Owner-gated.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
