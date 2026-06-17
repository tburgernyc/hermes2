"use client";

/**
 * Client form for minting a VENDOR_INVITE link. Uses useActionState so the server action can return the
 * one-time link (we persist only its hash, so it is shown here exactly once). Copy-link delivery: the
 * admin sends it through their own channel — zero automated outbound (CLAUDE.md §2).
 */
import type { JSX } from "react";
import { useActionState } from "react";

import { inviteVendorUser } from "./actions";

interface VendorOption {
  id: string;
  companyName: string;
}

export function InviteForm({ vendors }: { vendors: VendorOption[] }): JSX.Element {
  const [state, action, pending] = useActionState(inviteVendorUser, { ok: false });

  return (
    <form action={action}>
      <label>
        Vendor{" "}
        <select name="vendorId" required defaultValue="">
          <option value="" disabled>
            Select a vetted vendor
          </option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.companyName}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        Email{" "}
        <input name="email" type="email" required maxLength={254} placeholder="contact@vendor.example" />
      </label>{" "}
      <button type="submit" disabled={pending}>
        Create invite link
      </button>

      {state.error ? (
        <p role="alert" style={{ color: "#b00" }}>
          {state.error}
        </p>
      ) : null}
      {state.ok && state.link ? (
        <p data-testid="invite-link">
          Single-use invite link for {state.email} (copy + send it to the vendor):
          <br />
          <code style={{ wordBreak: "break-all" }}>{state.link}</code>
        </p>
      ) : null}
    </form>
  );
}
