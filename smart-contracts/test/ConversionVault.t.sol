// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConversionVault} from "../contracts/ConversionVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Unit + fuzz tests for ConversionVault.
///         Focus: decimal-boundary correctness, non-round amounts, revert on
///         insufficient liquidity, rate-only-owner enforcement.
contract ConversionVaultTest is Test {
    ConversionVault internal vault;
    MockERC20 internal usdc; // 6 decimals
    MockERC20 internal aedpt; // 2 decimals

    address internal owner = makeAddr("owner");
    address internal seeder = makeAddr("seeder");
    address internal swapper = makeAddr("swapper");
    address internal badActor = makeAddr("badActor");

    // Rate: 1 USDC (1_000_000 raw) → 367 raw AEDPT (3.67 AED at 2dp)
    // rate = 367 × 1e18 / 1_000_000 = 367_000_000_000_000
    uint256 internal constant RATE_USDC_TO_AEDPT = 367_000_000_000_000; // 3.67e14

    // Rate: 1 AEDPT (100 raw) → 272_300 raw USDC (0.272300 USDC at 6dp)  [inverse approx]
    // rate = 272_300 × 1e18 / 100 = 2_723_000_000_000_000_000_000  (2.723e21)
    uint256 internal constant RATE_AEDPT_TO_USDC =
        2_723_000_000_000_000_000_000;

    // Seed amounts
    uint256 internal constant AEDPT_SEED = 100_000e2; // 100,000.00 AED
    uint256 internal constant USDC_SEED = 100_000e6; // 100,000.00 USDC

    function setUp() public {
        vm.prank(owner);
        vault = new ConversionVault(owner);

        usdc = new MockERC20("USD Coin (test)", "USDC", 6);
        aedpt = new MockERC20("AED Payment Token (test)", "sAEDPT", 2);

        // Set rates
        vm.startPrank(owner);
        vault.setRate(address(usdc), address(aedpt), RATE_USDC_TO_AEDPT);
        vault.setRate(address(aedpt), address(usdc), RATE_AEDPT_TO_USDC);
        vm.stopPrank();

        // Seed liquidity (owner mints to itself then calls seedLiquidity)
        usdc.mint(owner, USDC_SEED);
        aedpt.mint(owner, AEDPT_SEED);
        vm.startPrank(owner);
        usdc.approve(address(vault), USDC_SEED);
        aedpt.approve(address(vault), AEDPT_SEED);
        vault.seedLiquidity(address(usdc), USDC_SEED);
        vault.seedLiquidity(address(aedpt), AEDPT_SEED);
        vm.stopPrank();

        // Give swapper USDC and set approval
        usdc.mint(swapper, USDC_SEED);
        aedpt.mint(swapper, AEDPT_SEED);
        vm.startPrank(swapper);
        usdc.approve(address(vault), type(uint256).max);
        aedpt.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────────────
    // setRate — only owner
    // ─────────────────────────────────────────────────────────────────────

    function test_SetRate_OnlyOwner() public {
        vm.expectRevert();
        vm.prank(badActor);
        vault.setRate(address(usdc), address(aedpt), RATE_USDC_TO_AEDPT);
    }

    function test_SetRate_StoresCorrectly() public {
        assertEq(
            vault.rates(address(usdc), address(aedpt)),
            RATE_USDC_TO_AEDPT
        );
        assertEq(
            vault.rates(address(aedpt), address(usdc)),
            RATE_AEDPT_TO_USDC
        );
    }

    function test_SetRate_ZeroRateReverts() public {
        vm.expectRevert(ConversionVault.ZeroAmount.selector);
        vm.prank(owner);
        vault.setRate(address(usdc), address(aedpt), 0);
    }

    function test_SetRate_SameTokenReverts() public {
        vm.expectRevert(ConversionVault.SameToken.selector);
        vm.prank(owner);
        vault.setRate(address(usdc), address(usdc), RATE_USDC_TO_AEDPT);
    }

    // ─────────────────────────────────────────────────────────────────────
    // seedLiquidity
    // ─────────────────────────────────────────────────────────────────────

    function test_SeedLiquidity_OnlyOwner() public {
        usdc.mint(badActor, 1e6);
        vm.prank(badActor);
        usdc.approve(address(vault), 1e6);
        vm.expectRevert();
        vm.prank(badActor);
        vault.seedLiquidity(address(usdc), 1e6);
    }

    function test_SeedLiquidity_IncreasesVaultBalance() public {
        uint256 before = usdc.balanceOf(address(vault));
        usdc.mint(owner, 500e6);
        vm.startPrank(owner);
        usdc.approve(address(vault), 500e6);
        vault.seedLiquidity(address(usdc), 500e6);
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(vault)), before + 500e6);
    }

    // ─────────────────────────────────────────────────────────────────────
    // getAmountIn — quote correctness
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Round-number smoke test: 1 USDC → 367 raw AEDPT.
    function test_GetAmountIn_RoundNumber() public view {
        // To get 367 raw AEDPT out, how much USDC raw in?
        // amountIn = ceil(367 × 1e18 / 367_000_000_000_000)
        //          = ceil(367e18 / 3.67e14)
        //          = ceil(1_000_000)
        //          = 1_000_000  (exact — no rounding)
        uint256 amountIn = vault.getAmountIn(
            address(usdc),
            address(aedpt),
            367
        );
        assertEq(
            amountIn,
            1_000_000,
            "1 USDC should yield 3.67 AEDPT (367 raw)"
        );
    }

    /// @notice Non-round amount: 137 raw AEDPT (1.37 AED).
    ///         This is the "ugly number" test — catches off-by-magnitude decimal bugs.
    function test_GetAmountIn_NonRound_137() public view {
        // amountIn = ceil(137 × 1e18 / 367_000_000_000_000)
        //          = ceil(137_000_000_000_000_000_000 / 367_000_000_000_000)
        //          = ceil(373_296.…)
        //          = 373_297 raw USDC (0.373297 USDC)
        uint256 amountIn = vault.getAmountIn(
            address(usdc),
            address(aedpt),
            137
        );
        assertEq(amountIn, 373_297, "1.37 AED should require ~0.373297 USDC");
    }

    /// @notice Non-round: 1349 raw AEDPT (13.49 AED).
    function test_GetAmountIn_NonRound_1349() public view {
        // amountIn = ceil(1349 × 1e18 / 367_000_000_000_000)
        //          = ceil(1349 × 10^18 / (367 × 10^12))
        //          = ceil(1349 × 10^6 / 367)         [simplify: 1e18/1e12 = 1e6]
        //          = ceil(1_349_000_000 / 367)
        //          = ceil(3_675_749.318…)
        //          = 3_675_750 raw USDC (3.675750 USDC)
        // Verify: 3_675_750 × 367 / 1_000_000 = 1_349_000_250 / 1_000_000 = 1349 (floor) ✓
        uint256 amountIn = vault.getAmountIn(
            address(usdc),
            address(aedpt),
            1349
        );
        assertEq(amountIn, 3_675_750);
    }

    /// @notice Non-round: 50001 raw AEDPT (500.01 AED) — check ceiling vs floor matters.
    function test_GetAmountIn_NonRound_50001() public view {
        // amountIn = ceil(50001 × 1e18 / 367_000_000_000_000)
        //          = ceil(50_001_000_000_000_000_000_000 / 367_000_000_000_000)
        //          = ceil(136_244_959.…)
        //          = 136_244_960 raw USDC
        uint256 amountIn = vault.getAmountIn(
            address(usdc),
            address(aedpt),
            50001
        );
        // Sanity-check: 136_244_960 × rate / 1e18 should yield ≥ 50001
        uint256 amountOut = (amountIn * RATE_USDC_TO_AEDPT) /
            vault.RATE_PRECISION();
        assertGe(
            amountOut,
            50001,
            "swap with quoted amountIn must yield at least the requested output"
        );
    }

    /// @notice The quote must always be consistent with swap(): getAmountIn then swap
    ///         must always deliver AT LEAST the requested amountOut.
    function testFuzz_QuoteConsistentWithSwap(uint256 aedptDesired) public {
        // Bound to available liquidity: vault has AEDPT_SEED raw AEDPT
        aedptDesired = bound(aedptDesired, 1, AEDPT_SEED);

        uint256 usdcIn = vault.getAmountIn(
            address(usdc),
            address(aedpt),
            aedptDesired
        );

        // Make sure swapper has enough USDC
        if (usdcIn > usdc.balanceOf(swapper)) {
            usdc.mint(swapper, usdcIn - usdc.balanceOf(swapper));
        }

        uint256 aedptBefore = aedpt.balanceOf(swapper);
        vm.prank(swapper);
        uint256 aedptOut = vault.swap(address(usdc), address(aedpt), usdcIn);

        assertGe(
            aedptOut,
            aedptDesired,
            "swap must yield at least the quoted amount"
        );
        assertEq(
            aedpt.balanceOf(swapper) - aedptBefore,
            aedptOut,
            "balance delta must equal swap return value"
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // swap — correctness
    // ─────────────────────────────────────────────────────────────────────

    function test_Swap_UsesFloorDivision() public {
        // 1_000_001 raw USDC: floor(1_000_001 × 367e14 / 1e18) = floor(367.000367) = 367 raw AEDPT
        uint256 aedptOut = _swapUsdc(1_000_001);
        assertEq(
            aedptOut,
            367,
            "floor: extra dust unit of USDC should not change AEDPT output"
        );
    }

    function test_Swap_CorrectBalance_RoundNumber() public {
        uint256 before = aedpt.balanceOf(swapper);
        _swapUsdc(1_000_000);
        assertEq(
            aedpt.balanceOf(swapper) - before,
            367,
            "1 USDC  3.67 AED (367 raw)"
        );
    }

    function test_Swap_NonRound_137RawAedpt() public {
        // Quote first, then swap to get exactly 137 raw AEDPT
        uint256 usdcIn = vault.getAmountIn(address(usdc), address(aedpt), 137);
        uint256 aedptBefore = aedpt.balanceOf(swapper);
        uint256 aedptOut = _swapUsdc(usdcIn);
        assertGe(aedptOut, 137, "must yield at least 137 raw AEDPT");
        assertEq(aedpt.balanceOf(swapper) - aedptBefore, aedptOut);
    }

    function test_Swap_NonRound_1349RawAedpt() public {
        uint256 usdcIn = vault.getAmountIn(address(usdc), address(aedpt), 1349);
        uint256 aedptOut = _swapUsdc(usdcIn);
        assertGe(aedptOut, 1349);
    }

    function test_Swap_NonRound_50001RawAedpt() public {
        uint256 usdcIn = vault.getAmountIn(
            address(usdc),
            address(aedpt),
            50001
        );
        usdc.mint(swapper, usdcIn); // ensure swapper has enough
        vm.prank(swapper);
        usdc.approve(address(vault), usdcIn + 1e6);
        uint256 aedptOut = _swapUsdc(usdcIn);
        assertGe(aedptOut, 50001);
    }

    function test_Swap_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit ConversionVault.Swapped(
            address(usdc),
            address(aedpt),
            1_000_000,
            367
        );
        _swapUsdc(1_000_000);
    }

    function test_Swap_ZeroAmountReverts() public {
        vm.expectRevert(ConversionVault.ZeroAmount.selector);
        vm.prank(swapper);
        vault.swap(address(usdc), address(aedpt), 0);
    }

    function test_Swap_SameTokenReverts() public {
        vm.expectRevert(ConversionVault.SameToken.selector);
        vm.prank(swapper);
        vault.swap(address(usdc), address(usdc), 1e6);
    }

    function test_Swap_UnsetRateReverts() public {
        MockERC20 unknown = new MockERC20("X", "X", 18);
        vm.expectRevert(
            abi.encodeWithSelector(
                ConversionVault.RateNotSet.selector,
                address(unknown),
                address(aedpt)
            )
        );
        vm.prank(swapper);
        vault.swap(address(unknown), address(aedpt), 1e18);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Insufficient liquidity — must revert, never partial payout
    // ─────────────────────────────────────────────────────────────────────

    function test_Swap_InsufficientLiquidity_Reverts() public {
        // Drain the vault's AEDPT by sending it away as owner (simulate empty vault)
        vm.prank(address(vault));
        // Can't send directly. Instead: deploy a fresh vault with no seed, try to swap.
        ConversionVault emptyVault = new ConversionVault(owner);
        vm.prank(owner);
        emptyVault.setRate(address(usdc), address(aedpt), RATE_USDC_TO_AEDPT);
        // No seedLiquidity call — vault has 0 AEDPT

        usdc.mint(swapper, 1_000_000);
        vm.startPrank(swapper);
        usdc.approve(address(emptyVault), 1_000_000);
        vm.expectRevert(
            abi.encodeWithSelector(
                ConversionVault.InsufficientVaultLiquidity.selector,
                address(aedpt),
                367, // amountOut
                0 // available
            )
        );
        emptyVault.swap(address(usdc), address(aedpt), 1_000_000);
        vm.stopPrank();
    }

    function test_Swap_InsufficientLiquidity_PayerAllowanceNotConsumed()
        public
    {
        // Deploy empty vault
        ConversionVault emptyVault = new ConversionVault(owner);
        vm.prank(owner);
        emptyVault.setRate(address(usdc), address(aedpt), RATE_USDC_TO_AEDPT);

        usdc.mint(swapper, 1_000_000);
        vm.startPrank(swapper);
        usdc.approve(address(emptyVault), 1_000_000);
        uint256 allowanceBefore = usdc.allowance(swapper, address(emptyVault));

        try
            emptyVault.swap(address(usdc), address(aedpt), 1_000_000)
        {} catch {}

        // Allowance must NOT have been consumed (swap reverted before transferFrom)
        assertEq(
            usdc.allowance(swapper, address(emptyVault)),
            allowanceBefore,
            "payer allowance must not be consumed on a failed swap"
        );
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Fuzz — non-round amounts, rate consistency, balance never negative
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Fuzz: for any amountIn of USDC, the vault's AEDPT balance never goes below zero.
    function testFuzz_VaultBalanceNeverNegative(uint256 amountIn) public {
        amountIn = bound(amountIn, 1, USDC_SEED);
        usdc.mint(swapper, amountIn);

        uint256 vaultAedptBefore = aedpt.balanceOf(address(vault));

        vm.prank(swapper);
        try vault.swap(address(usdc), address(aedpt), amountIn) returns (
            uint256 amountOut
        ) {
            uint256 vaultAedptAfter = aedpt.balanceOf(address(vault));
            assertLe(
                amountOut,
                vaultAedptBefore,
                "vault cannot pay more than it had"
            );
            assertEq(
                vaultAedptBefore - vaultAedptAfter,
                amountOut,
                "vault balance delta must equal amountOut"
            );
        } catch {
            // Insufficient liquidity revert is valid; vault balance must be unchanged.
            assertEq(
                aedpt.balanceOf(address(vault)),
                vaultAedptBefore,
                "failed swap must not change vault balance"
            );
        }
    }

    /// @notice Fuzz: swap output is always consistent with the rate set at call time.
    ///         Invariant: amountOut == floor(amountIn × rate / RATE_PRECISION)
    function testFuzz_SwapOutputConsistentWithRate(uint256 amountIn) public {
        amountIn = bound(amountIn, 1, USDC_SEED);
        usdc.mint(swapper, amountIn);

        uint256 rate = vault.rates(address(usdc), address(aedpt));
        uint256 expectedOut = (amountIn * rate) / vault.RATE_PRECISION();

        if (expectedOut == 0) return; // dust below rate precision — swap reverts ZeroAmount
        if (expectedOut > aedpt.balanceOf(address(vault))) return; // insufficient liquidity

        uint256 aedptBefore = aedpt.balanceOf(swapper);
        vm.prank(swapper);
        uint256 actualOut = vault.swap(address(usdc), address(aedpt), amountIn);

        assertEq(
            actualOut,
            expectedOut,
            "swap amountOut must equal floor(amountIn * rate / RATE_PRECISION)"
        );
        assertEq(
            aedpt.balanceOf(swapper) - aedptBefore,
            actualOut,
            "Swapped.amountOut must match actual balance delta"
        );
    }

    /// @notice Fuzz: getAmountIn ceiling guarantee — for any non-round amountOut,
    ///         the quoted amountIn, when swapped, always yields >= amountOut.
    ///         This specifically exercises non-round amounts to catch decimal bugs.
    function testFuzz_GetAmountIn_CeilingHolds_NonRound(
        uint256 aedptOut
    ) public {
        aedptOut = bound(aedptOut, 1, AEDPT_SEED / 2); // leave room in vault

        uint256 usdcIn = vault.getAmountIn(
            address(usdc),
            address(aedpt),
            aedptOut
        );

        // Ensure swapper has enough USDC
        if (usdcIn > usdc.balanceOf(swapper)) {
            usdc.mint(swapper, usdcIn);
        }

        vm.prank(swapper);
        uint256 actualOut = vault.swap(address(usdc), address(aedpt), usdcIn);

        assertGe(
            actualOut,
            aedptOut,
            "swap with ceiling-quoted amountIn must yield at least the desired amountOut"
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    function _swapUsdc(uint256 usdcIn) internal returns (uint256) {
        vm.prank(swapper);
        return vault.swap(address(usdc), address(aedpt), usdcIn);
    }
}
