// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title VoucherAirdrop (VULNERABLE) — challenge 06
/// @notice The issuer signs an EIP-712 voucher off-chain; the holder redeems it on-chain.
contract VoucherAirdropVulnerable {
    IERC20 public immutable token;
    address public immutable issuer;

    bytes32 public constant VOUCHER_TYPEHASH = keccak256("Voucher(address to,uint256 amount)");
    // BUG: the domain has no chainId and no verifyingContract.
    bytes32 public immutable DOMAIN_SEPARATOR;

    // BUG: "replay protection" is keyed on the signature bytes, not on the message.
    mapping(bytes32 => bool) public usedSignatures;

    constructor(IERC20 token_, address issuer_) {
        token = token_;
        issuer = issuer_;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(keccak256("EIP712Domain(string name,string version)"), keccak256("VoucherAirdrop"), keccak256("1"))
        );
    }

    function claim(address to, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
        bytes32 sigId = keccak256(abi.encodePacked(r, s, v));
        require(!usedSignatures[sigId], "signature already used");

        bytes32 structHash = keccak256(abi.encode(VOUCHER_TYPEHASH, to, amount));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        // BUG: raw ecrecover accepts both "low-s" and "high-s" forms of the same signature.
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0) && signer == issuer, "bad signature");

        usedSignatures[sigId] = true;
        token.transfer(to, amount);
    }
}
