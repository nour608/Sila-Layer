// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MerchantRegistry} from "../contracts/MerchantRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MerchantRegistryTest is Test {
    MerchantRegistry internal registry;

    address internal owner = makeAddr("owner");
    address internal stranger = makeAddr("stranger");
    address internal mainlandMerchant = makeAddr("mainlandMerchant");
    address internal difcMerchant = makeAddr("difcMerchant");

    function setUp() public {
        vm.prank(owner);
        registry = new MerchantRegistry(owner);
    }

    function test_RegisterMainlandMerchant() public {
        vm.prank(owner);
        registry.registerMerchant(mainlandMerchant, MerchantRegistry.Zone.Mainland, "Cafe A");

        assertEq(uint256(registry.getZone(mainlandMerchant)), uint256(MerchantRegistry.Zone.Mainland));
        assertTrue(registry.isActive(mainlandMerchant));
        assertEq(registry.getMerchant(mainlandMerchant).label, "Cafe A");
    }

    function test_RegisterEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit MerchantRegistry.MerchantRegistered(difcMerchant, MerchantRegistry.Zone.DIFC, "DIFC Store");
        vm.prank(owner);
        registry.registerMerchant(difcMerchant, MerchantRegistry.Zone.DIFC, "DIFC Store");
    }

    function test_RevertWhen_NonOwnerRegisters() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        registry.registerMerchant(mainlandMerchant, MerchantRegistry.Zone.Mainland, "x");
    }

    function test_RevertWhen_RegisterZeroAddress() public {
        vm.expectRevert(MerchantRegistry.ZeroAddress.selector);
        vm.prank(owner);
        registry.registerMerchant(address(0), MerchantRegistry.Zone.Mainland, "x");
    }

    function test_RevertWhen_RegisterUnregisteredZone() public {
        vm.expectRevert(MerchantRegistry.InvalidZone.selector);
        vm.prank(owner);
        registry.registerMerchant(mainlandMerchant, MerchantRegistry.Zone.Unregistered, "x");
    }

    function test_SetActiveToggles() public {
        vm.startPrank(owner);
        registry.registerMerchant(mainlandMerchant, MerchantRegistry.Zone.Mainland, "Cafe A");
        registry.setActive(mainlandMerchant, false);
        vm.stopPrank();
        assertFalse(registry.isActive(mainlandMerchant));

        vm.prank(owner);
        registry.setActive(mainlandMerchant, true);
        assertTrue(registry.isActive(mainlandMerchant));
    }

    function test_UnknownMerchantIsUnregistered() public view {
        assertEq(uint256(registry.getZone(stranger)), uint256(MerchantRegistry.Zone.Unregistered));
        assertFalse(registry.isActive(stranger));
    }

    // --- isForeignTokenPermitted: the core compliance matrix (PRD FR3) ---

    function test_Permit_Mainland_Retail_False() public {
        _register(mainlandMerchant, MerchantRegistry.Zone.Mainland);
        assertFalse(registry.isForeignTokenPermitted(mainlandMerchant, MerchantRegistry.Purpose.RetailGoods));
    }

    function test_Permit_Mainland_VirtualAsset_True() public {
        _register(mainlandMerchant, MerchantRegistry.Zone.Mainland);
        assertTrue(registry.isForeignTokenPermitted(mainlandMerchant, MerchantRegistry.Purpose.VirtualAssetRelated));
    }

    function test_Permit_Mainland_CrossBorderB2B_False() public {
        // Under PTSR a mainland merchant may use a foreign token only for virtual-asset
        // purposes; CrossBorderB2B is not one, so the compliant rail is AED-PT (false).
        _register(mainlandMerchant, MerchantRegistry.Zone.Mainland);
        assertFalse(registry.isForeignTokenPermitted(mainlandMerchant, MerchantRegistry.Purpose.CrossBorderB2B));
    }

    function test_Permit_DIFC_AllPurposes_True() public {
        _register(difcMerchant, MerchantRegistry.Zone.DIFC);
        assertTrue(registry.isForeignTokenPermitted(difcMerchant, MerchantRegistry.Purpose.RetailGoods));
        assertTrue(registry.isForeignTokenPermitted(difcMerchant, MerchantRegistry.Purpose.VirtualAssetRelated));
        assertTrue(registry.isForeignTokenPermitted(difcMerchant, MerchantRegistry.Purpose.CrossBorderB2B));
    }

    function test_Permit_Unregistered_AllPurposes_False() public view {
        assertFalse(registry.isForeignTokenPermitted(stranger, MerchantRegistry.Purpose.RetailGoods));
        assertFalse(registry.isForeignTokenPermitted(stranger, MerchantRegistry.Purpose.VirtualAssetRelated));
        assertFalse(registry.isForeignTokenPermitted(stranger, MerchantRegistry.Purpose.CrossBorderB2B));
    }

    function _register(address merchant, MerchantRegistry.Zone zone) internal {
        vm.prank(owner);
        registry.registerMerchant(merchant, zone, "test");
    }
}
