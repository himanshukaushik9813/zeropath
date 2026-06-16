// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ZeroPathIntentEscrow
/// @notice Source-chain escrow for private settlement intents.
/// @dev Destination addresses are never stored. Use destinationCommitment only.
contract ZeroPathIntentEscrow is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant SOLVER_ROLE = keccak256("SOLVER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    bytes32 public immutable DOMAIN_SEPARATOR;

    struct Bucket {
        IERC20 token;
        uint256 amount;
        bool enabled;
    }

    struct Intent {
        address token;
        uint64 bucketId;
        bytes32 sourceCommitment;
        bytes32 destinationCommitment;
        bytes32 routeCommitment;
        uint64 deadline;
        uint64 nonce;
    }

    mapping(uint64 => Bucket) public buckets;
    mapping(bytes32 => bool) public usedIntentHashes;
    mapping(bytes32 => bool) public settledIntentHashes;

    event BucketConfigured(uint64 indexed bucketId, address indexed token, uint256 amount, bool enabled);
    event PrivateIntentCommitted(
        bytes32 indexed intentHash,
        uint64 indexed bucketId,
        bytes32 sourceCommitment,
        bytes32 destinationCommitment,
        bytes32 routeCommitment,
        uint64 deadline
    );
    event SolverSettlementAttested(bytes32 indexed intentHash, bytes32 indexed settlementRoot, address indexed solver);
    event EmergencyWithdrawal(address indexed token, address indexed recipient, uint256 amount);

    error BucketDisabled();
    error DeadlineExpired();
    error DuplicateIntent();
    error UnknownIntent();

    constructor(address admin) {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("ZeroPathIntentEscrow(uint256 chainId,address verifyingContract)"),
                block.chainid,
                address(this)
            )
        );

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);
    }

    function configureBucket(uint64 bucketId, IERC20 token, uint256 amount, bool enabled)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        buckets[bucketId] = Bucket({token: token, amount: amount, enabled: enabled});
        emit BucketConfigured(bucketId, address(token), amount, enabled);
    }

    function commitIntent(Intent calldata intent) external nonReentrant whenNotPaused returns (bytes32 intentHash) {
        Bucket memory bucket = buckets[intent.bucketId];
        if (!bucket.enabled) revert BucketDisabled();
        if (block.timestamp > intent.deadline) revert DeadlineExpired();

        intentHash = hashIntent(intent);
        if (usedIntentHashes[intentHash]) revert DuplicateIntent();

        usedIntentHashes[intentHash] = true;
        bucket.token.safeTransferFrom(msg.sender, address(this), bucket.amount);

        emit PrivateIntentCommitted(
            intentHash,
            intent.bucketId,
            intent.sourceCommitment,
            intent.destinationCommitment,
            intent.routeCommitment,
            intent.deadline
        );
    }

    function attestSolverSettlement(bytes32 intentHash, bytes32 settlementRoot)
        external
        onlyRole(SOLVER_ROLE)
        whenNotPaused
    {
        if (!usedIntentHashes[intentHash]) revert UnknownIntent();
        settledIntentHashes[intentHash] = true;
        emit SolverSettlementAttested(intentHash, settlementRoot, msg.sender);
    }

    function hashIntent(Intent calldata intent) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_SEPARATOR,
                intent.token,
                intent.bucketId,
                intent.sourceCommitment,
                intent.destinationCommitment,
                intent.routeCommitment,
                intent.deadline,
                intent.nonce
            )
        );
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function emergencyWithdraw(IERC20 token, address recipient, uint256 amount)
        external
        onlyRole(GUARDIAN_ROLE)
        whenPaused
    {
        token.safeTransfer(recipient, amount);
        emit EmergencyWithdrawal(address(token), recipient, amount);
    }
}
