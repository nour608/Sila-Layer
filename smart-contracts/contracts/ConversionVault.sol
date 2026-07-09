// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ConversionVault
/// @notice Seeded testnet liquidity pool that swaps between AED-PT and USDC at an owner-set
///         exchange rate, enabling SettlementRouter to convert a payer's asset into whichever
///         rail the merchant's regulatory zone requires.
///
/// @dev DISCLAIMER — EXPLICITLY NOT A DEX OR MARKET MAKER.
///      This is a demo mechanism for the UAE PTSR hackathon track: a finite seeded pool with
///      an owner-configured fixed rate. It is NOT suitable for production use:
///        - The rate is admin-set (not oracle-sourced); no Chainlink AED/USD feed was confirmed
///          to exist on Polygon Amoy at time of build (Architecture §4 risks).
///        - Liquidity is finite and will run dry; re-seed before every demo run.
///        - The submission discloses this as a mock (Architecture §2.x, PRD §6 non-goals).
///
/// ══════════════════════════════════════════════════════════════════════════════════════════
/// DECIMAL ARITHMETIC — CRITICAL, READ BEFORE TOUCHING ANY RATE MATH
/// ══════════════════════════════════════════════════════════════════════════════════════════
///
/// AED-PT has 2 decimals (MockAEDPT.sol):  1.00 AED  = 100 raw units  (1e2)
/// USDC   has 6 decimals (Circle sandbox): 1.000000 USDC = 1_000_000 raw units (1e6)
///
/// rates[fromToken][toToken] is stored scaled by RATE_PRECISION = 1e18.
/// Semantics:
///   rate = (example_amountOut_raw × RATE_PRECISION) / example_amountIn_raw
///
/// ── USDC → AED-PT example (the path SettlementRouter uses) ──────────────────────────────
///
/// Real-world rate: 1 USD ≈ 3.6725 AED.
///
/// To convert 1.000000 USDC → 3.67 AED:
///   amountIn_USDC_raw  = 1_000_000   (1 USDC at 6dp)
///   amountOut_AEDPT_raw = 367         (3.67 AED at 2dp)
///   rate = 367 × 1e18 / 1_000_000  = 367_000_000_000_000  ≈ 3.67 × 10^14
///
/// Applying the rate to arbitrary amountIn (USDC raw units):
///   amountOut_AEDPT_raw = amountIn_USDC_raw × rate / 1e18
///
/// Verification with non-round amount amountIn = 373_297 raw USDC (0.373297 USDC):
///   amountOut = 373_297 × 367_000_000_000_000 / 1e18
///             = 136_999_999_999_000 / 1e18      ← floor division
///             = 136  (= 1.36 AED)
///
/// With amountIn = 373_298 raw USDC (one more unit):
///   amountOut = 373_298 × 367_000_000_000_000 / 1e18
///             = 137_000_000_000_366 / 1e18
///             = 137  (= 1.37 AED)  ✓
///
/// WHY THE DECIMAL GAP MATTERS:
///   Naive: amountOut_AEDPT = amountIn_USDC × 3.6725  would give 373_297 × 3 = 1_119_891
///   That's 11,198.91 AED — wrong by 10,000×. The rate MUST encode the decimal re-scaling
///   from 6dp (USDC) → 2dp (AEDPT), not just the economic ratio.
///
/// ── AED-PT → USDC example (inverse path) ─────────────────────────────────────────────────
///
/// To convert 1 AED (100 raw AEDPT) → 0.272300 USDC (272_300 raw USDC):
///   rate = 272_300 × 1e18 / 100  = 2_723_000_000_000_000_000_000  ≈ 2.723 × 10^21
///
/// ── getAmountIn CEILING formula ───────────────────────────────────────────────────────────
///
/// SettlementRouter must pull an exact USDC amount from the payer BEFORE calling swap().
/// It cannot pull "close enough" — safeTransferFrom is exact. So the quote must ceiling-round:
///
///   amountIn_raw = ⌈ amountOut_raw × RATE_PRECISION / rate ⌉
///               = (amountOut_raw × RATE_PRECISION + rate - 1) / rate   (integer ceiling)
///
/// Ceiling means the payer might supply 1 raw-unit more than strictly necessary; the swap()
/// then floors the conversion, so any dust stays in the vault (never negative). The payer's
/// worst case overpayment is 1 raw-unit of fromToken (< $0.000001 for USDC at 6dp).
///
/// ══════════════════════════════════════════════════════════════════════════════════════════

