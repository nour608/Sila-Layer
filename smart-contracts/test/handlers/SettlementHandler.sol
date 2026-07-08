// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MerchantRegistry} from "../../contracts/MerchantRegistry.sol";
import {SettlementRouter} from "../../contracts/SettlementRouter.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// @notice Invariant handler: drives MerchantRegistry + SettlementRouter through randomized
///         admin actions and settlements. After each SUCCESSFUL settlement it determines the
///         rail that actually moved funds (by balance delta) and cross-checks it against the
///         registry's decision, latching a permanent flag if any §2.2 property is ever broken.
/// @dev Actors are drawn from a small bounded set so the fuzzer collides on the same merchants
///      across zone changes / active-toggles, actually exercising the routing logic.
contract SettlementHandler is Test {
    MerchantRegistry public immutable registry;
    SettlementRouter public immutable router;
    MockERC20 public immutable usdc;
    MockERC20 public immutable aedpt;
    address public immutable owner;

    address[] public merchants;
    address[] public payers;

    // --- ghost counters / latched violation flags (asserted by the invariant contract) ---
    uint256 public settleCount;
    bool public sawUnregisteredSuccess; // invariant 3
    bool public sawWrongRail; // invariants 1 & 2
    bool public sawDisallowedForeignRail; // invariant 1 (specifically: got USDC when not permitted)

    constructor(
        MerchantRegistry registry_,
        SettlementRouter router_,
        MockERC20 usdc_,
        MockERC20 aedpt_,
        address owner_
    ) {
        registry = registry_;
        router = router_;
        usdc = usdc_;
        aedpt = aedpt_;
        owner = owner_;

        for (uint256 i = 0; i < 4; i++) {
            merchants.push(makeAddr(string.concat("merchant", vm.toString(i))));
        }
        for (uint256 i = 0; i < 3; i++) {
            address p = makeAddr(string.concat("payer", vm.toString(i)));
            payers.push(p);
            usdc.mint(p, type(uint128).max);
            aedpt.mint(p, type(uint128).max);
            vm.startPrank(p);
            usdc.approve(address(router), type(uint256).max);
            aedpt.approve(address(router), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _merchant(uint256 seed) internal view returns (address) {
        return merchants[seed % merchants.length];
    }

    function _payer(uint256 seed) internal view returns (address) {
        return payers[seed % payers.length];
    }

    function _purpose(uint256 seed) internal pure returns (MerchantRegistry.Purpose) {
        return MerchantRegistry.Purpose(seed % 3);
    }

    /// @notice Owner registers a merchant with a (non-Unregistered) zone.
    function register(uint256 merchantSeed, uint256 zoneSeed) external {
        address m = _merchant(merchantSeed);
        MerchantRegistry.Zone zone = MerchantRegistry.Zone((zoneSeed % 2) + 1); // Mainland or DIFC
        vm.prank(owner);
        registry.registerMerchant(m, zone, "fuzz");
    }

    /// @notice Owner toggles a merchant's active flag.
    function setActive(uint256 merchantSeed, bool active) external {
        vm.prank(owner);
        registry.setActive(_merchant(merchantSeed), active);
    }

    /// @notice Attempt a settlement; on success, verify the rail against the registry decision.
    function settle(uint256 merchantSeed, uint256 payerSeed, uint256 purposeSeed, uint256 amount) external {
        address m = _merchant(merchantSeed);
        address p = _payer(payerSeed);
        MerchantRegistry.Purpose purpose = _purpose(purposeSeed);
        amount = bound(amount, 1, 1_000_000e6);

        // Registry decision captured at call time.
        MerchantRegistry.Zone zoneAtCall = registry.getZone(m);
        bool permittedAtCall = registry.isForeignTokenPermitted(m, purpose);

        uint256 usdcBefore = usdc.balanceOf(m);
        uint256 aedptBefore = aedpt.balanceOf(m);

        vm.prank(p);
        try router.settle(m, p, amount, purpose) {
            settleCount++;

            bool usdcMoved = usdc.balanceOf(m) > usdcBefore;
            bool aedptMoved = aedpt.balanceOf(m) > aedptBefore;

            // Invariant 3: a settlement must never succeed for an Unregistered merchant.
            if (zoneAtCall == MerchantRegistry.Zone.Unregistered) {
                sawUnregisteredSuccess = true;
            }

            // Invariants 1 & 2: the rail that actually moved must equal the registry's decision.
            if (permittedAtCall) {
                // Foreign token permitted -> must be USDC, never AED-PT.
                if (!usdcMoved || aedptMoved) sawWrongRail = true;
            } else {
                // Foreign token NOT permitted -> must be AED-PT, never USDC.
                if (!aedptMoved || usdcMoved) sawWrongRail = true;
                if (usdcMoved) sawDisallowedForeignRail = true;
            }
        } catch {
            // Expected for unregistered/inactive/zero-amount — nothing recorded.
        }
    }
}
