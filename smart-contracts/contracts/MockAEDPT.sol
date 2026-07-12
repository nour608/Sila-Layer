// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockAEDPT
/// @notice Simulated AED payment token used for demo settlement flows.
contract MockAEDPT is ERC20, Ownable {
    constructor(address initialOwner) ERC20("AED Payment Token (Simulated)", "sAEDPT") Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) {
        return 2;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
