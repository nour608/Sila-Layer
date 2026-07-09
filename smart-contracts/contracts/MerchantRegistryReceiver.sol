// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IReceiver} from "./interfaces/IReceiver.sol";
import {MerchantRegistry} from "./MerchantRegistry.sol";

/// @title MerchantRegistryReceiver
/// @notice CRE consumer/adapter: receives DON-signed KYB results from the Chainlink
///         KeystoneForwarder and registers the merchant in MerchantRegistry.
/// @dev CRE cannot call arbitrary functions — it only delivers reports to onReport() on an
///      IReceiver (see docs.chain.link "Onchain Write"). This adapter is that mailbox. It must
///      be set as the registry's `registrar` (MerchantRegistry.setRegistrar) so it can call
///      registerMerchant without owning the registry. Security mirrors Chainlink's
///      ReceiverTemplate / SettlementReceiver: only the trusted forwarder may call onReport,
///      with optional workflow-author / workflow-id validation for defense-in-depth.
///
///      The report payload is the ABI-encoded KYB result:
///        abi.encode(address merchant, uint8 zone, string label)
///      where `zone` matches MerchantRegistry.Zone and MUST NOT be Zone.Unregistered.
contract MerchantRegistryReceiver is IReceiver, Ownable {
    MerchantRegistry public immutable registry;

    address private s_forwarder;
    address private s_expectedAuthor;
    bytes32 private s_expectedWorkflowId;

    event MerchantRegisteredViaCRE(address indexed merchant, MerchantRegistry.Zone zone, string label);
    event ForwarderUpdated(address indexed previousForwarder, address indexed newForwarder);
    event ExpectedAuthorUpdated(address indexed previousAuthor, address indexed newAuthor);
    event ExpectedWorkflowIdUpdated(bytes32 indexed previousId, bytes32 indexed newId);

    error InvalidRegistry();
    error InvalidForwarder();
    error InvalidSender(address sender, address expected);
    error InvalidMetadata();
    error InvalidAuthor(address received, address expected);
    error InvalidWorkflowId(bytes32 received, bytes32 expected);
    error InvalidZone(uint8 zone);

    /// @param registry_  The MerchantRegistry to register merchants into.
    /// @param forwarder_ The trusted KeystoneForwarder for the target network.
    ///                   Use the MockKeystoneForwarder address when running `cre workflow simulate`.
    /// @param owner_     Admin able to update forwarder/validation config.
    constructor(MerchantRegistry registry_, address forwarder_, address owner_) Ownable(owner_) {
        if (address(registry_) == address(0)) revert InvalidRegistry();
        if (forwarder_ == address(0)) revert InvalidForwarder();
        registry = registry_;
        s_forwarder = forwarder_;
        emit ForwarderUpdated(address(0), forwarder_);
    }

    /// @inheritdoc IReceiver
    /// @dev Called by the KeystoneForwarder after it verifies DON signatures. Decodes the KYB
    ///      result and registers the merchant. The registry remains the source of truth for the
    ///      zone/eligibility rules — this adapter only writes an already-verified zone.
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

        (address merchant, uint8 zoneRaw, string memory label) = abi.decode(report, (address, uint8, string));

        if (zoneRaw == uint8(MerchantRegistry.Zone.Unregistered) || zoneRaw > uint8(type(MerchantRegistry.Zone).max))
        {
            revert InvalidZone(zoneRaw);
        }
        MerchantRegistry.Zone zone = MerchantRegistry.Zone(zoneRaw);

        // Registry validates merchant != address(0) and zone != Unregistered and reverts otherwise.
        registry.registerMerchant(merchant, zone, label);
        emit MerchantRegisteredViaCRE(merchant, zone, label);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    // --- admin config (mirrors ReceiverTemplate / SettlementReceiver) ---

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
