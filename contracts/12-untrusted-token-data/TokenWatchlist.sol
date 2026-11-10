// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TokenWatchlist — challenge 12
/// @notice Anyone can add a token to the community watchlist shown in the dApp.
/// The contract is not the bug: the bug is the frontend trusting token metadata
/// (name/symbol) that any deployer controls. See app/render.js.
contract TokenWatchlist {
    struct Entry {
        address token;
        address lister;
    }
    Entry[] public entries;

    event Listed(address indexed token, address indexed lister);

    function list(address token) external {
        entries.push(Entry(token, msg.sender));
        emit Listed(token, msg.sender);
    }

    function count() external view returns (uint256) {
        return entries.length;
    }
}
