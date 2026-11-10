// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Bounty (VULNERABLE) — challenge 09
/// @notice First person to submit the preimage of `answerHash` wins the ETH.
contract BountyVulnerable {
    bytes32 public immutable answerHash;
    address public winner;

    constructor(bytes32 answerHash_) payable {
        answerHash = answerHash_;
    }

    // BUG: the answer travels in plaintext through the public mempool.
    function solve(string calldata answer) external {
        require(winner == address(0), "already solved");
        require(keccak256(bytes(answer)) == answerHash, "wrong answer");
        winner = msg.sender;
        payable(msg.sender).transfer(address(this).balance);
    }
}
