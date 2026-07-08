// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IReceiver} from "./interfaces/IReceiver.sol";
import {SettlementRouter} from "./SettlementRouter.sol";
import {MerchantRegistry} from "./MerchantRegistry.sol";

/// @title SettlementReceiver
/// @notice CRE consumer/adapter: receives DON-signed reports from the Chainlink
///         KeystoneForwarder and forwards each checkout to SettlementRouter.settle(...).
/// @dev CRE cannot call arbitrary functions — it only delivers reports to onReport() on an
///      IReceiver (see docs.chain.link "Onchain Write"). This adapter is that mailbox, so the
///      already-audited SettlementRouter stays FROZEN and unmodified. Security mirrors
///      Chainlink's ReceiverTemplate: only the trusted forwarder may call onReport, with
///      optional workflow-author / workflow-id validation for defense-in-depth.
///
///      The report payload is the ABI-encoded settlement instruction:
///        abi.encode(address merchant, address payer, uint256 amount, uint8 purpose)
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

    /// @param router_    The (frozen) SettlementRouter to forward settlements to.
    /// @param forwarder_ The trusted KeystoneForwarder for the target network.
    ///                   Use the MockKeystoneForwarder address when running `cre workflow simulate`.
    /// @param owner_     Admin able to update forwarder/validation config.
    constructor(SettlementRouter router_, address forwarder_, address owner_) Ownable(owner_) {
        if (address(router_) == address(0)) revert InvalidRouter();
        if (forwarder_ == address(0)) revert InvalidForwarder();
        router = router_;
        s_forwarder = forwarder_;
        emit ForwarderUpdated(address(0), forwarder_);
    }

    /// @inheritdoc IReceiver
    /// @dev Called by the KeystoneForwarder after it verifies DON signatures. Decodes the
    ///      settlement instruction and calls the router. The router remains the sole source of
    ///      truth for rail selection and merchant eligibility — this adapter adds no rail logic.
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

        // Router enforces registration/active/rail rules and reverts with named errors.
        router.settle(merchant, payer, amount, purpose);
        emit Forwarded(merchant, payer, amount, purpose);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    // --- admin config (mirrors ReceiverTemplate) ---

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

    /// @dev Metadata layout delivered by the forwarder: 32-byte workflowId, 10-byte workflow
    ///      name, 20-byte workflow owner (author). See Chainlink ReceiverTemplate.
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
