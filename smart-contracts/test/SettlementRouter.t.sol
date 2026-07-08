// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MerchantRegistry} from "../contracts/MerchantRegistry.sol";
import {SettlementRouter} from "../contracts/SettlementRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Slice 2 unit tests: full dual-rail routing, registry-gated, event correctness.
///         Property-based coverage lives in SettlementRouter.invariant.t.sol (the §2.2 gate).
contract SettlementRouterTest is Test {
    MerchantRegistry internal registry;
    SettlementRouter internal router;
    MockERC20 internal usdc;
    MockERC20 internal aedpt;

    address internal owner = makeAddr("owner");
    address internal difcMerchant = makeAddr("difcMerchant");
    address internal mainlandMerchant = makeAddr("mainlandMerchant");
    address internal payer = makeAddr("payer");

    function setUp() public {
        vm.prank(owner);
        registry = new MerchantRegistry(owner);

        usdc = new MockERC20("USD Coin (test)", "USDC", 6);
        aedpt = new MockERC20("AED-PT (test)", "sAEDPT", 2);
        router = new SettlementRouter(registry, IERC20(address(usdc)), IERC20(address(aedpt)));

        vm.startPrank(owner);
        registry.registerMerchant(difcMerchant, MerchantRegistry.Zone.DIFC, "DIFC Store");
        registry.registerMerchant(mainlandMerchant, MerchantRegistry.Zone.Mainland, "Mainland Cafe");
        vm.stopPrank();

        usdc.mint(payer, 1_000e6);
        aedpt.mint(payer, 1_000e2);
        vm.startPrank(payer);
        usdc.approve(address(router), type(uint256).max);
        aedpt.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    // --- Rail routing (the whole point of Slice 2) ---

    function test_DifcMerchant_RetailGoods_UsesUsdc() public {
        vm.prank(payer);
        router.settle(difcMerchant, payer, 100e6, MerchantRegistry.Purpose.RetailGoods);
        assertEq(usdc.balanceOf(difcMerchant), 100e6);
        assertEq(aedpt.balanceOf(difcMerchant), 0);
    }

    function test_MainlandMerchant_RetailGoods_UsesAedpt() public {
        vm.prank(payer);
        router.settle(mainlandMerchant, payer, 50e2, MerchantRegistry.Purpose.RetailGoods);
        assertEq(aedpt.balanceOf(mainlandMerchant), 50e2);
        assertEq(usdc.balanceOf(mainlandMerchant), 0);
    }

    function test_MainlandMerchant_VirtualAsset_UsesUsdc() public {
        vm.prank(payer);
        router.settle(mainlandMerchant, payer, 100e6, MerchantRegistry.Purpose.VirtualAssetRelated);
        assertEq(usdc.balanceOf(mainlandMerchant), 100e6);
        assertEq(aedpt.balanceOf(mainlandMerchant), 0);
    }

    function test_MainlandMerchant_CrossBorderB2B_UsesAedpt() public {
        vm.prank(payer);
        router.settle(mainlandMerchant, payer, 50e2, MerchantRegistry.Purpose.CrossBorderB2B);
        assertEq(aedpt.balanceOf(mainlandMerchant), 50e2);
    }

    function test_SettleEmitsUsdcRail() public {
        vm.expectEmit(true, false, false, true);
        emit SettlementRouter.Settled(
            difcMerchant,
            address(usdc),
            100e6,
            MerchantRegistry.Purpose.RetailGoods,
            "Foreign token permitted (DIFC, or Mainland + virtual-asset) -> USDC rail"
        );
        vm.prank(payer);
        router.settle(difcMerchant, payer, 100e6, MerchantRegistry.Purpose.RetailGoods);
    }

    function test_SettleEmitsAedptRail() public {
        vm.expectEmit(true, false, false, true);
        emit SettlementRouter.Settled(
            mainlandMerchant,
            address(aedpt),
            50e2,
            MerchantRegistry.Purpose.RetailGoods,
            "Foreign token not permitted (Mainland retail/B2B) -> AED-PT required"
        );
        vm.prank(payer);
        router.settle(mainlandMerchant, payer, 50e2, MerchantRegistry.Purpose.RetailGoods);
    }

    // --- Rejections (PRD FR4) ---

    function test_RevertWhen_MerchantUnregistered() public {
        address ghost = makeAddr("ghost");
        vm.expectRevert(abi.encodeWithSelector(SettlementRouter.MerchantNotRegistered.selector, ghost));
        vm.prank(payer);
        router.settle(ghost, payer, 100e6, MerchantRegistry.Purpose.RetailGoods);
    }

    function test_RevertWhen_MerchantInactive() public {
        vm.prank(owner);
        registry.setActive(difcMerchant, false);
        vm.expectRevert(abi.encodeWithSelector(SettlementRouter.MerchantInactive.selector, difcMerchant));
        vm.prank(payer);
        router.settle(difcMerchant, payer, 100e6, MerchantRegistry.Purpose.RetailGoods);
    }

    function test_RevertWhen_ZeroAmount() public {
        vm.expectRevert(SettlementRouter.ZeroAmount.selector);
        vm.prank(payer);
        router.settle(difcMerchant, payer, 0, MerchantRegistry.Purpose.RetailGoods);
    }

    function test_RevertWhen_PayerHasNoAllowance() public {
        address broke = makeAddr("broke");
        usdc.mint(broke, 100e6);
        vm.expectRevert();
        vm.prank(broke);
        router.settle(difcMerchant, broke, 100e6, MerchantRegistry.Purpose.RetailGoods);
    }
}
