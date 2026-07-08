// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MerchantRegistry} from "../contracts/MerchantRegistry.sol";
import {SettlementRouter} from "../contracts/SettlementRouter.sol";
import {MockAEDPT} from "../contracts/MockAEDPT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Slice 1 demo on Polygon Amoy: deploy MerchantRegistry + SettlementRouter
///         (wired to real Circle sandbox USDC), register a merchant, then settle a
///         real USDC payment so the DoD (a real on-chain transfer caused by the
///         contract) is provable on the Amoy explorer.
///
/// Required env:
///   PRIVATE_KEY   - deployer/payer key (funded with Amoy MATIC + sandbox USDC)
///   USDC_ADDRESS  - Circle sandbox USDC on Amoy (0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582)
/// Optional env:
///   MERCHANT      - merchant address (defaults to deployer if unset)
///   SETTLE_AMOUNT - USDC amount in 6-dp base units (defaults to 1_000000 = 1 USDC)
///
/// Run:
///   forge script script/DeployAndSettle.s.sol --rpc-url $AMOY_RPC_URL --broadcast
contract DeployAndSettle is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        IERC20 usdc = IERC20(vm.envAddress("USDC_ADDRESS"));
        address merchant = vm.envOr("MERCHANT", deployer);
        uint256 amount = vm.envOr("SETTLE_AMOUNT", uint256(1_000000)); // 1 USDC (6 dp)

        vm.startBroadcast(pk);

        MerchantRegistry registry = new MerchantRegistry(deployer);
        MockAEDPT aedpt = new MockAEDPT(deployer);
        SettlementRouter router = new SettlementRouter(registry, usdc, IERC20(address(aedpt)));

        // Register the merchant as DIFC so the USDC (foreign-token) rail is compliant end-to-end.
        registry.registerMerchant(merchant, MerchantRegistry.Zone.DIFC, "Demo Merchant (Slice 2)");

        // Deployer acts as payer on the USDC rail: approve the router then settle.
        usdc.approve(address(router), amount);
        router.settle(merchant, deployer, amount, MerchantRegistry.Purpose.RetailGoods);

        vm.stopBroadcast();

        console2.log("MerchantRegistry:", address(registry));
        console2.log("MockAEDPT:", address(aedpt));
        console2.log("SettlementRouter:", address(router));
        console2.log("USDC:", address(usdc));
        console2.log("Merchant:", merchant);
        console2.log("Settled amount (6dp):", amount);
    }
}
