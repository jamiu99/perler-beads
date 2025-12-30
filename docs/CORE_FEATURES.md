# 拼豆图生成器 - 核心功能文档

## 目录
1. [功能概览](#功能概览)
2. [核心算法](#核心算法)
3. [数据结构](#数据结构)
4. [功能模块详解](#功能模块详解)
5. [技术实现要点](#技术实现要点)

---

## 功能概览

### 已实现功能列表

#### 1. 图像处理
- ✅ 图片上传（拖放/点击）
- ✅ 支持 JPG/PNG 格式
- ✅ 自适应图像尺寸
- ✅ 可调节像素化粒度（横向格子数量）
- ✅ 双模式像素化算法
  - 卡通模式（主导色 Dominant Color）
  - 真实模式（平均色 Average Color）

#### 2. 智能色彩处理
- ✅ 多色板支持（168色、144色、96色等）
- ✅ 五种店家色号体系
  - MARD
  - COCO
  - 漫漫
  - 盼盼
  - 咪小窝
- ✅ **CIEDE2000 感知色差颜色映射**（使用 color-diff 库）
- ✅ 相似颜色智能合并（可调阈值）
- ✅ 背景自动移除
- ✅ 颜色排除与重映射
- ✅ 自定义色板编辑

#### 3. 交互预览
- ✅ 实时像素化预览
- ✅ 悬停显示色号（桌面）
- ✅ 长按显示色号（移动）
- ✅ 网格线显示
- ✅ 外部背景标记（浅灰色）
- ✅ 手动编辑功能
  - 画笔工具
  - 橡皮擦
  - 填充工具
  - 吸管工具
  - 撤销/重做

#### 4. 统计与导出
- ✅ 实时颜色统计
- ✅ 每种颜色用量计算
- ✅ 总珠子数统计
- ✅ 下载带 Key 的图纸（PNG）
- ✅ 下载颜色统计图（PNG）
- ✅ 导出/导入 CSV 数据
- ✅ 可选功能
  - 网格线开关
  - 网格间隔调节
  - 坐标轴显示
  - 网格线颜色选择
  - 统计信息包含

#### 5. 专注拼豆模式
- ✅ 游戏化制作指导
- ✅ 进度追踪
- ✅ 区域完成标记
- ✅ 放大镜工具
- ✅ 颜色高亮
- ✅ 完成动画

---

## 核心算法

### 1. 图像加载与网格划分

**输入：**
- 用户上传的图片
- 粒度参数 N（横向格子数）

**处理流程：**
```javascript
1. 加载图片到 Canvas
2. 根据粒度 N 和图片宽高比计算 M（纵向格子数）
   M = Math.round((imgHeight / imgWidth) * N)
3. 计算每个单元格的尺寸
   cellWidth = imgWidth / N
   cellHeight = imgHeight / M
```

**输出：**
- N x M 网格尺寸
- 原始图像 ImageData

---

### 2. 初始颜色映射（基于主导色）

**核心思想：** 消除"黑色毛边"问题，改用主导色而非平均色

**算法步骤：**
```javascript
function calculateCellRepresentativeColor(imageData, startX, startY, width, height, mode) {
  // 模式1: Dominant（卡通模式）- 找出现频率最高的像素颜色
  if (mode === 'Dominant') {
    const colorCounts = {}
    let maxCount = 0
    let dominantColor = null

    遍历单元格内所有像素 {
      忽略透明像素(alpha < 128)
      统计每个 RGB 值的出现次数
      更新 dominantColor 为出现次数最多的颜色
    }
    return dominantColor
  }

  // 模式2: Average（真实模式）- 计算平均色
  else {
    累加所有非透明像素的 RGB 值
    return 平均值
  }
}

// 颜色映射到色板 - 使用 color-diff 库
import * as colorDiff from 'color-diff';

function findClosestPaletteColor(targetRgb, palette) {
  // 转换到 color-diff 格式 (大写 R, G, B)
  const targetColor = { R: targetRgb.r, G: targetRgb.g, B: targetRgb.b };

  // 转换色板
  const paletteColors = palette.map(color => ({
    R: color.rgb.r,
    G: color.rgb.g,
    B: color.rgb.b,
    original: color  // 保持原始数据引用
  }));

  // 使用 CIEDE2000 算法找到最接近的颜色
  const closestColor = colorDiff.closest(targetColor, paletteColors);

  return closestColor.original;
}
```

**关键优化：**
- 使用主导色而非平均色，避免毛边问题
- **使用 CIEDE2000 算法**计算颜色差异，符合人眼感知
- color-diff 库内部使用 LAB 色彩空间，比 RGB 欧氏距离更准确
- 避免了绿色系和红色系等不同色相的感知偏差

---

### 3. 区域颜色合并（基于相似度）

**核心思想：** 消除"杂色"问题，合并相似颜色的连通区域

**算法：广度优先搜索（BFS）**
```javascript
function mergeColorRegions(initialMappedData, similarityThreshold) {
  const visited = new Set()
  const mergedData = cloneData(initialMappedData)

  遍历所有单元格(row, col) {
    if (!visited.has(cell)) {
      // BFS 查找相似颜色的连通区域
      region = findSimilarConnectedRegion(row, col, similarityThreshold)

      // 统计区域内各色号出现次数
      colorCounts = countColorsInRegion(region)

      // 找出出现次数最多的色号
      dominantKey = getMostFrequentColorKey(colorCounts)

      // 将整个区域统一设置为主导色号
      region.forEach(cell => {
        mergedData[cell.row][cell.col] = paletteColorByKey[dominantKey]
        visited.add(cell)
      })
    }
  }

  return mergedData
}

function findSimilarConnectedRegion(startRow, startCol, threshold) {
  const queue = [{row: startRow, col: startCol}]
  const region = []
  const startColor = data[startRow][startCol].color

  while (queue.length > 0) {
    const {row, col} = queue.shift()

    检查边界
    if (已访问 || 越界) continue

    const currentColor = data[row][col].color

    // 检查颜色相似度（欧氏距离）
    if (colorDistance(startColor, currentColor) < threshold) {
      region.push({row, col})
      标记为已访问

      // 添加四个方向的邻居
      queue.push(上下左右四个相邻单元格)
    }
  }

  return region
}
```

**参数说明：**
- `similarityThreshold`: 颜色相似度阈值（欧氏距离）
  - 推荐范围：0-100
  - 值越小，合并越保守
  - 值越大，合并越激进

---

### 4. 背景移除（基于边界填充）

**核心思想：** 从边界开始洪水填充，标记外部背景区域

**算法：洪水填充（Flood Fill）**
```javascript
const BACKGROUND_COLOR_KEYS = ['T1', 'H1']  // 定义背景色号

function removeBackground(mergedData) {
  const M = mergedData.length
  const N = mergedData[0].length
  const visited = new Set()

  // 从所有边界单元格开始
  const boundaryQueue = []

  // 添加所有边界单元格
  for (let i = 0; i < N; i++) {
    boundaryQueue.push({row: 0, col: i})        // 顶部
    boundaryQueue.push({row: M-1, col: i})      // 底部
  }
  for (let j = 1; j < M-1; j++) {
    boundaryQueue.push({row: j, col: 0})        // 左侧
    boundaryQueue.push({row: j, col: N-1})      // 右侧
  }

  // 洪水填充
  while (boundaryQueue.length > 0) {
    const {row, col} = boundaryQueue.shift()

    if (visited.has(`${row},${col}`) || 越界) continue

    const cellKey = mergedData[row][col].key

    // 检查是否是背景颜色
    if (BACKGROUND_COLOR_KEYS.includes(cellKey)) {
      // 标记为外部
      mergedData[row][col].isExternal = true
      visited.add(`${row},${col}`)

      // 添加相邻单元格
      boundaryQueue.push(上下左右四个相邻单元格)
    }
  }

  return mergedData
}
```

**效果：**
- 边界的背景色被标记为 `isExternal: true`
- 统计和下载时忽略这些外部单元格
- 预览时显示为浅灰色

---

### 5. 颜色排除与重映射

**核心思想：** 用户手动排除杂色后，智能重映射到最近似的可用颜色

**算法：**
```javascript
function excludeColor(keyToExclude, mappedPixelData, excludedColors) {
  // 1. 确定重映射目标调色板
  const targetPalette = 获取当前存在且未被排除的所有颜色()

  // 2. 验证排除操作的有效性
  if (targetPalette为空) {
    alert("不能排除此颜色，否则无颜色可用")
    return
  }

  // 3. 重映射所有使用该颜色的单元格
  遍历所有单元格 {
    if (cell.key === keyToExclude && !cell.isExternal) {
      // 找到targetPalette中最接近的颜色
      const closestColor = findClosestPaletteColor(cell.rgb, targetPalette)
      cell.key = closestColor.key
      cell.color = closestColor.hex
    }
  }

  // 4. 更新排除列表
  excludedColors.add(keyToExclude)
}

function restoreColor(keyToRestore, excludedColors) {
  // 移除排除标记
  excludedColors.delete(keyToRestore)

  // 触发完整重新处理流程
  重新执行：图像加载 -> 颜色映射 -> 区域合并 -> 背景移除
}
```

**关键点：**
- 重映射时只在"已存在的颜色"中查找替换色
- 避免引入原图中不存在的新颜色
- 恢复颜色时需要完整重新处理，因为合并逻辑会改变

---

### 6. 生成预览图与下载文件

#### 6.1 预览图渲染
```javascript
function renderPreview(canvas, mappedPixelData, cellSize) {
  const ctx = canvas.getContext('2d')

  遍历所有单元格(j, i) {
    const cell = mappedPixelData[j][i]
    const x = i * cellSize
    const y = j * cellSize

    if (cell.isExternal) {
      // 外部背景：浅灰色
      ctx.fillStyle = '#F0F0F0'
    } else {
      // 内部单元格：珠子颜色
      ctx.fillStyle = cell.color
    }

    ctx.fillRect(x, y, cellSize, cellSize)

    // 绘制网格线
    ctx.strokeStyle = '#DDDDDD'
    ctx.strokeRect(x, y, cellSize, cellSize)
  }
}
```

#### 6.2 带 Key 图纸下载
```javascript
function downloadGridWithKeys(mappedPixelData, options) {
  const downloadCellSize = 30  // 高分辨率
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // 绘制标题栏（包含Logo、二维码、网站信息）
  renderTitleBar(ctx)

  // 绘制坐标轴（如果启用）
  if (options.showCoordinates) {
    renderAxisLabels(ctx)
  }

  // 绘制所有单元格
  遍历所有非外部单元格 {
    // 填充珠子颜色
    ctx.fillStyle = cell.color
    ctx.fillRect(x, y, downloadCellSize, downloadCellSize)

    // 绘制色号（使用对比色）
    ctx.fillStyle = getContrastColor(cell.color)
    ctx.fillText(cell.key, x + cellSize/2, y + cellSize/2)

    // 绘制边框
    ctx.strokeRect(x, y, downloadCellSize, downloadCellSize)
  }

  // 绘制分隔网格线（如果启用）
  if (options.showGrid) {
    renderGridLines(ctx, options.gridInterval, options.gridLineColor)
  }

  // 绘制统计信息（如果启用）
  if (options.includeStats) {
    renderColorStatistics(ctx, colorCounts, totalBeadCount)
  }

  // 导出为PNG
  canvas.toDataURL('image/png')
}
```

#### 6.3 颜色统计图下载
```javascript
function downloadColorStats(colorCounts, totalBeadCount) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // 背景
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // 标题
  ctx.fillText('拼豆颜色统计', ...)

  // 绘制每个颜色条目（多列布局）
  const numColumns = Math.max(1, Math.min(4, Math.floor(width / 250)))

  遍历所有颜色 {
    计算当前列和行位置

    // 色块
    ctx.fillStyle = color
    ctx.fillRect(x, y, swatchSize, swatchSize)

    // 色号
    ctx.fillText(key, x + swatchSize + 5, y)

    // 数量
    ctx.fillText(`${count} 颗`, x + itemWidth - 10, y)
  }

  // 总计
  ctx.fillText(`总计: ${totalBeadCount} 颗`, ...)

  // 导出为PNG
  canvas.toDataURL('image/png')
}
```

---

## 数据结构

### 核心类型定义

```typescript
// RGB 颜色
interface RgbColor {
  r: number  // 0-255
  g: number  // 0-255
  b: number  // 0-255
}

// 色板颜色
interface PaletteColor {
  key: string      // 色号键（hex值作为通用标识）
  hex: string      // 十六进制颜色值 #RRGGBB
  rgb: RgbColor    // RGB 值
}

// 映射后的像素
interface MappedPixel {
  key: string          // 色号键
  color: string        // 颜色值（hex）
  isExternal?: boolean // 是否是外部背景
}

// 色号系统类型
type ColorSystem = 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝'

// 像素化模式
enum PixelationMode {
  Dominant = 'dominant'  // 卡通模式（主导色）
  Average = 'average'    // 真实模式（平均色）
}

// 网格下载选项
interface GridDownloadOptions {
  showGrid: boolean           // 是否显示网格线
  gridInterval: number        // 网格间隔
  showCoordinates: boolean    // 是否显示坐标轴
  gridLineColor: string       // 网格线颜色
  includeStats: boolean       // 是否包含统计信息
  showCellNumbers: boolean    // 是否显示单元格编号
  exportCsv: boolean          // 是否同时导出CSV
}
```

### 颜色系统映射数据结构

```json
{
  "#FAF4C8": {
    "MARD": "A01",
    "COCO": "E02",
    "漫漫": "E2",
    "盼盼": "65",
    "咪小窝": "77"
  },
  "#FFFFD5": {
    "MARD": "A02",
    "COCO": "E01",
    "漫漫": "B1",
    "盼盼": "2",
    "咪小窝": "2"
  }
  // ... 291个标准hex颜色
}
```

---

## 功能模块详解

### 模块1: 图像上传与处理

**文件位置：** `src/app/page.tsx`

**核心功能：**
```javascript
// 处理图片上传
function handleImageChange(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.src = e.target.result
    img.onload = () => {
      // 绘制到原始 Canvas
      const canvas = originalCanvasRef.current
      const ctx = canvas.getContext('2d')

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      // 触发像素化处理
      processImage()
    }
  }
  reader.readAsDataURL(file)
}

// 处理拖放上传
function handleDrop(e) {
  e.preventDefault()
  const files = e.dataTransfer.files
  if (files.length > 0) {
    handleImageChange(files[0])
  }
}
```

---

### 模块2: 像素化处理

**文件位置：** `src/utils/pixelation.ts`

**主函数：**
```javascript
export function calculatePixelGrid(
  originalCtx: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  N: number,
  M: number,
  palette: PaletteColor[],
  mode: PixelationMode,
  t1FallbackColor: PaletteColor
): MappedPixel[][] {
  // 获取完整图像数据
  const fullImageData = originalCtx.getImageData(0, 0, imgWidth, imgHeight)

  // 计算每个单元格尺寸
  const cellWidth = imgWidth / N
  const cellHeight = imgHeight / M

  // 初始化结果数组
  const mappedData: MappedPixel[][] = Array(M).fill(null).map(() =>
    Array(N).fill({ key: t1FallbackColor.key, color: t1FallbackColor.hex })
  )

  // 遍历每个单元格
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const startX = Math.floor(i * cellWidth)
      const startY = Math.floor(j * cellHeight)
      const width = Math.ceil((i + 1) * cellWidth) - startX
      const height = Math.ceil((j + 1) * cellHeight) - startY

      // 计算代表色
      const rgb = calculateCellRepresentativeColor(
        fullImageData, startX, startY, width, height, mode
      )

      if (rgb) {
        // 映射到最近的色板颜色
        const closestBead = findClosestPaletteColor(rgb, palette)
        mappedData[j][i] = { key: closestBead.key, color: closestBead.hex }
      } else {
        // 透明单元格
        mappedData[j][i] = { key: 'TRANSPARENT', color: '#FFFFFF', isExternal: true }
      }
    }
  }

  return mappedData
}
```

---

### 模块3: 区域合并

**实现位置：** 整合在主处理流程中

**伪代码：**
```javascript
function mergeRegionsByColor(initialData, threshold) {
  const visited = new Set()
  const result = cloneDeep(initialData)

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      if (!visited.has(`${j},${i}`)) {
        // BFS 查找相似区域
        const region = bfsColorRegion(j, i, threshold, visited)

        // 统计区域内色号频率
        const keyCount = {}
        region.forEach(({row, col}) => {
          const key = initialData[row][col].key
          keyCount[key] = (keyCount[key] || 0) + 1
        })

        // 找到最频繁的色号
        const dominantKey = Object.keys(keyCount).reduce((a, b) =>
          keyCount[a] > keyCount[b] ? a : b
        )

        // 统一设置区域颜色
        region.forEach(({row, col}) => {
          result[row][col] = palette.find(c => c.key === dominantKey)
        })
      }
    }
  }

  return result
}
```

---

### 模块4: 背景移除

**文件位置：** 整合在主处理流程中

**核心逻辑：**
```javascript
const BACKGROUND_KEYS = ['T1', 'H1']

function markExternalCells(data) {
  const M = data.length
  const N = data[0].length
  const queue = []
  const visited = new Set()

  // 添加边界单元格
  for (let i = 0; i < N; i++) {
    queue.push([0, i], [M-1, i])
  }
  for (let j = 1; j < M-1; j++) {
    queue.push([j, 0], [j, N-1])
  }

  // BFS 洪水填充
  while (queue.length > 0) {
    const [row, col] = queue.shift()
    const key = `${row},${col}`

    if (visited.has(key) || row < 0 || row >= M || col < 0 || col >= N) {
      continue
    }

    const cell = data[row][col]

    if (BACKGROUND_KEYS.includes(cell.key)) {
      cell.isExternal = true
      visited.add(key)

      // 添加邻居
      queue.push([row-1, col], [row+1, col], [row, col-1], [row, col+1])
    }
  }
}
```

---

### 模块5: 颜色统计

**文件位置：** `src/app/page.tsx`

**实现：**
```javascript
function calculateColorCounts(mappedPixelData) {
  const counts = {}
  let totalCount = 0

  for (let j = 0; j < mappedPixelData.length; j++) {
    for (let i = 0; i < mappedPixelData[0].length; i++) {
      const cell = mappedPixelData[j][i]

      // 忽略外部背景
      if (!cell || cell.isExternal) continue

      const key = cell.key

      if (!counts[key]) {
        counts[key] = {
          count: 0,
          color: cell.color
        }
      }

      counts[key].count++
      totalCount++
    }
  }

  return { counts, totalCount }
}
```

---

### 模块6: CSV 导入导出

**文件位置：** `src/utils/imageDownloader.ts`

#### 导出 CSV
```javascript
export function exportCsvData({ mappedPixelData, gridDimensions, selectedColorSystem }) {
  const { N, M } = gridDimensions
  const csvLines = []

  for (let row = 0; row < M; row++) {
    const rowData = []
    for (let col = 0; col < N; col++) {
      const cell = mappedPixelData[row][col]
      if (cell && !cell.isExternal) {
        rowData.push(cell.color)  // 记录hex颜色值
      } else {
        rowData.push('TRANSPARENT')
      }
    }
    csvLines.push(rowData.join(','))
  }

  const csvContent = csvLines.join('\n')

  // 下载文件
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `bead-pattern-${N}x${M}-${selectedColorSystem}.csv`
  link.click()
}
```

#### 导入 CSV
```javascript
export function importCsvData(file): Promise<{mappedPixelData, gridDimensions}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const text = e.target.result
      const lines = text.trim().split('\n')
      const M = lines.length
      const N = lines[0].split(',').length

      const mappedPixelData = []

      for (let row = 0; row < M; row++) {
        const rowData = lines[row].split(',')
        const mappedRow = []

        for (let col = 0; col < N; col++) {
          const cellValue = rowData[col].trim()

          if (cellValue === 'TRANSPARENT') {
            mappedRow.push({
              key: 'TRANSPARENT',
              color: '#FFFFFF',
              isExternal: true
            })
          } else {
            // 验证hex格式
            if (!/^#[0-9A-Fa-f]{6}$/.test(cellValue)) {
              reject(new Error(`无效的颜色值：${cellValue}`))
              return
            }

            mappedRow.push({
              key: cellValue.toUpperCase(),
              color: cellValue.toUpperCase(),
              isExternal: false
            })
          }
        }

        mappedPixelData.push(mappedRow)
      }

      resolve({ mappedPixelData, gridDimensions: { N, M } })
    }

    reader.readAsText(file, 'utf-8')
  })
}
```

---

### 模块7: 色号系统转换

**文件位置：** `src/utils/colorSystemUtils.ts`

**核心功能：**
```javascript
// 获取显示色号
export function getDisplayColorKey(hexValue: string, colorSystem: ColorSystem): string {
  const normalizedHex = hexValue.toUpperCase()
  const mapping = colorSystemMapping[normalizedHex]

  if (mapping && mapping[colorSystem]) {
    return mapping[colorSystem]
  }

  return '?'
}

// 色号转hex
export function convertColorKeyToHex(displayKey: string, colorSystem: ColorSystem): string {
  // 如果已经是hex值，直接返回
  if (displayKey.startsWith('#') && displayKey.length === 7) {
    return displayKey.toUpperCase()
  }

  // 在映射中查找
  for (const [hex, mapping] of Object.entries(colorSystemMapping)) {
    if (mapping[colorSystem] === displayKey) {
      return hex
    }
  }

  return displayKey
}

// 转换整个色板
export function convertPaletteToColorSystem(
  palette: PaletteColor[],
  colorSystem: ColorSystem
): PaletteColor[] {
  return palette.map(color => {
    const mapping = colorSystemMapping[color.hex]
    if (mapping && mapping[colorSystem]) {
      return { ...color, key: mapping[colorSystem] }
    }
    return color
  })
}
```

---

## 技术实现要点

### 1. 性能优化

#### 1.1 大图片处理
```javascript
// 使用 Web Worker 处理大图片（可选优化）
const worker = new Worker('pixelation-worker.js')

worker.postMessage({
  imageData,
  N, M,
  palette,
  mode
})

worker.onmessage = (e) => {
  const { mappedData } = e.data
  updateUI(mappedData)
}
```

#### 1.2 Canvas 渲染优化
```javascript
// 使用离屏Canvas
const offscreenCanvas = document.createElement('canvas')
const offscreenCtx = offscreenCanvas.getContext('2d')

// 批量渲染
offscreenCtx.drawImage(...)

// 一次性绘制到主Canvas
mainCtx.drawImage(offscreenCanvas, 0, 0)
```

#### 1.3 减少重复计算
```javascript
// 缓存计算结果
const colorDistanceCache = new Map()

function cachedColorDistance(rgb1, rgb2) {
  const key = `${rgb1.r},${rgb1.g},${rgb1.b}-${rgb2.r},${rgb2.g},${rgb2.b}`

  if (colorDistanceCache.has(key)) {
    return colorDistanceCache.get(key)
  }

  const distance = Math.sqrt(
    (rgb1.r - rgb2.r) ** 2 +
    (rgb1.g - rgb2.g) ** 2 +
    (rgb1.b - rgb2.b) ** 2
  )

  colorDistanceCache.set(key, distance)
  return distance
}
```

---

### 2. 错误处理

```javascript
// 图像加载失败
img.onerror = () => {
  alert('图片加载失败，请检查文件格式')
}

// Canvas 操作失败
try {
  const imageData = ctx.getImageData(0, 0, width, height)
} catch (e) {
  console.error('无法获取图像数据:', e)
  alert('图片处理失败，可能跨域问题')
}

// 色板为空
if (!palette || palette.length === 0) {
  console.error('色板为空')
  return { key: 'ERR', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } }
}
```

---

### 3. 用户体验优化

#### 3.1 实时反馈
```javascript
// 显示处理进度
const progressBar = document.getElementById('progress')

for (let j = 0; j < M; j++) {
  for (let i = 0; i < N; i++) {
    // 处理单元格
    processCell(i, j)

    // 更新进度
    const progress = ((j * N + i) / (M * N)) * 100
    progressBar.style.width = `${progress}%`
  }
}
```

#### 3.2 防抖处理
```javascript
// 滑块调整时防抖
let debounceTimer
function handleGranularityChange(value) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    processImage(value)
  }, 300)
}
```

#### 3.3 响应式设计
```javascript
// 自适应Canvas大小
function resizeCanvas() {
  const container = canvasContainer.current
  const maxWidth = container.clientWidth
  const maxHeight = container.clientHeight

  const scale = Math.min(
    maxWidth / (N * cellSize),
    maxHeight / (M * cellSize)
  )

  canvas.style.width = `${N * cellSize * scale}px`
  canvas.style.height = `${M * cellSize * scale}px`
}

window.addEventListener('resize', resizeCanvas)
```

---

### 4. 数据持久化

```javascript
// 保存到 localStorage
function saveProject() {
  const projectData = {
    mappedPixelData,
    gridDimensions: { N, M },
    colorSystem: selectedColorSystem,
    excludedColors: Array.from(excludedColors),
    timestamp: Date.now()
  }

  localStorage.setItem('perler-beads-project', JSON.stringify(projectData))
}

// 加载项目
function loadProject() {
  const saved = localStorage.getItem('perler-beads-project')
  if (saved) {
    const projectData = JSON.parse(saved)
    // 恢复状态
    setMappedPixelData(projectData.mappedPixelData)
    setGridDimensions(projectData.gridDimensions)
    // ...
  }
}
```

---

### 5. 移动端适配

```javascript
// 触摸事件支持
canvas.addEventListener('touchstart', handleTouchStart)
canvas.addEventListener('touchmove', handleTouchMove)
canvas.addEventListener('touchend', handleTouchEnd)

// 长按显示色号
let longPressTimer
function handleTouchStart(e) {
  longPressTimer = setTimeout(() => {
    const touch = e.touches[0]
    showColorTooltip(touch.clientX, touch.clientY)
  }, 500)
}

function handleTouchEnd() {
  clearTimeout(longPressTimer)
  hideColorTooltip()
}

// 阻止默认滚动
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault()
}, { passive: false })
```

---

## 总结

这个拼豆图生成器通过以下核心算法解决了市面产品的痛点：

1. **主导色映射** - 消除黑色毛边
2. **BFS 区域合并** - 消除杂色
3. **洪水填充背景移除** - 准确统计珠子数量
4. **智能重映射** - 手动排除杂色时保持颜色自然

数据流程：
```
原图 → 网格划分 → 主导色映射 → 区域合并 → 背景移除 → 颜色排除 → 统计 → 导出
```

通过这些算法和优化，实现了高质量、易用、功能完整的拼豆图纸生成工具。
