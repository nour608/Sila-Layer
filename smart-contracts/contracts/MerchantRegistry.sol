// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MerchantRegistry
/// @notice Stores merchant compliance state and evaluates rail eligibility.
contract MerchantRegistry is Ownable {
    enum Zone {
        Unregistered,
        Mainland,
        DIFC
    }

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

    mapping(address => Merchant) private _merchants;
    address private _registrar;

    event MerchantRegistered(address indexed merchant, Zone zone, string label);
    event MerchantActiveSet(address indexed merchant, bool active);
    event RegistrarUpdated(address indexed previousRegistrar, address indexed newRegistrar);

    error ZeroAddress();
    error InvalidZone();
    error NotOwnerOrRegistrar(address caller);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyOwnerOrRegistrar() {
        if (msg.sender != owner() && msg.sender != _registrar) revert NotOwnerOrRegistrar(msg.sender);
        _;
    }

    function registrar() external view returns (address) {
        return _registrar;
    }

    function setRegistrar(address newRegistrar) external onlyOwner {
        emit RegistrarUpdated(_registrar, newRegistrar);
        _registrar = newRegistrar;
    }

    function registerMerchant(address merchant, Zone zone, string calldata label) external onlyOwnerOrRegistrar {
        if (merchant == address(0)) revert ZeroAddress();
        if (zone == Zone.Unregistered) revert InvalidZone();

        _merchants[merchant] = Merchant({zone: zone, active: true, label: label});
        emit MerchantRegistered(merchant, zone, label);
    }

    function setActive(address merchant, bool active) external onlyOwner {
        if (merchant == address(0)) revert ZeroAddress();
        _merchants[merchant].active = active;
        emit MerchantActiveSet(merchant, active);
    }

    function isForeignTokenPermitted(address merchant, Purpose purpose) external view returns (bool) {
        Zone zone = _merchants[merchant].zone;

        if (zone == Zone.DIFC) {
            return true;
        }
        if (zone == Zone.Mainland) {
            return purpose == Purpose.VirtualAssetRelated;
        }
        return false;
    }

    function getZone(address merchant) external view returns (Zone) {
        return _merchants[merchant].zone;
    }

    function isActive(address merchant) external view returns (bool) {
        return _merchants[merchant].active;
    }

    function getMerchant(address merchant) external view returns (Merchant memory) {
        return _merchants[merchant];
    }
}
