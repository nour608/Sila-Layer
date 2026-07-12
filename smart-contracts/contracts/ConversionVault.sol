// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ConversionVault
/// @notice Seeded liquidity pool for fixed-rate swaps between AED-PT and USDC.

contract ConversionVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Fixed-point precision used for all stored rates.
    uint256 public constant RATE_PRECISION = 1e18;

    /// @notice Exchange rate for a given token pair, scaled by RATE_PRECISION.
    mapping(address => mapping(address => uint256)) public rates;

    event Swapped(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut);
    event RateSet(address indexed fromToken, address indexed toToken, uint256 rate);
    event LiquiditySeeded(address indexed token, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error SameToken();
    error RateNotSet(address fromToken, address toToken);
    error InsufficientVaultLiquidity(address token, uint256 required, uint256 available);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Sets the fixed exchange rate for a token pair.
    /// @param fromToken Token supplied by the caller.
    /// @param toToken Token received by the caller.
    /// @param rate Rate scaled by RATE_PRECISION.
    function setRate(address fromToken, address toToken, uint256 rate) external onlyOwner {
        if (fromToken == address(0) || toToken == address(0)) revert ZeroAddress();
        if (fromToken == toToken) revert SameToken();
        if (rate == 0) revert ZeroAmount();
        rates[fromToken][toToken] = rate;
        emit RateSet(fromToken, toToken, rate);
    }

    /// @notice Seeds the vault with `amount` raw units of `token`.
    function seedLiquidity(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit LiquiditySeeded(token, amount);
    }

    /// @notice Returns the ceiling-rounded input amount required for a target output.
    function getAmountIn(address toToken, uint256 amountOut) external view returns (uint256) {
        if (toToken == address(0)) revert ZeroAddress();
        if (amountOut == 0) revert ZeroAmount();
        revert(
            "ConversionVault: use getAmountIn(fromToken,toToken,amountOut) - fromToken required for multi-pair vault"
        );
    }

    /// @notice Returns the input amount required for the given token pair and target output.
    function getAmountIn(address fromToken, address toToken, uint256 amountOut)
        external
        view
        returns (uint256 amountIn)
    {
        return _quoteAmountIn(fromToken, toToken, amountOut);
    }

    /// @notice Swaps `amountIn` raw units of `fromToken` for `toToken` at the configured rate.
    /// @param fromToken Token supplied by the caller.
    /// @param toToken Token received by the caller.
    /// @param amountIn Exact raw units of `fromToken` to pull from the caller.
    /// @return amountOut Raw units of `toToken` delivered to the caller.
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

        amountOut = (amountIn * rate) / RATE_PRECISION;

        if (amountOut == 0) revert ZeroAmount();

        uint256 vaultToBalance = IERC20(toToken).balanceOf(address(this));
        if (vaultToBalance < amountOut) {
            revert InsufficientVaultLiquidity(toToken, amountOut, vaultToBalance);
        }

        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(toToken).safeTransfer(msg.sender, amountOut);

        emit Swapped(fromToken, toToken, amountIn, amountOut);
    }

    /// @dev Computes the ceiling-rounded input amount for a target output.
    function _quoteAmountIn(address fromToken, address toToken, uint256 amountOut) internal view returns (uint256) {
        if (fromToken == address(0) || toToken == address(0)) revert ZeroAddress();
        if (fromToken == toToken) revert SameToken();
        if (amountOut == 0) revert ZeroAmount();

        uint256 rate = rates[fromToken][toToken];
        if (rate == 0) revert RateNotSet(fromToken, toToken);

        uint256 numerator = amountOut * RATE_PRECISION;
        return (numerator + rate - 1) / rate;
    }
}
