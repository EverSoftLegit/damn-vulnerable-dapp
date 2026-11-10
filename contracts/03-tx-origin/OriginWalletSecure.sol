// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OriginWallet (SECURE) — challenge 03
contract OriginWalletSecure {
    address public owner;

    constructor(address owner_) payable {
        owner = owner_;
    }

    function transfer(address payable to, uint256 amount) external {
        require(msg.sender == owner, "not owner"); // authenticate the direct caller
        to.transfer(amount);
    }

    receive() external payable {}
}
