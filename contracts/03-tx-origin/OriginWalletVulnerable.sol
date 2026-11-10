// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OriginWallet (VULNERABLE) — challenge 03
/// @notice A simple smart wallet owned by Alice.
contract OriginWalletVulnerable {
    address public owner;

    constructor(address owner_) payable {
        owner = owner_;
    }

    function transfer(address payable to, uint256 amount) external {
        // BUG: tx.origin is the EOA that started the transaction, not the direct caller.
        // Any contract Alice interacts with can call this on her behalf.
        require(tx.origin == owner, "not owner");
        to.transfer(amount);
    }

    receive() external payable {}
}
