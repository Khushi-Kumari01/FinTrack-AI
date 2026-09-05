/**
 * ReceiptScanner — Full Receipt Scanning, OCR, Confirmation & Save Flow
 *
 * Features:
 * - Camera capture (existing functionality preserved)
 * - Image upload (JPG, JPEG, PNG)
 * - PDF upload (rendered to canvas via pdfjs-dist)
 * - OCR integration with backend /api/receipt/process
 * - AI categorization via existing categorizer.js (backend)
 * - Confirmation/Edit modal before save
 * - Save to MongoDB via /api/receipt/save
 * - Dashboard auto-refresh via onSave callback
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../api/client";

// ─── Supported File Types ─────────────────────────────────────────────────
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const SUPPORTED_PDF_TYPES = ["application/pdf"];
const SUPPORTED_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_PDF_TYPES];

const ACCEPT_STRING = "image/jpeg,image/jpg,image/png,application/pdf";

// ─── Styles (CSS variables for light/dark mode) ────────────────────────
const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
    padding: "16px",
  },
  modal: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "16px",
    padding: "24px",
    maxWidth: "520px",
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "var(--shadow-soft)",
    color: "var(--text)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--text)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-subtle)",
    cursor: "pointer",
    fontSize: "24px",
    padding: "4px 8px",
    borderRadius: "8px",
    lineHeight: 1,
  },
  optionBtn: {
    flex: 1,
    padding: "14px 16px",
    borderRadius: "12px",
    border: "2px dashed var(--border-subtle)",
    backgroundColor: "var(--bg-elevated-soft)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.2s",
    minHeight: "90px",
    justifyContent: "center",
  },
  optionBtnActive: {
    border: "2px solid var(--accent)",
    backgroundColor: "var(--accent-soft)",
  },
  video: {
    width: "100%",
    maxHeight: "360px",
    borderRadius: "12px",
    backgroundColor: "#000",
    objectFit: "contain",
  },
  preview: {
    width: "100%",
    maxHeight: "360px",
    borderRadius: "12px",
    objectFit: "contain",
    backgroundColor: "var(--bg)",
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    marginTop: "12px",
    flexWrap: "wrap",
  },
  primaryBtn: {
    flex: 1,
    padding: "12px 20px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "var(--accent)",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minWidth: "100px",
  },
  secondaryBtn: {
    flex: 1,
    padding: "12px 20px",
    borderRadius: "10px",
    border: "1px solid var(--border-subtle)",
    backgroundColor: "var(--bg-elevated-soft)",
    color: "var(--text)",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minWidth: "100px",
  },
  dangerBtn: {
    flex: 1,
    padding: "12px 20px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "var(--danger)",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minWidth: "100px",
  },
  fieldGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--text-soft)",
    marginBottom: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-subtle)",
    backgroundColor: "var(--bg-elevated-soft)",
    color: "var(--text)",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border 0.2s",
  },
  select: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-subtle)",
    backgroundColor: "var(--bg-elevated-soft)",
    color: "var(--text)",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  errorBox: {
    backgroundColor: "rgba(231, 76, 60, 0.12)",
    border: "1px solid #e74c3c",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "16px",
    color: "#e74c3c",
    fontSize: "13px",
    lineHeight: "1.5",
  },
  warningBox: {
    backgroundColor: "rgba(243, 156, 18, 0.12)",
    border: "1px solid #f39c12",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "16px",
    color: "#f39c12",
    fontSize: "13px",
    lineHeight: "1.5",
  },
  rawText: {
    backgroundColor: "var(--bg)",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "11px",
    color: "var(--text-soft)",
    maxHeight: "100px",
    overflowY: "auto",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    marginTop: "12px",
    border: "1px solid var(--border-subtle)",
  },
  spinner: {
    display: "inline-block",
    width: "20px",
    height: "20px",
    border: "3px solid rgba(0,208,132,0.3)",
    borderTop: "3px solid var(--accent)",
    borderRadius: "50%",
    animation: "receipt-spin 0.8s linear infinite",
    marginRight: "8px",
    verticalAlign: "middle",
  },
  fileHint: {
    fontSize: "11px",
    color: "var(--text-subtle)",
    marginTop: "4px",
  },
  divider: {
    textAlign: "center",
    color: "var(--text-subtle)",
    margin: "8px 0",
    fontSize: "13px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
};

const CATEGORIES = [
  "Food & Dining", "Shopping", "Transport", "Health", "Bills",
  "Income", "Housing", "Entertainment", "Education", "Travel",
  "Groceries", "Investment", "Others",
];

// ─── PDF Rendering ────────────────────────────────────────────────────────

/**
 * Render first page of a PDF file to a canvas and return as base64 data URL.
 * Uses pdfjs-dist.
 */
