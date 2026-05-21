"use client";

import { useRef, useState } from "react";

import styles from "./Dropzone.module.css";

type DropzoneProps = {
  title: string;
  description: string;
  accept?: string;
  onFileSelect: (fileList: FileList | null) => void;
};

export function Dropzone({
  title,
  description,
  accept = "image/*",
  onFileSelect,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsHovering(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsHovering(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsHovering(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsHovering(false);
          onFileSelect(event.dataTransfer.files);
        }}
        className={isHovering ? `${styles.zone} ${styles.zoneActive}` : styles.zone}
      >
        <div className={styles.iconWrap}>
          <svg viewBox="0 0 24 24" fill="none" className={styles.icon} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V5" />
            <path d="m7 10 5-5 5 5" />
            <path d="M5 19h14" />
          </svg>
        </div>
        <div className={styles.body}>
          <p className={styles.title}>{title}</p>
          <p className={styles.description}>{description}</p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.input}
        onChange={(event) => {
          onFileSelect(event.target.files);
          event.currentTarget.value = "";
        }}
      />
    </>
  );
}