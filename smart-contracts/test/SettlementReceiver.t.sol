// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MerchantRegistry} from "../contracts/MerchantRegistry.sol";
import {SettlementRouter} from "../contracts/SettlementRouter.sol";
import {SettlementReceiver} from "../contracts/SettlementReceiver.sol";
import {IReceiver} from "../contracts/interfaces/IReceiver.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Slice 3 tests: the CRE consumer adapter. Verifies forwarder-gating, report
///         decoding, and that a delivered report drives a real settlement on the frozen router.
contract SettlementReceiverTest is Test {
    MerchantRegistry internal registry;
    SettlementRouter internal router;
    SettlementReceiver internal receiver;
    MockERC20 internal usdc;
    MockERC20 internal aedpt;

    address internal owner = makeAddr("owner");
    address internal forwarder = makeAddr("forwarder");
    address internal difcMerchant = makeAddr("difcMerchant");
    address internal mainlandMerchant = makeAddr("mainlandMerchant");
    address internal payer = makeAddr("payer");

    function setUp() public {
        vm.prank(owner);
        registry = new MerchantRegistry(owner);
        usdc = new MockERC20("USD Coin (test)", "USDC", 6);
        aedpt = new MockERC20("AED-PT (test)", "sAEDPT", 2);
        router = new SettlementRouter(registry, IERC20(address(usdc)), IERC20(address(aedpt)));
        receiver = new SettlementReceiver(router, forwarder, owner);

        vm.startPrank(owner);
        registry.registerMerchant(difcMerchant, MerchantRegistry.Zone.DIFC, "DIFC Store");
        registry.registerMerchant(mainlandMerchant, MerchantRegistry.Zone.Mainland, "Mainland Cafe");
        vm.stopPrank();

        // Payer holds funds and grants a standing allowance to the router (CRE has no
        // human to approve at settle-time — documented in the workflow README).
        usdc.mint(payer, 1_000e6);
        aedpt.mint(payer, 1_000e2);
        vm.startPrank(payer);
        usdc.approve(address(router), type(uint256).max);
        aedpt.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function _report(address merchant, address payer_, uint256 amount, MerchantRegistry.Purpose purpose)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(merchant, payer_, amount, uint8(purpose));
    }

    // Minimal valid metadata: 32-byte workflowId + 10-byte name + 20-byte author = 62 bytes.
    function _metadata(bytes32 workflowId, address author) internal pure returns (bytes memory) {
        return abi.encodePacked(workflowId, bytes10(0), author);
    }

    function test_OnReport_DrivesUsdcSettlement() public {
        bytes memory report = _report(difcMerchant, payer, 100e6, MerchantRegistry.Purpose.RetailGoods);
        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), address(0)), report);
        assertEq(usdc.balanceOf(difcMerchant), 100e6);
    }

    function test_OnReport_DrivesAedptSettlement() public {
        bytes memory report = _report(mainlandMerchant, payer, 50e2, MerchantRegistry.Purpose.RetailGoods);
        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), address(0)), report);
        assertEq(aedpt.balanceOf(mainlandMerchant), 50e2);
    }

    function test_RevertWhen_CallerNotForwarder() public {
        bytes memory report = _report(difcMerchant, payer, 100e6, MerchantRegistry.Purpose.RetailGoods);
        vm.expectRevert(abi.encodeWithSelector(SettlementReceiver.InvalidSender.selector, address(this), forwarder));
        receiver.onReport(_metadata(bytes32(0), address(0)), report);
    }

    function test_RevertWhen_UnregisteredMerchant_BubblesRouterError() public {
        address ghost = makeAddr("ghost");
        bytes memory report = _report(ghost, payer, 100e6, MerchantRegistry.Purpose.RetailGoods);
        vm.expectRevert(abi.encodeWithSelector(SettlementRouter.MerchantNotRegistered.selector, ghost));
        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), address(0)), report);
    }

    function test_ExpectedAuthorValidation() public {
        address author = makeAddr("author");
        vm.prank(owner);
        receiver.setExpectedAuthor(author);

        bytes memory report = _report(difcMerchant, payer, 100e6, MerchantRegistry.Purpose.RetailGoods);

        // Wrong author -> revert.
        vm.expectRevert(
            abi.encodeWithSelector(SettlementReceiver.InvalidAuthor.selector, address(0xBAD), author)
        );
        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), address(0xBAD)), report);

        // Correct author -> settles.
        vm.prank(forwarder);
        receiver.onReport(_metadata(bytes32(0), author), report);
        assertEq(usdc.balanceOf(difcMerchant), 100e6);
    }

    function test_SupportsInterface() public view {
        assertTrue(receiver.supportsInterface(type(IReceiver).interfaceId));
    }

    function test_RevertWhen_SetForwarderZero() public {
        vm.expectRevert(SettlementReceiver.InvalidForwarder.selector);
        vm.prank(owner);
        receiver.setForwarder(address(0));
    }
}
