"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { ActionButtons } from "@/src/components/ActionButtons";
import { ColorPicker } from "@/src/components/ColorPicker";
import { Dropzone } from "@/src/components/Dropzone";
import { ToolFrame } from "@/src/components/ToolFrame";
import {
  blobFromCanvas,
  downloadUrl,
  loadImageFile,
  replaceFileExtension,
  revokeObjectUrl,
  type LoadedImageFile,
} from "@/src/lib/image-tools";

import styles from "./BackgroundTool.module.css";

type EyeDropperWindow = Window & typeof globalThis & {
  EyeDropper?: new () => {
    open: () => Promise<{ sRGBHex: string }>;
  };
};

export function BackgroundTool() {
  const sourceUrlRef = useRef<string | null>(null);
  const [image, setImage] = useState<LoadedImageFile | null>(null);
  const [color, setColor] = useState("#F4DEC4");
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState("background-filled.png");
  const [eyeDropperSupported] = useState(
    () => typeof window !== "undefined" && Boolean((window as EyeDropperWindow).EyeDropper),
  );

  useEffect(() => {
    return () => {
      revokeObjectUrl(sourceUrlRef.current);
      revokeObjectUrl(resultUrl);
    };
  }, [resultUrl]);

  async function handleFileSelect(fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("请上传图片文件。");
      return;
    }

    try {
      const nextImage = await loadImageFile(file);
      revokeObjectUrl(sourceUrlRef.current);
      sourceUrlRef.current = nextImage.url;
      revokeObjectUrl(resultUrl);
      setImage(nextImage);
      setResultUrl(null);
      setErrorMessage(null);
      setResultName(replaceFileExtension(file.name, "-background.png"));
    } catch {
      setErrorMessage("图片读取失败，请换一张再试。");
    }
  }

  function resetAll() {
    revokeObjectUrl(sourceUrlRef.current);
    sourceUrlRef.current = null;
    revokeObjectUrl(resultUrl);
    setImage(null);
    setResultUrl(null);
    setErrorMessage(null);
    setColor("#F4DEC4");
  }

  async function handlePickFromScreen() {
    const EyeDropperCtor = (window as EyeDropperWindow).EyeDropper;

    if (!EyeDropperCtor) {
      return;
    }

    try {
      const eyeDropper = new EyeDropperCtor();
      const result = await eyeDropper.open();
      setColor(result.sRGBHex.toUpperCase());
    } catch {
      return;
    }
  }

  async function applyBackground() {
    if (!image) {
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);

    try {
      const htmlImage = new window.Image();
      htmlImage.src = image.url;
      await new Promise<void>((resolve, reject) => {
        htmlImage.onload = () => resolve();
        htmlImage.onerror = () => reject(new Error("Failed to load image."));
      });

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas unavailable.");
      }

      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(htmlImage, 0, 0, canvas.width, canvas.height);

      const blob = await blobFromCanvas(canvas, "image/png");
      const nextUrl = URL.createObjectURL(blob);
      revokeObjectUrl(resultUrl);
      setResultUrl(nextUrl);
    } catch {
      setErrorMessage("背景应用失败，请重试。");
    } finally {
      setIsApplying(false);
    }
  }

  const footer = resultUrl && image ? (
    <div className={styles.footerStack}>
      <button type="button" onClick={resetAll} className={styles.secondaryButton}>
        重新选择
      </button>
      <button type="button" onClick={() => downloadUrl(resultUrl, resultName)} className={styles.primaryButton}>
        下载图片
      </button>
    </div>
  ) : image ? (
    <div className={styles.footerStack}>
      <ColorPicker value={color} onChange={setColor} onPickFromScreen={handlePickFromScreen} eyeDropperSupported={eyeDropperSupported} />
      <ActionButtons onCancel={resetAll} onConfirm={applyBackground} confirmLabel={isApplying ? "处理中" : "确认"} disabled={isApplying} />
    </div>
  ) : null;

  return (
    <ToolFrame title="背景" description="上传透明图片后选择背景色，颜色会直接填充到原本透明的区域。" footer={footer} note="填充">
      <div className={styles.panel}>
        <div className={styles.statusRow}>
          <span>{image ? image.name : "拖入图片或点击上传"}</span>
          <span>{resultUrl ? "背景已应用" : image ? "颜色会实时预览在透明背景下" : "支持滴管取色与精细调色"}</span>
        </div>

        <div className={styles.stage}>
          {!image ? (
            <Dropzone
              title="拖入透明图片开始填色"
              description="上传 PNG 等带透明背景的图片后，可用色盘、RGB 微调与滴管取色。"
              onFileSelect={(fileList) => {
                void handleFileSelect(fileList);
              }}
            />
          ) : null}

          {image && !resultUrl ? (
            <div className={styles.previewWrap}>
              <div className={styles.previewBoard} style={{ backgroundColor: color }}>
                <Image src={image.url} alt="待加背景图片" width={image.naturalWidth} height={image.naturalHeight} unoptimized className={styles.previewImage} />
              </div>
              <div className={styles.previewMeta}>
                <p className={styles.previewTitle}>实时背景预览</p>
                <p className={styles.previewDescription}>当前颜色会铺在图片底层，确认后会导出不再透明的新图片。</p>
              </div>
            </div>
          ) : null}

          {image && resultUrl ? (
            <div className={styles.previewWrap}>
              <div className={styles.previewBoard}>
                <Image src={resultUrl} alt="背景填充结果" width={image.naturalWidth} height={image.naturalHeight} unoptimized className={styles.previewImage} />
              </div>
              <div className={styles.previewMeta}>
                <p className={styles.previewTitle}>背景填充完成</p>
                <p className={styles.previewDescription}>结果已经生成，可以下载，或者返回重新换图和换色。</p>
              </div>
            </div>
          ) : null}
        </div>

        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      </div>
    </ToolFrame>
  );
}