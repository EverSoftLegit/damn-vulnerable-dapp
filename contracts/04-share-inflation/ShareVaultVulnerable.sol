// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ShareVault (VULNERABLE) — challenge 04
/// @notice Deposit tokens, receive shares; redeem shares for a pro-rata slice of the vault.
contract ShareVaultVulnerable {
    IERC20 public immutable asset;
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    constructor(IERC20 asset_) {
        asset = asset_;
    }

    function totalAssets() public view returns (uint256) {
        // BUG (part 1): uses the raw token balance, which anyone can inflate by direct transfer.
        return asset.balanceOf(address(this));
    }

    function deposit(uint256 assets) external returns (uint256 minted) {
        // BUG (part 2): integer division rounds down, and there is no check for 0 shares.
        minted = totalShares == 0 ? assets : (assets * totalShares) / totalAssets();
        asset.transferFrom(msg.sender, address(this), assets);
        shares[msg.sender] += minted;
        totalShares += minted;
    }

    function redeem(uint256 shareAmount) external returns (uint256 assets) {
        assets = (shareAmount * totalAssets()) / totalShares;
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        asset.transfer(msg.sender, assets);
    }
}
