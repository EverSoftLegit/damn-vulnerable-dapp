// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TreasuryVault (VULNERABLE) — challenge 02
/// @notice Holds the project treasury. Only the owner can sweep it.
contract TreasuryVaultVulnerable {
    address public owner;

    constructor() payable {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // BUG: this admin function is missing the onlyOwner modifier.
    function changeOwner(address newOwner) external {
        owner = newOwner;
    }

    function sweep(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }

    receive() external payable {}
}
