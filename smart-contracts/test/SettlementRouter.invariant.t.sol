// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {MerchantRegistry} from "../contracts/MerchantRegistry.sol";
import {SettlementRouter} from "../contracts/SettlementRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {SettlementHandler} from "./handlers/SettlementHandler.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Invariant suite — the mandatory ARCHITECTURE.md §2.2 gate for SettlementRouter.
///         The handler drives randomized register/setActive/settle sequences; these invariants
///         assert that no reachable sequence ever violates the compliance-routing properties.
contract SettlementRouterInvariantTest is StdInvariant, Test {
    MerchantRegistry internal registry;
    SettlementRouter internal router;
    MockERC20 internal usdc;
    MockERC20 internal aedpt;
    SettlementHandler internal handler;

    address internal owner = makeAddr("owner");

    function setUp() public {
        vm.prank(owner);
        registry = new MerchantRegistry(owner);
        usdc = new MockERC20("USD Coin (test)", "USDC", 6);
        aedpt = new MockERC20("AED-PT (test)", "sAEDPT", 2);
        router = new SettlementRouter(registry, IERC20(address(usdc)), IERC20(address(aedpt)));

        handler = new SettlementHandler(registry, router, usdc, aedpt, owner);

        // Only the handler is a fuzz target; its selectors are the state transitions.
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = SettlementHandler.register.selector;
        selectors[1] = SettlementHandler.setActive.selector;
        selectors[2] = SettlementHandler.settle.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    /// Invariant 1: a merchant never receives funds on a rail its zone+purpose disallows
    /// (never USDC when the registry says foreign token is not permitted).
    function invariant_neverSettlesOnDisallowedRail() public view {
        assertFalse(handler.sawDisallowedForeignRail(), "merchant received USDC when foreign token not permitted");
    }

    /// Invariant 2: the rail that actually moved always matches isForeignTokenPermitted at call time.
    function invariant_railMatchesRegistryDecision() public view {
        assertFalse(handler.sawWrongRail(), "settled rail did not match registry decision");
    }

    /// Invariant 3: no settlement ever succeeds for an Unregistered merchant.
    function invariant_noSettlementForUnregistered() public view {
        assertFalse(handler.sawUnregisteredSuccess(), "settlement succeeded for unregistered merchant");
    }

    /// Anti-vacuity: prove the invariants above are not passing trivially by driving a
    /// deterministic register->settle and confirming the handler records a real success.
    /// (A per-sequence afterInvariant guard can't do this — the fuzzer legitimately explores
    /// register-only sequences with zero settlements.)
    function test_HandlerCanProduceSuccessfulSettlement() public {
        handler.register(0, 1); // merchant[0] -> DIFC (zoneSeed 1 -> Mainland, but any registered zone settles)
        handler.settle(0, 0, 0, 100e6);
        assertGt(handler.settleCount(), 0, "handler could not produce a successful settlement");
    }
}
