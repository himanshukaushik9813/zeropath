// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SolverBondManager
/// @notice Tracks solver collateral and slashing for private settlement failures.
contract SolverBondManager is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    IERC20 public immutable bondToken;
    uint256 public immutable minimumBond;

    mapping(address => uint256) public bonded;
    mapping(address => bool) public solverEnabled;

    event BondDeposited(address indexed solver, uint256 amount);
    event BondWithdrawn(address indexed solver, uint256 amount);
    event SolverStatusUpdated(address indexed solver, bool enabled);
    event SolverSlashed(address indexed solver, address indexed recipient, uint256 amount, bytes32 reason);

    error InsufficientBond();
    error SolverDisabled();

    constructor(IERC20 token, uint256 minBond, address admin) {
        bondToken = token;
        minimumBond = minBond;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SLASHER_ROLE, admin);
    }

    function depositBond(uint256 amount) external {
        bondToken.safeTransferFrom(msg.sender, address(this), amount);
        bonded[msg.sender] += amount;
        if (bonded[msg.sender] >= minimumBond) {
            solverEnabled[msg.sender] = true;
            emit SolverStatusUpdated(msg.sender, true);
        }
        emit BondDeposited(msg.sender, amount);
    }

    function withdrawBond(uint256 amount) external {
        if (bonded[msg.sender] - amount < minimumBond && solverEnabled[msg.sender]) {
            revert InsufficientBond();
        }
        bonded[msg.sender] -= amount;
        bondToken.safeTransfer(msg.sender, amount);
        emit BondWithdrawn(msg.sender, amount);
    }

    function requireSolver(address solver) external view {
        if (!solverEnabled[solver] || bonded[solver] < minimumBond) revert SolverDisabled();
    }

    function slash(address solver, address recipient, uint256 amount, bytes32 reason)
        external
        onlyRole(SLASHER_ROLE)
    {
        uint256 slashAmount = amount > bonded[solver] ? bonded[solver] : amount;
        bonded[solver] -= slashAmount;
        if (bonded[solver] < minimumBond) {
            solverEnabled[solver] = false;
            emit SolverStatusUpdated(solver, false);
        }
        bondToken.safeTransfer(recipient, slashAmount);
        emit SolverSlashed(solver, recipient, slashAmount, reason);
    }
}