async function renderPDFToImage(file) {
  const pdfjsLib = await import("pdfjs-dist");
  // Set the worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1); // First page only

  const viewport = page.getViewport({ scale: 2 }); // 2x for quality
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/png");
}

// ─── Confirmation Modal ───────────────────────────────────────────────────

function ConfirmationModal({ data, loading, onConfirm, onEdit, onCancel }) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState({
    merchant: data.merchant || "",
    amount: data.amount != null ? String(data.amount) : "",
    // Parse the ISO date string and extract the local calendar date.
    // Use UTC date parts so a receipt date of "2026-07-20T00:00:00.000Z"
    // is always displayed as 2026-07-20, never shifted to 2026-07-19.
    date: data.date
      ? (() => {
          const d = new Date(data.date);
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, "0");
          const day = String(d.getUTCDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        })()
      : new Date().toISOString().split("T")[0],
    category: data.category || "Others",
  });

const handleFieldChange = (field, value) => {
    setEdited((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Validate required fields client-side before sending
    const amount = parseFloat(edited.amount);
    const merchant = edited.merchant.trim();

    if (!merchant) {
      alert("Please enter a merchant name.");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    onConfirm({
      merchant,
      amount,
      date: new Date(edited.date).toISOString(),
      category: edited.category,
    });
  };

  // Show raw OCR text in collapsed section
  const [showRaw, setShowRaw] = useState(false);
  const hasIssues = data.issues && data.issues.length > 0;

  if (!editing) {
    return (
      <div>
        <h3 style={{ ...styles.title, marginBottom: "20px" }}>
          📋 Confirm Receipt
        </h3>

        {hasIssues && (
          <div style={styles.warningBox}>
            ⚠️ Some fields could not be detected automatically.
            <br />
            Please review and edit if needed.
            <ul style={{ margin: "8px 0 0 0", paddingLeft: "18px", fontSize: "12px" }}>
              {data.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={styles.fieldGroup}>
          <div style={styles.label}>Merchant</div>
          <div style={{ color: "var(--text)", fontSize: "16px", fontWeight: "600" }}>
            {data.merchant || (
              <span style={{ color: "#e74c3c", fontStyle: "italic" }}>
                Not detected
              </span>
            )}
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <div style={styles.label}>Amount</div>
          <div style={{ color: "var(--text)", fontSize: "16px", fontWeight: "600" }}>
            {data.amount != null
              ? `₹${Number(data.amount).toLocaleString("en-IN")}`
              : (
                <span style={{ color: "#e74c3c", fontStyle: "italic" }}>
                  Not detected
                </span>
              )}
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <div style={styles.label}>Category</div>
          <div style={{ color: "var(--text)", fontSize: "16px", fontWeight: "600" }}>
            {data.category || (
              <span style={{ color: "#e74c3c", fontStyle: "italic" }}>
                Not detected
              </span>
            )}
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <div style={styles.label}>Date</div>
          <div style={{ color: "var(--text)", fontSize: "16px", fontWeight: "600" }}>
            {data.date
              ? (() => {
                  const d = new Date(data.date);
                  // Use UTC date parts to avoid timezone shift (IST would push
                  // 2026-07-20T00:00Z to "20 July 2026" correctly, not "19 July 2026")
                  return d.toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  });
                })()
              : (
                <span style={{ color: "#e74c3c", fontStyle: "italic" }}>
                  Not detected
                </span>
              )}
          </div>
        </div>

        {data.rawText && (
          <div
            onClick={() => setShowRaw(!showRaw)}
            style={{
              cursor: "pointer",
              color: "var(--text-subtle)",
              fontSize: "12px",
              marginTop: "8px",
            }}
          >
            {showRaw ? "▼ Hide" : "▶ Show"} raw OCR text
            {showRaw && <div style={styles.rawText}>{data.rawText}</div>}
          </div>
        )}

        <div style={{ ...styles.actionRow, marginTop: "20px" }}>
          <button onClick={onCancel} style={styles.secondaryBtn}>
            ✕ Cancel
          </button>
          <button onClick={() => setEditing(true)} style={{ ...styles.primaryBtn, backgroundColor: "#f39c12" }}>
            ✏️ Edit
          </button>
          <button onClick={handleSave} style={styles.primaryBtn} disabled={loading}>
            {loading ? "⏳ Saving..." : "✅ Confirm"}
          </button>
        </div>
      </div>
    );
  }

  // ── Editing Mode ────────────────────────────────────────
  return (
    <div>
      <h3 style={{ ...styles.title, marginBottom: "20px" }}>
        ✏️ Edit Receipt Details
      </h3>

      {hasIssues && (
        <div style={styles.warningBox}>
          ⚠️ {data.issues.join(". ")}
        </div>
      )}

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Merchant Name</label>
        <input
          style={styles.input}
          value={edited.merchant}
          onChange={(e) => handleFieldChange("merchant", e.target.value)}
          placeholder="e.g. Starbucks Coffee"
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Amount (₹)</label>
        <input
          style={styles.input}
          type="number"
          step="0.01"
          min="0"
          value={edited.amount}
          onChange={(e) => handleFieldChange("amount", e.target.value)}
          placeholder="e.g. 250"
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Category</label>
        <select
          style={styles.select}
          value={edited.category}
          onChange={(e) => handleFieldChange("category", e.target.value)}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Date</label>
        <input
          style={styles.input}
          type="date"
          value={edited.date}
          onChange={(e) => handleFieldChange("date", e.target.value)}
        />
      </div>

      <div style={{ ...styles.actionRow, marginTop: "20px" }}>
        <button onClick={() => setEditing(false)} style={styles.secondaryBtn}>
          ← Back
        </button>
        <button onClick={handleSave} style={styles.primaryBtn} disabled={loading}>
          {loading ? "⏳ Saving..." : "✅ Confirm & Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Main ReceiptScanner Component ─────────────────────────────────────────

export default function ReceiptScanner({ onClose, onSave }) {
  // ── State ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState(null); // "camera" | "upload"
  const [cameraActive, setCameraActive] = useState(false);
  const [imagePreview, setImagePreview] = useState(null); // data URL for preview
  const [file, setFile] = useState(null); // raw file for upload
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [ocrResult, setOcrResult] = useState(null); // parsed OCR data
  const [step, setStep] = useState("choose"); // "choose" | "capture" | "preview" | "confirm"

  // ── Refs ──────────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // ── Cleanup camera on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // ── Camera Functions ─────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please check permissions or use upload instead.");
      setMode("upload");
      setTimeout(() => fileInputRef.current?.click(), 300);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const captureFromCamera = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setImagePreview(dataUrl);
    setStep("preview");
    stopCamera();
  }, [stopCamera]);

  // ── File Upload Handlers ──────────────────────────────────────────────
  const handleFileSelect = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum size is 10MB.");
      return;
    }

    try {
      if (selectedFile.type === "application/pdf") {
        // Render PDF to image
        const dataUrl = await renderPDFToImage(selectedFile);
        setImagePreview(dataUrl);
      } else {
        // Read image as data URL
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(selectedFile);
      }
      setStep("preview");
    } catch (err) {
      console.error("File read error:", err);
      setError("Could not read the file. Please try a different file.");
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // ── OCR Processing ────────────────────────────────────────────────────
  const processImage = async () => {
    if (!imagePreview) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await api.post("/receipt/process", {
        image: imagePreview,
        mimeType: file?.type || "image/jpeg",
      });

      if (response.data?.success) {
        setOcrResult(response.data.data);
        setStep("confirm");
      } else {
        throw new Error(response.data?.message || "OCR processing failed");
      }
    } catch (err) {
      console.error("OCR error:", err);
      const errorMsg = err.response?.data?.message || err.message || "OCR processing failed";
      setError(
        `⚠️ Could not fully analyze the receipt. ${errorMsg}. You can still enter the details manually.`
      );
      // Set partial result with raw data so the user can edit
      setOcrResult({
        merchant: null,
        amount: null,
        date: null,
        category: null,
        rawText: null,
        confidence: "low",
        score: 0,
        issues: [errorMsg],
      });
      setStep("confirm");
    } finally {
      setProcessing(false);
    }
  };

  // ── Save Transaction ───────────────────────────────────────────
  const handleSave = async (data) => {
    // Prevent duplicate saves if user clicks Confirm more than once
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post("/receipt/save", {
        merchant: data.merchant,
        amount: data.amount,
        date: data.date || new Date().toISOString(),
        category: data.category || "Others",
        rawText: ocrResult?.rawText || "",
      });

      if (response.data?.success) {
        // ── SUCCESS PATH ──────────────────────────────────────────────
        // Refresh the dashboard FIRST, then close.
        // Separate the refresh failure from the save result:
        // a dashboard refresh error does NOT mean the save failed.
        if (onSave) {
          try {
            await onSave(response.data.transaction);
          } catch (refreshErr) {
            // Refresh failure is non-fatal — the transaction is already saved.
            console.warn("Dashboard refresh after receipt save failed (non-fatal):", refreshErr);
          }
        }
        onClose();
      } else {
        // Backend returned a non-success body with 2xx status (shouldn't happen)
        throw new Error(response.data?.message || "Save returned non-success status.");
      }
    } catch (err) {
      // ── ERROR PATH ────────────────────────────────────────────────
      // The save API call failed (non-2xx, network error, etc).
      // HOWEVER: MongoDB writes are atomic. The transaction may have been
      // persisted even if the HTTP response was lost (e.g. connection drop
      // after write but before response). Verify by fetching recent transactions.
      console.error("Receipt save error — verifying if transaction was actually persisted:", err);

      let savedDespiteError = false;
      try {
        const verifyRes = await api.get("/transactions", { params: { limit: 5 } });
        const recent = verifyRes.data || [];
        // Check if a transaction matching merchant + approximate amount was just created
        const withinLastMinute = Date.now() - 90 * 1000; // 90s window
        savedDespiteError = recent.some((tx) => {
          const merchantMatch = tx.merchant?.toLowerCase().includes(data.merchant?.toLowerCase() ?? "") ||
                                data.merchant?.toLowerCase().includes(tx.merchant?.toLowerCase() ?? "");
          const amountMatch = Math.abs(Number(tx.amount) - Number(data.amount)) < 0.01;
          const recentEnough = new Date(tx.createdAt || tx.date).getTime() > withinLastMinute;
          return merchantMatch && amountMatch && recentEnough;
        });
      } catch (_) {
        // Verification also failed — assume save did not persist
      }

      if (savedDespiteError) {
        // Transaction IS in the database — refresh and close without showing an error
        console.info("Transaction was actually saved successfully (verified). Closing.");
        if (onSave) {
          try { await onSave(null); } catch (_) {}
        }
        onClose();
        return;
      }

      // Transaction genuinely did not save — keep dialog open, show the error
      setError(
        err.response?.data?.message ||
        err.message ||
        "Failed to save transaction. Please check your connection and try again."
      );
      setLoading(false);
    }
  };

  // ── Retry / Reset ─────────────────────────────────────────────────────
  const handleRetry = () => {
    setStep("choose");
    setImagePreview(null);
    setFile(null);
    setOcrResult(null);
    setError(null);
    setMode(null);
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>🧾 Receipt Scanner</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>

        {/* Error display — shown at all steps including confirm */}
        {error && (
          <div style={styles.errorBox}>
            ❌ {error}
          </div>
        )}

        {/* Step: Choose method */}
        {step === "choose" && (
          <div>
            <p style={{ color: "var(--text-soft)", fontSize: "14px", marginBottom: "20px" }}>
              Choose how you want to add your receipt:
            </p>

            <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
              <button
                onClick={() => {
                  setMode("camera");
                  setStep("capture");
                  startCamera();
                }}
                style={{
                  ...styles.optionBtn,
                  ...(mode === "camera" ? styles.optionBtnActive : {}),
                }}
              >
                <span style={{ fontSize: "32px" }}>📷</span>
                Capture using Camera
                <span style={styles.fileHint}>Point at your receipt and capture</span>
              </button>

              <div style={styles.divider}>
                <span style={{ flex: 1, height: "1px", background: "#444" }} />
                <span>OR</span>
                <span style={{ flex: 1, height: "1px", background: "#444" }} />
              </div>

              <button
                onClick={() => {
                  setMode("upload");
                  triggerFileUpload();
                }}
                style={{
                  ...styles.optionBtn,
                  ...(mode === "upload" ? styles.optionBtnActive : {}),
                }}
              >
                <span style={{ fontSize: "32px" }}>📁</span>
                Upload Image / PDF
                <span style={styles.fileHint}>
                  JPG, JPEG, PNG, PDF accepted (max 10MB)
                </span>
              </button>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept={ACCEPT_STRING}
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Step: Camera capture */}
        {step === "capture" && (
          <div>
            <video
              ref={videoRef}
              style={styles.video}
              playsInline
              autoPlay
            />
            <div style={styles.actionRow}>
              <button onClick={captureFromCamera} style={styles.primaryBtn}>
                📸 Capture
              </button>
              <button
                onClick={() => {
                  stopCamera();
                  setStep("choose");
                }}
                style={styles.secondaryBtn}
              >
                ✖ Cancel
              </button>
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        )}

        {/* Step: Preview + Process */}
        {step === "preview" && imagePreview && (
          <div>
            <img src={imagePreview} alt="Receipt preview" style={styles.preview} />

            {error && <div style={styles.errorBox}>❌ {error}</div>}

            <div style={styles.actionRow}>
              <button
                onClick={() => {
                  stopCamera();
                  setStep("choose");
                  setImagePreview(null);
                  setFile(null);
                }}
                style={styles.secondaryBtn}
              >
                ← Retake / Choose
              </button>
              <button
                onClick={processImage}
                style={styles.primaryBtn}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <span style={styles.spinner} />
                    Analyzing...
                  </>
                ) : (
                  "🔍 Analyze Receipt"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step: Confirmation */}
        {step === "confirm" && ocrResult && (
          <div>
            {processing ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div
                  style={{
                    ...styles.spinner,
                    width: "40px",
                    height: "40px",
                    borderWidth: "4px",
                    display: "block",
                    margin: "0 auto 16px",
                  }}
                />
                <p style={{ color: "#aaa" }}>Analyzing receipt with OCR...</p>
              </div>
            ) : (
              <ConfirmationModal
                data={ocrResult}
                loading={loading}
                onConfirm={handleSave}
                onCancel={() => {
                  stopCamera();
                  onClose();
                }}
              />
            )}
          </div>
        )}

        {/* Loading overlay for save */}
        {loading && (
          <div style={{ textAlign: "center", padding: "12px", color: "#00d084" }}>
            ⏳ Saving transaction...
          </div>
        )}

        {/* Retry button if error on confirm step */}
        {step === "confirm" && error && !processing && (
          <div style={{ marginTop: "12px" }}>
            <button onClick={handleRetry} style={styles.secondaryBtn}>
              🔄 Try Again
            </button>
          </div>
        )}
      </div>

      {/* Inject global spinner keyframes */}
      <style>{`
        @keyframes receipt-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

