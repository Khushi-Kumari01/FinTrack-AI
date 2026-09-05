import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { api } from "../api/client";

const UpgradeButton = () => {
  const { token } = useContext(AuthContext);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get("/payment/status")
      .then(({ data }) => setIsPremium(Boolean(data.isPremium)))
      .catch(() => setIsPremium(false));
  }, [token]);

  const startPayment = async () => {
    if (isPremium) return;   // already premium — button is purely informational
    if (!window.Razorpay) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Unable to load Razorpay checkout"));
        document.body.appendChild(script);
      });
    }

    const { data: order } = await api.post("/payment/create-order", { amount: 199 });

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,     // 19900 paise = ₹199
      currency: "INR",
      order_id: order.id,
      name: "FinTrack",
      description: "FinTrack Premium — ₹199 one-time",
      theme: { color: "#0ea5e9" },

      // prefill: pre-populate the checkout form fields.
      // Leave contact/email blank so any test account can be used.
      //
      // Razorpay TEST MODE payment method reference:
      //
      //   CARDS (Indian domestic):
      //     4100 2800 0000 1007  Visa Debit       — any future expiry, any CVV
      //     5555 5100 0008 1006  Mastercard Credit — any future expiry, any CVV
      //     6527 6589 0000 1005  RuPay Credit      — any future expiry, any CVV
      //     5241 8100 0000 0000  Mastercard (EMI)  — any future expiry, any CVV
      //     On the OTP screen, enter any value to confirm.
      //
      //   NETBANKING: select any listed bank → Razorpay mock page → Success/Failure.
      //
      //   WALLET: select any listed wallet → Razorpay mock page → Success/Failure.
      //
      //   UPI — IMPORTANT (as of 28 Feb 2026):
      //     NPCI sunset the UPI Collect flow (manual VPA/UPI-ID entry) on 28 Feb 2026.
      //     Razorpay Standard Checkout now shows UPI Intent (mobile) / Dynamic QR (desktop).
      //     The previously documented test credentials success@razorpay / failure@razorpay
      //     only work with the now-deprecated UPI Collect flow and can no longer be used.
      //     Scanning the Test Mode QR with real Google Pay/PhonePe will fail ("Invalid QR")
      //     because UPI Intent/QR is a LIVE MODE feature — not supported in Test Mode.
      //     Razorpay's own documentation confirms: "Test Mode for UPI Collect; Live Mode
      //     for UPI Intent and QR payments."
      //     → UPI cannot be tested through Standard Checkout in Test Mode as of 2026.
      //     → Use Cards or Netbanking for Test Mode payment verification instead.
      prefill: {
        contact: "",
        email: "",
      },

      handler: async function (response) {
        // response contains razorpay_order_id, razorpay_payment_id, razorpay_signature
        // sent directly to our backend for HMAC-SHA256 signature verification
        const { data } = await api.post("/payment/verify", response);
        setIsPremium(Boolean(data.premium?.isPremium));
        alert("Payment Successful 🎉");
      },
    };

    const rzp = new Razorpay(options);
    rzp.open();
  };

  return (
    <button
      className="upgrade-btn"
      onClick={startPayment}
      // When Premium is already active, remove pointer cursor so the button
      // clearly communicates it is a status indicator, not a clickable action.
      style={isPremium ? { cursor: "default" } : undefined}
      title={isPremium ? "Your FinTrack Premium subscription is active." : "Upgrade to FinTrack Premium for ₹199"}
    >
      {isPremium ? "Premium Active ✅" : "Upgrade to Premium 🚀"}
    </button>
  );
};

export default UpgradeButton;
