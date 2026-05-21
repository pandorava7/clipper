import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./ToolFrame.module.css";

type ToolFrameProps = {
  title: string;
  description: string;
  eyebrow?: string;
  note?: string;
  backHref?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function ToolFrame({
  title,
  description,
  eyebrow = "Clipper",
  note = "PWA",
  backHref = "/",
  footer,
  children,
}: ToolFrameProps) {
  return (
    <main className={styles.viewport}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <Link href={backHref} className={styles.backLink}>
              返回
            </Link>
            <div className={styles.titleBlock}>
              <p className={styles.eyebrow}>{eyebrow}</p>
              <h1 className={styles.title}>{title}</h1>
              <p className={styles.description}>{description}</p>
            </div>
          </div>
          <div className={styles.note}>{note}</div>
        </header>

        <section className={styles.content}>{children}</section>

        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </main>
  );
}