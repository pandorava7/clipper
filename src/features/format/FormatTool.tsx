"use client";

import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import Image from "next/image";
import { useEffect, useState } from "react";

import { ActionButtons } from "@/src/components/ActionButtons";
import { Dropzone } from "@/src/components/Dropzone";
import { ToolFrame } from "@/src/components/ToolFrame";
import { downloadUrl, loadImageFiles, replaceFileExtension, revokeLoadedImages, revokeObjectUrl, type LoadedImageFile } from "@/src/lib/image-tools";

import styles from "./FormatTool.module.css";

const formatOptions = [
  { id: "image/png", label: "PNG", extension: ".png" },
  { id: "image/jpeg", label: "JPEG", extension: ".jpg" },
  { id: "image/webp", label: "WebP", extension: ".webp" },
];

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function createArchiveName(prefix: string) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  return `${prefix}-${stamp}.zip`;
}

export function FormatTool() {
  const [images, setImages] = useState<LoadedImageFile[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null);
  const [archiveName, setArchiveName] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<{ width: number; height: number; name: string } | null>(null);

  const image = images[0] ?? null;
  const isBatch = images.length > 1;

  useEffect(() => {
    return () => {
      revokeLoadedImages(images);
      revokeObjectUrl(resultUrl);
      revokeObjectUrl(archiveUrl);
    };
  }, [archiveUrl, images, resultUrl]);

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
      revokeObjectUrl(archiveUrl);
      setImages(nextImages);
      setSelectedFormat(null);
      setResultUrl(null);
      setArchiveUrl(null);
      setArchiveName(null);
      setResultImage(null);
      setErrorMessage(null);
    } catch {
      setErrorMessage("图片读取失败，请换一张再试。");
    }
  }

  function resetAll() {
    revokeLoadedImages(images);
    revokeObjectUrl(resultUrl);
    revokeObjectUrl(archiveUrl);
    setImages([]);
    setSelectedFormat(null);
    setResultUrl(null);
    setArchiveUrl(null);
    setArchiveName(null);
    setResultImage(null);
    setErrorMessage(null);
  }

  async function confirmFormatChange() {
    if (!image || !selectedFormat) {
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);

    try {
      const selected = formatOptions.find((option) => option.id === selectedFormat);
      if (!selected) {
        throw new Error("Unknown format.");
      }

      if (isBatch) {
        const zip = new JSZip();

        for (const item of images) {
          const convertedFile = await imageCompression(item.file, {
            useWebWorker: true,
            fileType: selected.id,
            initialQuality: 0.92,
          });

          zip.file(replaceFileExtension(item.name, selected.extension), convertedFile);
        }

        const archiveBlob = await zip.generateAsync({ type: "blob" });
        const nextArchiveUrl = URL.createObjectURL(archiveBlob);
        revokeObjectUrl(resultUrl);
        revokeObjectUrl(archiveUrl);
        setResultUrl(null);
        setResultImage(null);
        setArchiveUrl(nextArchiveUrl);
        setArchiveName(createArchiveName("converted-images"));
        return;
      }

      const convertedFile = await imageCompression(image.file, {
        useWebWorker: true,
        fileType: selected.id,
        initialQuality: 0.92,
      });

      const nextUrl = URL.createObjectURL(convertedFile);
      revokeObjectUrl(resultUrl);
      revokeObjectUrl(archiveUrl);
      setArchiveUrl(null);
      setArchiveName(null);
      setResultUrl(nextUrl);
      setResultImage({
        width: image.naturalWidth,
        height: image.naturalHeight,
        name: replaceFileExtension(image.name, selected.extension),
      });
    } catch {
      setErrorMessage("格式转换失败，请重试。");
    } finally {
      setIsConverting(false);
    }
  }

  const footer = resultUrl && resultImage ? (
    <div className={styles.footerStack}>
      <button type="button" onClick={resetAll} className={styles.secondaryButton}>
        重新选择
      </button>
      <button type="button" onClick={() => downloadUrl(resultUrl, resultImage.name)} className={styles.primaryButton}>
        下载图片
      </button>
    </div>
  ) : archiveUrl && archiveName ? (
    <div className={styles.footerStack}>
      <button type="button" onClick={resetAll} className={styles.secondaryButton}>
        重新选择
      </button>
      <button type="button" onClick={() => downloadUrl(archiveUrl, archiveName)} className={styles.primaryButton}>
        下载 zip
      </button>
    </div>
  ) : image ? (
    <div className={styles.footerStack}>
      <div className={styles.optionGrid}>
        {formatOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelectedFormat(option.id)}
            className={joinClasses(styles.optionButton, selectedFormat === option.id && styles.optionButtonActive)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {selectedFormat ? (
        <ActionButtons
          onCancel={resetAll}
          onConfirm={confirmFormatChange}
          confirmLabel={isConverting ? "转换中" : isBatch ? "批量转换" : "确认"}
          disabled={isConverting}
        />
      ) : null}
    </div>
  ) : null;

  return (
    <ToolFrame title="格式" description="支持单张转换，也支持多张图片批量转换并打包成 zip 下载。" footer={footer} note="转换">
      <div className={styles.panel}>
        <div className={styles.statusRow}>
          <span>{image ? (isBatch ? `已选择 ${images.length} 张图片` : image.name) : "拖入图片或点击上传"}</span>
          <span>
            {resultUrl
              ? "转换完成"
              : archiveUrl
                ? `已打包 ${images.length} 张图片`
                : image
                  ? isBatch
                    ? "选择格式后批量转换"
                    : "先选择格式，再点确认"
                  : "支持 PNG / JPEG / WebP"}
          </span>
        </div>

        <div className={styles.stage}>
          {!image ? (
            <Dropzone
              title="拖入图片开始转换"
              description="支持单张图片转换，也支持多张图片统一转为同一格式并打包下载。"
              multiple
              onFileSelect={(fileList) => {
                void handleFileSelect(fileList);
              }}
            />
          ) : null}

          {image && !resultUrl && !archiveUrl ? (
            <div className={styles.previewWrap}>
              <Image src={image.url} alt="待转换图片" width={image.naturalWidth} height={image.naturalHeight} unoptimized className={styles.previewImage} />
              <div className={styles.previewMeta}>
                <p className={styles.previewTitle}>{isBatch ? "批量模式预览首张图片" : "选择输出格式"}</p>
                <p className={styles.previewDescription}>
                  {isBatch ? "确认后会将全部图片转为同一目标格式，并自动打包为 zip。" : "当前预览保持原图，仅在确认后使用转换插件导出目标格式。"}
                </p>
              </div>
            </div>
          ) : null}

          {resultUrl && resultImage ? (
            <div className={styles.previewWrap}>
              <Image src={resultUrl} alt="转换结果" width={resultImage.width} height={resultImage.height} unoptimized className={styles.previewImage} />
              <div className={styles.previewMeta}>
                <p className={styles.previewTitle}>转换完成</p>
                <p className={styles.previewDescription}>结果已经生成，可以直接下载，或回到上一轮重新选择图片。</p>
              </div>
            </div>
          ) : null}

          {archiveUrl && archiveName ? (
            <div className={styles.previewWrap}>
              <div className={styles.archiveBadge}>{images.length}</div>
              <div className={styles.previewMeta}>
                <p className={styles.previewTitle}>批量转换完成</p>
                <p className={styles.previewDescription}>全部图片已转换为所选格式，并打包为一个 zip 文件供下载。</p>
              </div>
            </div>
          ) : null}
        </div>

        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      </div>
    </ToolFrame>
  );
}