"use client";

import { useId, useRef, useState, useTransition, type JSX } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

import { uploadVendorDocument } from "./actions";
import styles from "./UploadDocument.module.css";

/** The user-facing document kinds — mirrors the server allowlist in actions.ts (server is the gate). */
const DOC_KINDS = [
  { value: "CAPABILITY_STATEMENT", label: "Capability statement" },
  { value: "COI", label: "Certificate of insurance" },
  { value: "W9", label: "W-9" },
  { value: "OTHER", label: "Other" },
] as const;

/**
 * Standalone document upload control (Slice 5). HITL: the upload fires ONLY on explicit submit — never on
 * render or on file-select. 508/AA: the real control is a labeled, keyboard-operable <input type="file">;
 * drag-and-drop is layered ON it (a drop zone that sets the same file state), not a div-onClick. The result
 * is announced via an aria-live region. CSP-strict: the drag "armed" state is a toggled class, never an
 * inline style. On success we router.refresh() so the server re-reads the real documents list.
 */
export function UploadDocument(): JSX.Element {
  const router = useRouter();
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<string>("OTHER");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!file || pending) return;
    setStatus(null);
    const chosen = file;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", chosen);
      fd.set("kind", kind);
      const result = await uploadVendorDocument(fd);
      if (result.ok) {
        setStatus(`Uploaded ${chosen.name}. Format validated.`);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } else {
        setStatus(result.error ?? "Upload failed. Please try again.");
      }
    });
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  return (
    <form className={styles.uploader} onSubmit={onSubmit}>
      <div
        className={dragging ? `${styles.zone} ${styles.dragging}` : styles.zone}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <label htmlFor={inputId} className={styles.zoneLabel}>
          Document file (PDF or DOCX)
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          name="file"
          accept=".pdf,.docx,application/pdf"
          aria-describedby={hintId}
          className={styles.fileInput}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p id={hintId} className={styles.hint}>
          Drag a file here or use the chooser. PDF or DOCX, max 25 MB. Files are checked by content
          (format), not a malware scan.
        </p>
      </div>

      <label className={styles.kindField}>
        <span className={styles.kindLabel}>Document type</span>
        <select
          className={styles.select}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          disabled={pending}
        >
          {DOC_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      <Button type="submit" disabled={!file || pending}>
        {pending ? "Uploading…" : "Upload document"}
      </Button>

      <p className={styles.status} role="status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
