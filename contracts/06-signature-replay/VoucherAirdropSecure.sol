// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title VoucherAirdrop (SECURE) — challenge 06
/// @notice Domain binds chainId + this contract (OZ EIP712); the message binds a per-user
/// nonce and a deadline; OZ ECDSA rejects malleable high-s signatures.
contract VoucherAirdropSecure is EIP712 {
    IERC20 public immutable token;
    address public immutable issuer;

    bytes32 public constant VOUCHER_TYPEHASH =
        keccak256("Voucher(address to,uint256 amount,uint256 nonce,uint256 deadline)");
    mapping(address => uint256) public nonces;

    constructor(IERC20 token_, address issuer_) EIP712("VoucherAirdrop", "2") {
        token = token_;
        issuer = issuer_;
    }

    function claim(address to, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(block.timestamp <= deadline, "voucher expired");
        bytes32 structHash = keccak256(abi.encode(VOUCHER_TYPEHASH, to, amount, nonces[to], deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s);
        require(signer == issuer, "bad signature");
        nonces[to]++; // the same message can never verify twice
        token.transfer(to, amount);
    }
}
