// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TreasuryVault (SECURE) — challenge 02
contract TreasuryVaultSecure {
    address public owner;

    constructor() payable {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }

    function sweep(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }

    receive() external payable {}
}
