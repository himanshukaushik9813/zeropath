// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ZeroPathSepoliaEscrow
/// @notice Source-chain (Ethereum Sepolia) escrow for ZeroPath's private
///         cross-chain bridge.
///
/// A depositor locks ETH and records a *commitment* — the Poseidon source-event
/// leaf computed off-chain as:
///
///     Poseidon(secret, amount, assetId, destinationCommitment, routeSalt)
///
/// The ZeroPath relayer reads these commitments (in leaf order), rebuilds the
/// source Merkle tree, and publishes its root to the Stellar settlement
/// contract. A zero-knowledge proof of membership in that tree then releases
/// funds privately on the destination side — no destination address, amount, or
/// route is ever revealed on-chain here. Only the opaque commitment is stored.
///
/// Trust model: this is a relayer-attested bridge. The escrow proves a real
/// on-chain Ethereum deposit occurred; the relayer attests the resulting root to
/// Stellar. Making the root itself trustless on Stellar (a light-client/header
/// proof) is future work.
contract ZeroPathSepoliaEscrow {
    struct DepositRecord {
        uint256 commitment; // Poseidon source-event leaf (BN254 field element)
        address depositor;
        uint256 amount; // wei locked
        uint64 timestamp;
    }

    /// Deposits in insertion order; the array index IS the Merkle leaf index.
    DepositRecord[] public deposits;

    event Deposited(
        uint256 indexed leafIndex,
        uint256 commitment,
        address indexed depositor,
        uint256 amount
    );

    error ZeroValue();
    error ZeroCommitment();

    /// @notice Lock ETH and record its private source-event commitment.
    /// @param commitment Poseidon leaf computed off-chain by the depositor.
    /// @return leafIndex The Merkle leaf index assigned to this deposit.
    function deposit(uint256 commitment) external payable returns (uint256 leafIndex) {
        if (msg.value == 0) revert ZeroValue();
        if (commitment == 0) revert ZeroCommitment();

        leafIndex = deposits.length;
        deposits.push(
            DepositRecord({
                commitment: commitment,
                depositor: msg.sender,
                amount: msg.value,
                timestamp: uint64(block.timestamp)
            })
        );

        emit Deposited(leafIndex, commitment, msg.sender, msg.value);
    }

    /// @notice Number of deposits (== number of source leaves).
    function count() external view returns (uint256) {
        return deposits.length;
    }

    /// @notice All commitments in leaf order — convenience read for the relayer.
    function allCommitments() external view returns (uint256[] memory out) {
        uint256 n = deposits.length;
        out = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = deposits[i].commitment;
        }
    }
}
