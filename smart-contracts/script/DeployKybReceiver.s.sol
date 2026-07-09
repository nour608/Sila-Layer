// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MerchantRegistry} from "../contracts/MerchantRegistry.sol";
import {MerchantRegistryReceiver} from "../contracts/MerchantRegistryReceiver.sol";

/// @notice Deploy the CRE KYB write path: a MerchantRegistryReceiver wired to an existing
///         MerchantRegistry, then authorize it as the registry's registrar so DON-verified
///         KYB results can be written on-chain via CRE writeReport -> onReport.
///
/// Required env:
///   PRIVATE_KEY       - deployer key; MUST be the current MerchantRegistry owner (setRegistrar is onlyOwner)
///   REGISTRY_ADDRESS  - deployed MerchantRegistry address
///   FORWARDER_ADDRESS - trusted KeystoneForwarder (MockKeystoneForwarder for `cre workflow simulate`)
/// Optional env:
///   RECEIVER_OWNER    - admin of the receiver (defaults to deployer)
///
/// Run:
///   forge script script/DeployKybReceiver.s.sol --rpc-url $AMOY_RPC_URL --broadcast
contract DeployKybReceiver is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        MerchantRegistry registry = MerchantRegistry(vm.envAddress("REGISTRY_ADDRESS"));
        address forwarder = vm.envAddress("FORWARDER_ADDRESS");
        address receiverOwner = vm.envOr("RECEIVER_OWNER", deployer);

        vm.startBroadcast(pk);

        MerchantRegistryReceiver receiver = new MerchantRegistryReceiver(registry, forwarder, receiverOwner);

        // Authorize the receiver so CRE-delivered reports can call registerMerchant.
        // Requires the broadcasting key to be the registry owner.
        registry.setRegistrar(address(receiver));

        vm.stopBroadcast();

        console2.log("MerchantRegistry:", address(registry));
        console2.log("MerchantRegistryReceiver:", address(receiver));
        console2.log("Forwarder:", forwarder);
        console2.log("Registrar set to receiver:", registry.registrar() == address(receiver));
    }
}
