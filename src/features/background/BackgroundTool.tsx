"use client";

import JSZip from "jszip";
import Image from "next/image";
import { useEffect, useState } from "react";

import { ActionButtons } from "@/src/components/ActionButtons";
import { ColorPicker } from "@/src/components/ColorPicker";
import { Dropzone } from "@/src/components/Dropzone";
import { ToolFrame } from "@/src/components/ToolFrame";
import {
  blobFromCanvas,
  downloadUrl,
  loadImageFiles,
  replaceFileExtension,
  revokeLoadedImages,
  revokeObjectUrl,
  type LoadedImageFile,
} from "@/src/lib/image-tools";

import styles from "./BackgroundTool.module.css";

type EyeDropperWindow = Window & typeof globalThis & {
  EyeDropper?: new () => {
    open: () => Promise<{ sRGBHex: string }>;
  };
};

type BatchArchive = {
  url: string;
  name: string;
  count: number;
};

function createArchiveName(prefix: string) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  return `${prefix}-${stamp}.zip`;
}

async function loadCanvasSource(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = url;
  });
}

async function applyBackgroundToBlob(image: LoadedImageFile, color: string) {
  const source = await loadCanvasSource(image.url);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas unavailable.");
  }

  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  return {
    blob: await blobFromCanvas(canvas, "image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

export function BackgroundTool() {
  const [images, setImages] = useState<LoadedImageFile[]>([]);
  const [color, setColor] = useState("#F4DEC4");
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [archive, setArchive] = useState<BatchArchive | null>(null);
  const [resultName, setResultName] = useState("background-filled.png");
  const [eyeDropperSupported] = useState(
    () => typeof window !== "undefined" && Boolean((window as EyeDropperWindow).EyeDropper),
  );

  const image = images[0] ?? null;
  const isBatch = images.length > 1;

  useEffect(() => {
    return () => {
      revokeLoadedImages(images);
      revokeObjectUrl(resultUrl);
      revokeObjectUrl(archive?.url);
    };
  }, [archive?.url, images, resultUrl]);

  async function handleFileSelect(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    const files = Array.from(fileList);

    if (files.some((file) => !file.type.startsWith("image/"))) {
      setErrorMessage("请上传图片文件。");
      return;
    }

    try {
      const nextImages = await loadImageFiles(files);
      revokeLoadedImages(images);
      revokeObjectUrl(resultUrl);
      revokeObjectUrl(archive?.url);
      setImages(nextImages);
      setResultUrl(null);
      setArchive(null);
      setErrorMessage(null);
      setResultName(replaceFileExtension(files[0].name, "-background.png"));
    } catch {
      setErrorMessage("图片读取失败，请换一张再试。");
    }
  }

  function resetAll() {
    revokeLoadedImages(images);
    revokeObjectUrl(resultUrl);
    revokeObjectUrl(archive?.url);
    setImages([]);
    setResultUrl(null);
    setArchive(null);
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
      if (isBatch) {
        const zip = new JSZip();

        for (const item of images) {
          const { blob } = await applyBackgroundToBlob(item, color);
          zip.file(replaceFileExtension(item.name, "-background.png"), blob);
        }

        const archiveBlob = await zip.generateAsync({ type: "blob" });
        const nextArchiveUrl = URL.createObjectURL(archiveBlob);
        revokeObjectUrl(resultUrl);
        revokeObjectUrl(archive?.url);
        setResultUrl(null);
        setArchive({
          url: nextArchiveUrl,
          name: createArchiveName("background-filled-images"),
          count: images.length,
        });
        return;
      }

      const { blob } = await applyBackgroundToBlob(image, color);
      const nextUrl = URL.createObjectURL(blob);
      revokeObjectUrl(resultUrl);
      revokeObjectUrl(archive?.url);
      setArchive(null);
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
  ) : archive ? (
    <div className={styles.footerStack}>
      <button type="button" onClick={resetAll} className={styles.secondaryButton}>
        重新选择
      </button>
      <button type="button" onClick={() => downloadUrl(archive.url, archive.name)} className={styles.primaryButton}>
        下载 zip
      </button>
    </div>
  ) : image ? (
    <div className={styles.footerStack}>
      <ColorPicker value={color} onChange={setColor} onPickFromScreen={handlePickFromScreen} eyeDropperSupported={eyeDropperSupported} />
      <ActionButtons
        onCancel={resetAll}
        onConfirm={applyBackground}
        confirmLabel={isApplying ? "处理中" : isBatch ? "批量填色" : "确认"}
        disabled={isApplying}
      />
    </div>
  ) : null;

  return (
    <ToolFrame title="背景" description="支持单张透明图填色，也支持多张图片统一填色并打包成 zip 下载。" footer={footer} note="填充">
      <div className={styles.panel}>
        <div className={styles.statusRow}>
          <span>{image ? (isBatch ? `已选择 ${images.length} 张图片` : image.name) : "拖入图片或点击上传"}</span>
          <span>
            {resultUrl
              ? "背景已应用"
              : archive
                ? `已打包 ${archive.count} 张图片`
                : image
                  ? isBatch
                    ? "统一颜色后批量填色"
                    : "颜色会实时预览在透明背景下"
                  : "支持滴管取色与精细调色"}
          </span>
        </div>

        <div className={styles.stage}>
          {!image ? (
            <Dropzone
              title="拖入透明图片开始填色"
              description="支持单张透明图填色，也支持多张图片统一选择颜色后批量导出。"
              multiple
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
                <p className={styles.previewTitle}>{isBatch ? "批量模式预览首张图片" : "实时背景预览"}</p>
                <p className={styles.previewDescription}>
                  {isBatch ? "当前颜色会统一应用到全部图片底层，并在确认后打包为 zip。" : "当前颜色会铺在图片底层，确认后会导出不再透明的新图片。"}
                </p>
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

          {archive ? (
            <div className={styles.previewWrap}>
              <div className={styles.archiveBadge}>{archive.count}</div>
              <div className={styles.previewMeta}>
                <p className={styles.previewTitle}>批量填色完成</p>
                <p className={styles.previewDescription}>全部图片已应用当前背景色，并打包为一个 zip 文件供下载。</p>
              </div>
            </div>
          ) : null}
        </div>

        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      </div>
    </ToolFrame>
  );
}