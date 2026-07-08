// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MerchantRegistry} from "../contracts/MerchantRegistry.sol";
import {SettlementRouter} from "../contracts/SettlementRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Stateless fuzz tests over settle(): for any amount / zone / purpose combination the
///         rail selected matches the registry, and disallowed combinations never touch USDC.
contract SettlementRouterFuzzTest is Test {
    MerchantRegistry internal registry;
    SettlementRouter internal router;
    MockERC20 internal usdc;
    MockERC20 internal aedpt;

    address internal owner = makeAddr("owner");
    address internal merchant = makeAddr("merchant");
    address internal payer = makeAddr("payer");

    function setUp() public {
        vm.prank(owner);
        registry = new MerchantRegistry(owner);
        usdc = new MockERC20("USD Coin (test)", "USDC", 6);
        aedpt = new MockERC20("AED-PT (test)", "sAEDPT", 2);
        router = new SettlementRouter(registry, IERC20(address(usdc)), IERC20(address(aedpt)));

        usdc.mint(payer, type(uint128).max);
        aedpt.mint(payer, type(uint128).max);
        vm.startPrank(payer);
        usdc.approve(address(router), type(uint256).max);
        aedpt.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function testFuzz_RailMatchesRegistry(uint8 zoneSeed, uint8 purposeSeed, uint256 amount) public {
        MerchantRegistry.Zone zone = MerchantRegistry.Zone((zoneSeed % 2) + 1); // Mainland | DIFC
        MerchantRegistry.Purpose purpose = MerchantRegistry.Purpose(purposeSeed % 3);
        amount = bound(amount, 1, 1_000_000e6);

        vm.prank(owner);
        registry.registerMerchant(merchant, zone, "fuzz");

        bool permitted = registry.isForeignTokenPermitted(merchant, purpose);
        uint256 usdcBefore = usdc.balanceOf(merchant);
        uint256 aedptBefore = aedpt.balanceOf(merchant);

        vm.prank(payer);
        router.settle(merchant, payer, amount, purpose);

        if (permitted) {
            assertEq(usdc.balanceOf(merchant) - usdcBefore, amount, "expected USDC rail");
            assertEq(aedpt.balanceOf(merchant), aedptBefore, "AED-PT must not move");
        } else {
            assertEq(aedpt.balanceOf(merchant) - aedptBefore, amount, "expected AED-PT rail");
            assertEq(usdc.balanceOf(merchant), usdcBefore, "USDC must not move");
        }
    }

    function testFuzz_UnregisteredAlwaysReverts(uint8 purposeSeed, uint256 amount) public {
        MerchantRegistry.Purpose purpose = MerchantRegistry.Purpose(purposeSeed % 3);
        amount = bound(amount, 1, 1_000_000e6);
        vm.expectRevert(abi.encodeWithSelector(SettlementRouter.MerchantNotRegistered.selector, merchant));
        vm.prank(payer);
        router.settle(merchant, payer, amount, purpose);
    }
}
