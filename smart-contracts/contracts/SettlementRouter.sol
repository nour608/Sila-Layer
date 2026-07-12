// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerchantRegistry} from "./MerchantRegistry.sol";

/// @title SettlementRouter
/// @notice Routes settlement payments to the compliant rail selected by the registry.
contract SettlementRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    MerchantRegistry public immutable registry;
    IERC20 public immutable usdc;
    IERC20 public immutable aedpt;

    event Settled(
        address indexed merchant, address rail, uint256 amount, MerchantRegistry.Purpose purpose, string reason
    );

    error MerchantNotRegistered(address merchant);
    error MerchantInactive(address merchant);
    error ZeroAmount();
    error ZeroAddress();

    constructor(MerchantRegistry registry_, IERC20 usdc_, IERC20 aedpt_) {
        if (address(registry_) == address(0) || address(usdc_) == address(0) || address(aedpt_) == address(0)) {
            revert ZeroAddress();
        }
        registry = registry_;
        usdc = usdc_;
        aedpt = aedpt_;
    }

    function settle(address merchant, address payer, uint256 amount, MerchantRegistry.Purpose purpose)
        external
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        if (payer == address(0)) revert ZeroAddress();

        MerchantRegistry.Zone zone = registry.getZone(merchant);
        if (zone == MerchantRegistry.Zone.Unregistered) revert MerchantNotRegistered(merchant);
        if (!registry.isActive(merchant)) revert MerchantInactive(merchant);

        bool foreignPermitted = registry.isForeignTokenPermitted(merchant, purpose);

        IERC20 rail;
        string memory reason;
        if (foreignPermitted) {
            rail = usdc;
            reason = "Foreign token permitted (DIFC, or Mainland + virtual-asset) -> USDC rail";
        } else {
            rail = aedpt;
            reason = "Foreign token not permitted (Mainland retail/B2B) -> AED-PT required";
        }

        rail.safeTransferFrom(payer, merchant, amount);

        emit Settled(merchant, address(rail), amount, purpose, reason);
    }
}
