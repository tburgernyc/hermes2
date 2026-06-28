"use client";

/**
 * Client form for minting a VENDOR_INVITE link. Uses useActionState so the server action can return the
 * one-time link (we persist only its hash, so it is shown here exactly once). Copy-link delivery: the
 * admin sends it through their own channel — zero automated outbound (CLAUDE.md §2).
 */
import type { JSX } from "react";
import { useActionState } from "react";

import { Select } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import { inviteVendorUser } from "./actions";

interface VendorOption {
  id: string;
  companyName: string;
}

export function InviteForm({ vendors }: { vendors: VendorOption[] }): JSX.Element {
  const [state, action, pending] = useActionState(inviteVendorUser, { ok: false });

  return (
    <form action={action}>
      <div className={c.formGrid}>
        <Select label="Vendor" name="vendorId" required defaultValue="">
          <option value="" disabled>
            Select a vetted vendor
          </option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.companyName}
            </option>
          ))}
        </Select>
        <Field
          label="Email"
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder="contact@vendor.example"
        />
      </div>
      <Button type="submit" disabled={pending}>
        Create invite link
      </Button>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.link ? (
        <div data-testid="invite-link">
          <p className={c.meta}>
            Single-use invite link for {state.email} (copy + send it to the vendor):
          </p>
          <code className={c.inviteLink}>{state.link}</code>
        </div>
      ) : null}
    </form>
  );
}
