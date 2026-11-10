// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Bounty (SECURE) — challenge 09
/// @notice Commit-reveal. The commitment binds the answer to the committer's address,
/// and the reveal must be in a later block than the commit.
contract BountySecure {
    bytes32 public immutable answerHash;
    address public winner;

    mapping(address => bytes32) public commitments;
    mapping(address => uint256) public commitBlock;

    constructor(bytes32 answerHash_) payable {
        answerHash = answerHash_;
    }

    /// @param c keccak256(abi.encode(answer, salt, msg.sender))
    function commit(bytes32 c) external {
        commitments[msg.sender] = c;
        commitBlock[msg.sender] = block.number;
    }

    function reveal(string calldata answer, bytes32 salt) external {
        require(winner == address(0), "already solved");
        require(commitments[msg.sender] != bytes32(0), "no commitment");
        require(block.number > commitBlock[msg.sender], "reveal in a later block");
        require(keccak256(abi.encode(answer, salt, msg.sender)) == commitments[msg.sender], "commitment mismatch");
        require(keccak256(bytes(answer)) == answerHash, "wrong answer");
        winner = msg.sender;
        payable(msg.sender).transfer(address(this).balance);
    }
}
