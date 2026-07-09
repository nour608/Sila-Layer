// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerchantRegistry} from "../contracts/MerchantRegistry.sol";
import {MerchantRegistryReceiver} from "../contracts/MerchantRegistryReceiver.sol";
import {IReceiver} from "../contracts/interfaces/IReceiver.sol";

/// @notice Tests for the CRE consumer adapter that turns DON-signed KYB results into
///         MerchantRegistry.registerMerchant(...) calls via the registrar role.
contract MerchantRegistryReceiverTest is Test {
    MerchantRegistry internal registry;
    MerchantRegistryReceiver internal receiver;

    address internal owner = makeAddr("owner");
    address internal forwarder = makeAddr("forwarder");
    address internal stranger = makeAddr("stranger");
    address internal merchant = makeAddr("merchant");

    function setUp() public {
        vm.prank(owner);
        registry = new MerchantRegistry(owner);
        receiver = new MerchantRegistryReceiver(registry, forwarder, owner);

        vm.prank(owner);
        registry.setRegistrar(address(receiver));
    }

    function _report(address merchant_, uint8 zoneRaw, string memory label) internal pure returns (bytes memory) {
        return abi.encode(merchant_, zoneRaw, label);
    }

    /// Minimal valid metadata: 32-byte workflowId + 10-byte name + 20-byte author = 62 bytes.
    function _metadata(bytes32 workflowId, address author) internal pure returns (bytes memory) {
        return abi.encodePacked(workflowId, bytes10(0), author);
    }

    function test_Construction_WiresRegistryAndForwarder() public view {
        assertEq(address(receiver.registry()), address(registry));
        assertEq(receiver.getForwarder(), forwarder);
        assertEq(registry.registrar(), address(receiver));
    }

    function test_OnReport_RegistersMerchantViaCRE() public {
        bytes memory report = _report(merchant, uint8(MerchantRegistry.Zone.Mainland), "Cafe A");

        vm.expectEmit(true, true, false, true);
        emit MerchantRegistry.MerchantRegistered(merchant, MerchantRegistry.Zone.Mainland, "Cafe A");
        vm.expectEmit(true, false, false, true);
        emit MerchantRegistryReceiver.MerchantRegisteredViaCRE(merchant, MerchantRegistry.Zone.Mainland, "Cafe A");

        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), address(0)), report);

        assertEq(uint256(registry.getZone(merchant)), uint256(MerchantRegistry.Zone.Mainland));
        assertTrue(registry.isActive(merchant));
        assertEq(registry.getMerchant(merchant).label, "Cafe A");
    }

    function test_OnReport_RegistersDifcMerchant() public {
        bytes memory report = _report(merchant, uint8(MerchantRegistry.Zone.DIFC), "DIFC Store");
        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), address(0)), report);
        assertEq(uint256(registry.getZone(merchant)), uint256(MerchantRegistry.Zone.DIFC));
    }

    function test_RevertWhen_CallerNotForwarder() public {
        bytes memory report = _report(merchant, uint8(MerchantRegistry.Zone.Mainland), "x");
        vm.expectRevert(
            abi.encodeWithSelector(MerchantRegistryReceiver.InvalidSender.selector, address(this), forwarder)
        );
        receiver.onReport(_metadata(bytes32(0), address(0)), report);
    }

    function test_RevertWhen_ZoneUnregistered() public {
        bytes memory report = _report(merchant, uint8(MerchantRegistry.Zone.Unregistered), "x");
        vm.expectRevert(
            abi.encodeWithSelector(
                MerchantRegistryReceiver.InvalidZone.selector, uint8(MerchantRegistry.Zone.Unregistered)
            )
        );
        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), address(0)), report);
    }

    function test_RevertWhen_ZoneOutOfBounds() public {
        uint8 badZone = uint8(type(MerchantRegistry.Zone).max) + 1;
        bytes memory report = _report(merchant, badZone, "x");
        vm.expectRevert(abi.encodeWithSelector(MerchantRegistryReceiver.InvalidZone.selector, badZone));
        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), address(0)), report);
    }

    function test_ExpectedAuthorValidation() public {
        address author = makeAddr("author");
        vm.prank(owner);
        receiver.setExpectedAuthor(author);

        bytes memory report = _report(merchant, uint8(MerchantRegistry.Zone.Mainland), "x");

        vm.expectRevert(abi.encodeWithSelector(MerchantRegistryReceiver.InvalidAuthor.selector, address(0xBAD), author));
        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), address(0xBAD)), report);

        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), author), report);
        assertEq(uint256(registry.getZone(merchant)), uint256(MerchantRegistry.Zone.Mainland));
    }

    function test_ExpectedWorkflowIdValidation() public {
        bytes32 expectedId = bytes32(uint256(0xABCD));
        vm.prank(owner);
        receiver.setExpectedWorkflowId(expectedId);

        bytes memory report = _report(merchant, uint8(MerchantRegistry.Zone.Mainland), "x");

        bytes32 badId = bytes32(uint256(0xBAD));
        vm.expectRevert(abi.encodeWithSelector(MerchantRegistryReceiver.InvalidWorkflowId.selector, badId, expectedId));
        vm.prank(forwarder);
        receiver.onReport(_metadata(badId, address(0)), report);

        vm.prank(forwarder);
        receiver.onReport(_metadata(expectedId, address(0)), report);
        assertEq(uint256(registry.getZone(merchant)), uint256(MerchantRegistry.Zone.Mainland));
    }

    function test_SupportsInterface() public view {
        assertTrue(receiver.supportsInterface(type(IReceiver).interfaceId));
    }

    function test_RevertWhen_SetForwarderZero() public {
        vm.expectRevert(MerchantRegistryReceiver.InvalidForwarder.selector);
        vm.prank(owner);
        receiver.setForwarder(address(0));
    }

    // --- registry registrar role tests ---

    function test_RegistrarCanRegister() public {
        vm.expectEmit(true, true, false, true);
        emit MerchantRegistry.MerchantRegistered(merchant, MerchantRegistry.Zone.Mainland, "via registrar");
        vm.prank(address(receiver));
        registry.registerMerchant(merchant, MerchantRegistry.Zone.Mainland, "via registrar");
        assertEq(uint256(registry.getZone(merchant)), uint256(MerchantRegistry.Zone.Mainland));
    }

    function test_RevertWhen_StrangerCannotRegister() public {
        vm.expectRevert(abi.encodeWithSelector(MerchantRegistry.NotOwnerOrRegistrar.selector, stranger));
        vm.prank(stranger);
        registry.registerMerchant(merchant, MerchantRegistry.Zone.Mainland, "x");
    }

    function test_RevertWhen_SetRegistrarCalledByNonOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        registry.setRegistrar(address(0));
    }

    function test_OwnerStillCanRegister() public {
        vm.prank(owner);
        registry.registerMerchant(merchant, MerchantRegistry.Zone.DIFC, "owner still works");
        assertEq(uint256(registry.getZone(merchant)), uint256(MerchantRegistry.Zone.DIFC));
    }

    function test_SetRegistrar_EmitsEvent() public {
        address newRegistrar = makeAddr("newRegistrar");
        vm.expectEmit(true, true, false, false);
        emit MerchantRegistry.RegistrarUpdated(address(receiver), newRegistrar);
        vm.prank(owner);
        registry.setRegistrar(newRegistrar);
        assertEq(registry.registrar(), newRegistrar);
    }

    function test_RegistrarCanBeCleared() public {
        vm.prank(owner);
        registry.setRegistrar(address(0));
        assertEq(registry.registrar(), address(0));
    }
}
