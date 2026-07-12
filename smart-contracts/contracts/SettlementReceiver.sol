// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IReceiver} from "./interfaces/IReceiver.sol";
import {SettlementRouter} from "./SettlementRouter.sol";
import {MerchantRegistry} from "./MerchantRegistry.sol";

/// @title SettlementReceiver
/// @notice Receives settlement instructions from the CRE forwarder and forwards them to the router.
contract SettlementReceiver is IReceiver, Ownable {
    SettlementRouter public immutable router;

    address private s_forwarder;
    address private s_expectedAuthor;
    bytes32 private s_expectedWorkflowId;

    event Forwarded(address indexed merchant, address indexed payer, uint256 amount, MerchantRegistry.Purpose purpose);
    event ForwarderUpdated(address indexed previousForwarder, address indexed newForwarder);
    event ExpectedAuthorUpdated(address indexed previousAuthor, address indexed newAuthor);
    event ExpectedWorkflowIdUpdated(bytes32 indexed previousId, bytes32 indexed newId);

    error InvalidRouter();
    error InvalidForwarder();
    error InvalidSender(address sender, address expected);
    error InvalidMetadata();
    error InvalidAuthor(address received, address expected);
    error InvalidWorkflowId(bytes32 received, bytes32 expected);
    error InvalidPurpose(uint8 purpose);

    constructor(SettlementRouter router_, address forwarder_, address owner_) Ownable(owner_) {
        if (address(router_) == address(0)) revert InvalidRouter();
        if (forwarder_ == address(0)) revert InvalidForwarder();
        router = router_;
        s_forwarder = forwarder_;
        emit ForwarderUpdated(address(0), forwarder_);
    }

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        if (msg.sender != s_forwarder) revert InvalidSender(msg.sender, s_forwarder);

        if (s_expectedWorkflowId != bytes32(0) || s_expectedAuthor != address(0)) {
            (bytes32 workflowId,, address workflowOwner) = _decodeMetadata(metadata);
            if (s_expectedWorkflowId != bytes32(0) && workflowId != s_expectedWorkflowId) {
                revert InvalidWorkflowId(workflowId, s_expectedWorkflowId);
            }
            if (s_expectedAuthor != address(0) && workflowOwner != s_expectedAuthor) {
                revert InvalidAuthor(workflowOwner, s_expectedAuthor);
            }
        }

        (address merchant, address payer, uint256 amount, uint8 purposeRaw) =
            abi.decode(report, (address, address, uint256, uint8));

        if (purposeRaw > uint8(type(MerchantRegistry.Purpose).max)) revert InvalidPurpose(purposeRaw);
        MerchantRegistry.Purpose purpose = MerchantRegistry.Purpose(purposeRaw);

        router.settle(merchant, payer, amount, purpose);
        emit Forwarded(merchant, payer, amount, purpose);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function getForwarder() external view returns (address) {
        return s_forwarder;
    }

    function setForwarder(address forwarder) external onlyOwner {
        if (forwarder == address(0)) revert InvalidForwarder();
        emit ForwarderUpdated(s_forwarder, forwarder);
        s_forwarder = forwarder;
    }

    function setExpectedAuthor(address author) external onlyOwner {
        emit ExpectedAuthorUpdated(s_expectedAuthor, author);
        s_expectedAuthor = author;
    }

    function setExpectedWorkflowId(bytes32 workflowId) external onlyOwner {
        emit ExpectedWorkflowIdUpdated(s_expectedWorkflowId, workflowId);
        s_expectedWorkflowId = workflowId;
    }

    function _decodeMetadata(bytes calldata metadata)
        internal
        pure
        returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner)
    {
        if (metadata.length < 62) revert InvalidMetadata();
        assembly {
            workflowId := calldataload(metadata.offset)
            workflowName := calldataload(add(metadata.offset, 32))
            workflowOwner := shr(96, calldataload(add(metadata.offset, 42)))
        }
    }
}
