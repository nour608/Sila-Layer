// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @notice Interface a CRE consumer contract must implement to receive DON-signed reports
///         delivered by the Chainlink KeystoneForwarder. Matches Chainlink's IReceiver.
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}
