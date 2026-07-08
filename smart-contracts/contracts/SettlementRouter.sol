// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerchantRegistry} from "./MerchantRegistry.sol";

/// @title SettlementRouter
/// @notice Routes a merchant payment to the legally-correct settlement rail for that
///         merchant + transaction purpose: the foreign payment token (USDC) where the
///         registry permits it, otherwise the Dirham Payment Token (AED-PT).
/// @dev Interface matches ARCHITECTURE.md §2.2. Rail selection is derived SOLELY from
///      MerchantRegistry.isForeignTokenPermitted(merchant, purpose) — the registry is the
///      only source of truth. `purpose` is an input to that check, never a client-supplied
///      authorization boolean. Unregistered/inactive merchants are rejected with named errors.
contract SettlementRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The merchant registry consulted for zone/active/eligibility.
    MerchantRegistry public immutable registry;

    /// @notice USDC — the foreign payment token rail (Circle sandbox on Amoy).
    IERC20 public immutable usdc;

    /// @notice AED-PT — the Dirham payment token rail (simulated; MockAEDPT).
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

    /// @notice Settle a payment of `amount` from `payer` to `merchant` on the compliant rail.
    /// @dev Consults the registry to (1) reject unknown/inactive merchants and (2) pick the
    ///      rail. If a foreign token is permitted -> USDC; otherwise -> AED-PT. `payer` must
    ///      have approved this contract for `amount` of the selected rail token.
    /// @param merchant The registered, active merchant receiving settlement.
    /// @param payer    The address funding the payment (allowance on the selected rail token).
    /// @param amount   The settlement amount in the selected token's smallest unit.
    /// @param purpose  Transaction purpose feeding the compliance check.
    function settle(address merchant, address payer, uint256 amount, MerchantRegistry.Purpose purpose)
        external
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        if (payer == address(0)) revert ZeroAddress();

        MerchantRegistry.Zone zone = registry.getZone(merchant);
        if (zone == MerchantRegistry.Zone.Unregistered) revert MerchantNotRegistered(merchant);
        if (!registry.isActive(merchant)) revert MerchantInactive(merchant);

        // The registry is the sole source of truth for rail eligibility.
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
