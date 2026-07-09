// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MerchantRegistry
/// @notice Records, per merchant, a regulatory zone and active status, and answers the
///         core compliance question: is a foreign payment token (e.g. USDC) permitted for
///         a given merchant + transaction purpose under the CBUAE PTSR / DIFC framing.
/// @dev MVP: registration is owner-attested (admin asserts zone/eligibility). This is NOT
///      a licensing/KYC check and must be disclosed as such (PRD FR1, §6 non-goals).
///      Interface implements ARCHITECTURE.md §2.1 as specified — do not redesign without reason.
contract MerchantRegistry is Ownable {
    /// @notice Regulatory zone a merchant is registered under.
    /// @dev `Unregistered` is the zero value: an unknown merchant reads as Unregistered.
    enum Zone {
        Unregistered,
        Mainland,
        DIFC
    }

    /// @notice Purpose of a transaction, driving rail eligibility under PTSR.
    enum Purpose {
        RetailGoods,
        VirtualAssetRelated,
        CrossBorderB2B
    }

    struct Merchant {
        Zone zone;
        bool active;
        string label;
    }

    /// @notice Merchant records keyed by merchant address.
    mapping(address => Merchant) private _merchants;

    /// @notice Address allowed to register merchants in addition to the owner.
    /// @dev Set to the CRE MerchantRegistryReceiver so DON-verified KYB results can be written
    ///      on-chain without granting it full ownership. Zero address disables the registrar path.
    address private _registrar;

    event MerchantRegistered(address indexed merchant, Zone zone, string label);
    event MerchantActiveSet(address indexed merchant, bool active);
    event RegistrarUpdated(address indexed previousRegistrar, address indexed newRegistrar);

    error ZeroAddress();
    error InvalidZone();
    error NotOwnerOrRegistrar(address caller);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @dev Permits the owner or the configured registrar (CRE receiver) to register merchants.
    modifier onlyOwnerOrRegistrar() {
        if (msg.sender != owner() && msg.sender != _registrar) revert NotOwnerOrRegistrar(msg.sender);
        _;
    }

    /// @notice The address currently allowed to register merchants alongside the owner.
    function registrar() external view returns (address) {
        return _registrar;
    }

    /// @notice Set (or clear) the registrar allowed to call `registerMerchant`.
    /// @dev Owner-only. Set to the deployed MerchantRegistryReceiver; pass address(0) to disable.
    function setRegistrar(address newRegistrar) external onlyOwner {
        emit RegistrarUpdated(_registrar, newRegistrar);
        _registrar = newRegistrar;
    }

    /// @notice Register (or re-attest) a merchant with a regulatory zone and label.
    /// @dev Owner- or registrar-attested. Registering sets the merchant active.
    ///      Re-registering an existing merchant overwrites zone/label and re-activates.
    /// @param merchant The merchant's settlement address.
    /// @param zone     The regulatory zone (must not be `Unregistered`).
    /// @param label    Human-readable label for the dashboard.
    function registerMerchant(address merchant, Zone zone, string calldata label) external onlyOwnerOrRegistrar {
        if (merchant == address(0)) revert ZeroAddress();
        if (zone == Zone.Unregistered) revert InvalidZone();

        _merchants[merchant] = Merchant({zone: zone, active: true, label: label});
        emit MerchantRegistered(merchant, zone, label);
    }

    /// @notice Activate or deactivate a merchant without changing its zone/label.
    /// @dev Owner-only. Deactivated merchants must be rejected at settlement time.
    function setActive(address merchant, bool active) external onlyOwner {
        if (merchant == address(0)) revert ZeroAddress();
        _merchants[merchant].active = active;
        emit MerchantActiveSet(merchant, active);
    }

    /// @notice The core compliance check: may a foreign payment token be used for this
    ///         merchant + purpose combination?
    /// @dev Fail-safe: returns false for anything not explicitly permitted. This is the
    ///      SOLE source of truth for rail selection — callers must never pass a client-side
    ///      boolean in its place (ARCHITECTURE.md §2.2).
    ///      Rules (PRD FR3):
    ///        - Mainland + VirtualAssetRelated -> true (foreign token / USDC permitted)
    ///        - Mainland + anything else       -> false (AED-PT required)
    ///        - DIFC + any purpose             -> true
    ///        - Unregistered                   -> false
    ///      Mainland + CrossBorderB2B resolves to false (AED-PT). Under CBUAE PTSR a mainland
    ///      merchant may accept a Foreign Payment Token ONLY for virtual-asset/derivatives-
    ///      related purchases; CrossBorderB2B is not such a purpose, so the compliant rail is
    ///      the Dirham Payment Token. Being inactive does not change rail eligibility — active
    ///      status is enforced separately at settlement.
    function isForeignTokenPermitted(address merchant, Purpose purpose) external view returns (bool) {
        Zone zone = _merchants[merchant].zone;

        if (zone == Zone.DIFC) {
            return true;
        }
        if (zone == Zone.Mainland) {
            return purpose == Purpose.VirtualAssetRelated;
        }
        return false; // Unregistered
    }

    /// @notice The regulatory zone of a merchant (Unregistered if unknown).
    function getZone(address merchant) external view returns (Zone) {
        return _merchants[merchant].zone;
    }

    /// @notice Whether a merchant is currently active.
    function isActive(address merchant) external view returns (bool) {
        return _merchants[merchant].active;
    }

    /// @notice Full merchant record (zone, active, label).
    function getMerchant(address merchant) external view returns (Merchant memory) {
        return _merchants[merchant];
    }
}
