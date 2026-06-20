import type { JSX, ReactNode } from "react";

import { Brand } from "./Brand";
import styles from "./AuthScreen.module.css";

interface AuthScreenProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

/**
 * Centered auth/onboarding screen: the studio background with a single glass card carrying the brand
 * mark, an <h1> title, an optional subtitle, and the page's form/content. Used by login, the TOTP pages,
 * and the invite-accept page. The <h1> is the page heading the e2e specs assert on.
 */
export function AuthScreen({ title, subtitle, children }: AuthScreenProps): JSX.Element {
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <Brand />
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {children}
      </div>
    </main>
  );
}
