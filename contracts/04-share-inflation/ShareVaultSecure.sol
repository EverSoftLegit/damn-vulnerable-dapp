// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ShareVault (SECURE) — challenge 04
/// @notice Same interface. Uses "virtual shares" (the OpenZeppelin ERC4626 mitigation)
/// so a donation can no longer round a later depositor down to zero, and rejects 0-share mints.
contract ShareVaultSecure {
    uint256 private constant VIRTUAL_SHARES = 1e6; // decimals offset of 6
    uint256 private constant VIRTUAL_ASSETS = 1;

    IERC20 public immutable asset;
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    constructor(IERC20 asset_) {
        asset = asset_;
    }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function deposit(uint256 assets) external returns (uint256 minted) {
        minted = (assets * (totalShares + VIRTUAL_SHARES)) / (totalAssets() + VIRTUAL_ASSETS);
        require(minted > 0, "zero shares");
        asset.transferFrom(msg.sender, address(this), assets);
        shares[msg.sender] += minted;
        totalShares += minted;
    }

    function redeem(uint256 shareAmount) external returns (uint256 assets) {
        assets = (shareAmount * (totalAssets() + VIRTUAL_ASSETS)) / (totalShares + VIRTUAL_SHARES);
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        asset.transfer(msg.sender, assets);
    }
}
