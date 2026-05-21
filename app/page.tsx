import Image from "next/image";
import Link from "next/link";

import backgroundIcon from "@/src/icons/paint-bucket-svgrepo-com.svg";
import cropIcon from "@/src/icons/crop-simple-svgrepo-com.svg";
import formatIcon from "@/src/icons/convertshape-svgrepo-com.svg";

import styles from "./page.module.css";

const entries = [
  {
    href: "/crop",
    label: "裁剪",
    description: "常见比例、拖动边缘与自由裁切。",
    icon: cropIcon,
  },
  {
    href: "/format",
    label: "格式",
    description: "上传后转换为 PNG、JPEG 或 WebP。",
    icon: formatIcon,
  },
  {
    href: "/background",
    label: "背景",
    description: "给透明图片填充纯色背景并导出。",
    icon: backgroundIcon,
  },
];

export default function Home() {
  return (
    <main className={styles.viewport}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Clipper</p>
          <h1 className={styles.title}>图片工具入口</h1>
          <p className={styles.description}>统一的米白配色与移动端布局，后续新增工具也沿用这套外壳和基础组件。</p>
        </header>

        <section className={styles.grid}>
          {entries.map((entry) => (
            <Link key={entry.href} href={entry.href} className={styles.card}>
              <div className={styles.iconWrap}>
                <Image src={entry.icon} alt="" width={44} height={44} className={styles.icon} />
              </div>
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{entry.label}</h2>
                <p className={styles.cardDescription}>{entry.description}</p>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
