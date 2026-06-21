"use client";

import { useEffect, useRef, useState, type JSX } from "react";

import styles from "./ReleaseGate.module.css";

const HOLD_MS = 1500;

interface ReleaseGateProps {
  /** How many vendors the completed hold will contact (for the accessible label). */
  vendorCount: number;
  /** Disabled while any low-confidence row is unconfirmed, a send is in flight, or already sent. */
  disabled: boolean;
  /** The cohort has been sent — lock the control and show the done label. */
  sent: boolean;
  /** Fires ONCE on a completed 1.5s hold (pointer OR keyboard). Releasing early never calls this. */
  onComplete: () => void;
}

/**
 * Press-and-hold release gate (HITL §3). The cohort is sent ONLY when a 1.5s hold completes; releasing
 * early cancels and sends nothing. CSP-strict: the progress fill is a CSS-Module @keyframes toggled by a
 * class — NEVER a per-frame inline style. 508/AA: fully keyboard-operable (Space/Enter hold), pointer +
 * touch paths, a descriptive aria-label, and a disabled state that blocks activation until prerequisites
 * clear. Completion is driven by a timer (not animationend), so it stays correct under prefers-reduced-motion
 * where the animated fill is suppressed.
 */
export function ReleaseGate({ vendorCount, disabled, sent, onComplete }: ReleaseGateProps): JSX.Element {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer(): void {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  // Belt-and-suspenders: never leave a timer running if the component unmounts mid-hold.
  useEffect(() => clearTimer, []);

  function begin(): void {
    if (disabled || sent || timer.current !== null) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onComplete();
    }, HOLD_MS);
  }

  function cancel(): void {
    clearTimer();
    setHolding(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault(); // stop Space from scrolling / Enter from re-firing on key-repeat
    if (!event.repeat) begin();
  }

  function onKeyUp(event: React.KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    cancel();
  }

  const label = sent ? "Outreach sent ✓" : "Hold to approve & send";

  return (
    <button
      type="button"
      className={holding ? `${styles.gateBtn} ${styles.holding}` : styles.gateBtn}
      disabled={disabled || sent}
      aria-label={`Press and hold for 1.5 seconds to approve and send outreach to ${vendorCount} ${
        vendorCount === 1 ? "vendor" : "vendors"
      }. Releasing early cancels and sends nothing.`}
      onMouseDown={begin}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={begin}
      onTouchEnd={cancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <span className={styles.gateFill} aria-hidden="true" />
      <span className={styles.gateLabel}>{label}</span>
    </button>
  );
}