contract ConversionVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev All stored rates are scaled by this factor to preserve precision without floating
    ///      point. 1e18 is the standard in Solidity (matches wei/ether and Chainlink feed precision).
    uint256 public constant RATE_PRECISION = 1e18;

    /// @notice rates[fromToken][toToken] — raw-unit exchange rate scaled by RATE_PRECISION.
    ///         Meaning: amountOut_raw = amountIn_raw × rate / RATE_PRECISION.
    ///         Only the owner may write. No swap participant can influence the rate on their swap.
    mapping(address => mapping(address => uint256)) public rates;

    event Swapped(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut
    );
    event RateSet(address indexed fromToken, address indexed toToken, uint256 rate);
    event LiquiditySeeded(address indexed token, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error SameToken();
    error RateNotSet(address fromToken, address toToken);
    error InsufficientVaultLiquidity(address token, uint256 required, uint256 available);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─────────────────────────────────────────────────────────────────────────────────────
    // Owner-only administration
    // ─────────────────────────────────────────────────────────────────────────────────────

    /// @notice Set the fixed exchange rate for a fromToken → toToken swap.
    /// @param fromToken  The token supplied by the swapper.
    /// @param toToken    The token received by the swapper.
    /// @param rate       Rate scaled by RATE_PRECISION:
    ///                   rate = (amountOut_raw × RATE_PRECISION) / amountIn_raw
    ///                   See the contract-level DECIMAL ARITHMETIC block for exact derivation.
    ///
    /// @dev SECURITY: Only the owner can set rates. This function MUST remain onlyOwner.
    ///      A swap participant calling setRate before or during their swap would be a
    ///      critical price-manipulation vulnerability — the modifier prevents it entirely.
    function setRate(address fromToken, address toToken, uint256 rate) external onlyOwner {
        if (fromToken == address(0) || toToken == address(0)) revert ZeroAddress();
        if (fromToken == toToken) revert SameToken();
        if (rate == 0) revert ZeroAmount();
        rates[fromToken][toToken] = rate;
        emit RateSet(fromToken, toToken, rate);
    }

    /// @notice Pre-fund the vault with `amount` raw units of `token`.
    /// @dev Owner-only. Caller (owner) must have approved this contract beforehand.
    ///      Seeded liquidity is finite — re-seed before every demo run or the vault will
    ///      revert with InsufficientVaultLiquidity mid-demo (Architecture §4 risk).
    function seedLiquidity(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit LiquiditySeeded(token, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // Quote
    // ─────────────────────────────────────────────────────────────────────────────────────

    /// @notice How many raw `fromToken` units must go IN to get exactly `amountOut` raw
    ///         `toToken` units out? Result is ceiling-rounded (payer bears at most 1 raw-unit dust).
    ///
    ///         Architecture §2.x spec interface: getAmountIn(address toToken, uint256 amountOut).
    ///         Because "fromToken" is the OTHER configured token, SettlementRouter must supply
    ///         it explicitly to resolve direction. We therefore expose both forms:
    ///           • getAmountIn(toToken, amountOut) — spec-required two-arg signature; reverts
    ///             with a clear message directing callers to the three-arg version.
    ///           • getAmountIn(fromToken, toToken, amountOut) — the form actually called by
    ///             SettlementRouter (the router knows both token addresses).
    ///
    ///         Formula: amountIn = ⌈ amountOut × RATE_PRECISION / rate[fromToken][toToken] ⌉
    ///
    ///         See DECIMAL ARITHMETIC block above for a worked numeric example.
    function getAmountIn(address toToken, uint256 amountOut) external view returns (uint256) {
        // The two-arg spec signature cannot unambiguously resolve fromToken without additional
        // context when the vault supports multiple pairs. Retain the signature per spec but
        // revert with a clear message: SettlementRouter must call the three-arg overload.
        // Solidity allows overloads; ABI distinguishes them by parameter count+types.
        if (toToken == address(0)) revert ZeroAddress();
        if (amountOut == 0) revert ZeroAmount();
        revert("ConversionVault: use getAmountIn(fromToken,toToken,amountOut) - fromToken required for multi-pair vault");
    }

    /// @notice Three-arg quote — the form SettlementRouter actually calls.
    ///         Identical semantics to the two-arg form but with explicit fromToken.
    function getAmountIn(address fromToken, address toToken, uint256 amountOut)
        external
        view
        returns (uint256 amountIn)
    {
        return _quoteAmountIn(fromToken, toToken, amountOut);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // Core swap — the only entry point that moves tokens
    // ─────────────────────────────────────────────────────────────────────────────────────

    /// @notice Swap `amountIn` raw units of `fromToken` for `toToken` at the configured rate.
    ///
    ///         Output formula: amountOut = amountIn × rate[fromToken][toToken] / RATE_PRECISION  (floor)
    ///         Floor means any fractional-unit remainder stays in the vault, keeping its balance
    ///         non-negative after every swap.
    ///
    ///         Callers who need an exact output (e.g. SettlementRouter) should:
    ///           1. Call getAmountIn(fromToken, toToken, exactAmountOut) → usdcIn (ceiling)
    ///           2. safeTransferFrom(payer, this, usdcIn)          (or approve+swap)
    ///           3. Call swap(fromToken, toToken, usdcIn)
    ///         The ceiling/floor pairing guarantees amountOut ≥ exactAmountOut intended.
    ///
    /// @dev Protected by ReentrancyGuard. Reverts if vault's toToken balance is insufficient
    ///      (never underflows, never pays a partial/incorrect amount).
    ///
    /// @param fromToken  Token the caller supplies.
    /// @param toToken    Token the caller receives.
    /// @param amountIn   Exact raw units of fromToken to pull from caller.
    /// @return amountOut Raw units of toToken delivered to caller.
    function swap(address fromToken, address toToken, uint256 amountIn)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (fromToken == address(0) || toToken == address(0)) revert ZeroAddress();
        if (fromToken == toToken) revert SameToken();
        if (amountIn == 0) revert ZeroAmount();

        uint256 rate = rates[fromToken][toToken];
        if (rate == 0) revert RateNotSet(fromToken, toToken);

        // ── Step 1: compute output amount (floor division) ───────────────────
        // amountOut = amountIn × rate / RATE_PRECISION
        // Overflow analysis: amountIn is bounded by token total supply (≤ type(uint128).max in
        // practice for our mocks). rate ≤ type(uint256).max but in practice << 1e36 for any
        // plausible AED/USD rate. The product amountIn × rate fits in uint256 for all realistic
        // inputs under this constraint. If overflow were a concern for production use, a
        // mulDiv-style safe implementation (e.g. PRBMath) should be used instead.
        amountOut = (amountIn * rate) / RATE_PRECISION;

        // An output of zero means the input was too small (dust below the rate precision).
        if (amountOut == 0) revert ZeroAmount();

        // ── Step 2: liquidity check BEFORE any state change ───────────────────
        // The vault must never pay out more than it holds. Checking here (not after pulling
        // fromToken) ensures the whole call reverts atomically on insufficient funds — the
        // payer's allowance is NOT consumed on a failed swap.
        uint256 vaultToBalance = IERC20(toToken).balanceOf(address(this));
        if (vaultToBalance < amountOut) {
            revert InsufficientVaultLiquidity(toToken, amountOut, vaultToBalance);
        }

        // ── Step 3: pull fromToken from caller into vault ──────────────────────
        // Caller must have pre-approved this contract for at least amountIn of fromToken.
        // (SettlementRouter calls forceApprove before this.)
        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amountIn);

        // ── Step 4: push toToken from vault to caller ──────────────────────────
        IERC20(toToken).safeTransfer(msg.sender, amountOut);

        emit Swapped(fromToken, toToken, amountIn, amountOut);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────────────────

    /// @dev amountIn = ⌈ amountOut × RATE_PRECISION / rate ⌉
    ///      Integer ceiling: (a + b - 1) / b  for a = amountOut × RATE_PRECISION, b = rate.
    function _quoteAmountIn(address fromToken, address toToken, uint256 amountOut)
        internal
        view
        returns (uint256)
    {
        if (fromToken == address(0) || toToken == address(0)) revert ZeroAddress();
        if (fromToken == toToken) revert SameToken();
        if (amountOut == 0) revert ZeroAmount();

        uint256 rate = rates[fromToken][toToken];
        if (rate == 0) revert RateNotSet(fromToken, toToken);

        // amountOut × RATE_PRECISION — overflow safe for realistic token amounts (see swap()).
        uint256 numerator = amountOut * RATE_PRECISION;
        // Ceiling: (numerator + rate - 1) / rate
        return (numerator + rate - 1) / rate;
    }
}
