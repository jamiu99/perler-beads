        // ==================== 全局状态 ====================
        let state = {
            originalImage: null,
            pixelationMode: 'dominant',
            colorSystem: 'MARD',
            gridData: null,
            colorCounts: null
        };

        // ==================== 色板数据 ====================
        // 色板数据将从外部 JSON 文件加载
        let COLOR_PALETTE = {};

        // 加载色板数据
        async function loadColorPalette() {
            try {
                const response = await fetch('color-palette.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                COLOR_PALETTE = data.colors;
                console.log(`✅ 成功加载色板数据: ${data.totalColors} 种颜色`);
                return true;
            } catch (error) {
                console.error('❌ 加载色板数据失败:', error);
                alert('加载色板数据失败，请确保 color-palette.json 文件存在');
                return false;
            }
        }

        // ==================== 工具函数 ====================

        // HEX 转 RGB
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        // RGB 转 color-diff 格式
        function toColorDiffFormat(rgb) {
            return { R: rgb.r, G: rgb.g, B: rgb.b };
        }

        // 获取色板
        function getPalette() {
            return Object.keys(COLOR_PALETTE).map(hex => {
                const rgb = hexToRgb(hex);
                return { hex, rgb };
            });
        }

        // 获取显示用的色号
        function getDisplayKey(hex) {
            const mapping = COLOR_PALETTE[hex.toUpperCase()];
            if (!mapping) return '?';
            return mapping[state.colorSystem] || '?';
        }

        // ==================== 应用初始化 ====================

        async function initializeApp() {
            // 加载色板数据
            const success = await loadColorPalette();
            if (!success) return;

            // ==================== 步骤1: 图片上传 ====================

            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');
            const previewContainer = document.getElementById('previewContainer');
            const originalPreview = document.getElementById('originalPreview');

        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) loadImage(file);
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadImage(file);
        });

        function loadImage(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    state.originalImage = img;
                    originalPreview.src = e.target.result;
                    document.getElementById('imageSize').textContent =
                        `${img.width} × ${img.height} 像素`;
                    previewContainer.classList.add('active');
                    document.getElementById('convertBtn').disabled = false;
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        // ==================== 步骤2: 参数控制 ====================

        // 粒度滑块
        document.getElementById('granularity').addEventListener('input', (e) => {
            document.getElementById('granularityValue').textContent = e.target.value;
        });

        // 模式切换
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.pixelationMode = btn.dataset.mode;
            });
        });

        // 色号体系切换
        document.getElementById('colorSystem').addEventListener('change', (e) => {
            state.colorSystem = e.target.value;
            // 如果已经有结果，重新渲染色号显示
            if (state.colorCounts) {
                renderColorStats();
            }
        });

        // ==================== 核心算法: 图像转拼豆 ====================

        // 计算单元格代表色
        function getCellColor(imageData, startX, startY, width, height, mode) {
            const data = imageData.data;
            const imgWidth = imageData.width;

            if (mode === 'average') {
                // 平均色模式
                let r = 0, g = 0, b = 0, count = 0;

                for (let y = startY; y < startY + height; y++) {
                    for (let x = startX; x < startX + width; x++) {
                        const i = (y * imgWidth + x) * 4;
                        if (data[i + 3] < 128) continue; // 跳过透明像素

                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        count++;
                    }
                }

                if (count === 0) return null;
                return {
                    r: Math.round(r / count),
                    g: Math.round(g / count),
                    b: Math.round(b / count)
                };

            } else {
                // 主导色模式
                const colorCounts = {};
                let maxCount = 0;
                let dominantColor = null;

                for (let y = startY; y < startY + height; y++) {
                    for (let x = startX; x < startX + width; x++) {
                        const i = (y * imgWidth + x) * 4;
                        if (data[i + 3] < 128) continue;

                        const key = `${data[i]},${data[i+1]},${data[i+2]}`;
                        colorCounts[key] = (colorCounts[key] || 0) + 1;

                        if (colorCounts[key] > maxCount) {
                            maxCount = colorCounts[key];
                            dominantColor = {
                                r: data[i],
                                g: data[i + 1],
                                b: data[i + 2]
                            };
                        }
                    }
                }

                return dominantColor;
            }
        }

        // 使用 color-diff 查找最接近的颜色
        function findClosestColor(targetRgb, palette) {
            const target = toColorDiffFormat(targetRgb);

            const paletteColors = palette.map(p => ({
                R: p.rgb.r,
                G: p.rgb.g,
                B: p.rgb.b,
                hex: p.hex
            }));

            const closest = colorDiff.closest(target, paletteColors);
            return closest.hex;
        }

        // 转换图片为拼豆网格
        function convertToBeadGrid() {
            if (!state.originalImage) return;

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const img = state.originalImage;
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const granularity = parseInt(document.getElementById('granularity').value);
            const N = granularity;
            const M = Math.round((img.height / img.width) * N);

            const cellWidth = img.width / N;
            const cellHeight = img.height / M;

            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const palette = getPalette();
            const grid = [];

            for (let j = 0; j < M; j++) {
                const row = [];
                for (let i = 0; i < N; i++) {
                    const startX = Math.floor(i * cellWidth);
                    const startY = Math.floor(j * cellHeight);
                    const w = Math.floor((i + 1) * cellWidth) - startX;
                    const h = Math.floor((j + 1) * cellHeight) - startY;

                    const cellRgb = getCellColor(
                        imageData,
                        startX, startY, w, h,
                        state.pixelationMode
                    );

                    if (cellRgb) {
                        const hex = findClosestColor(cellRgb, palette);
                        row.push(hex);
                    } else {
                        row.push('#FFFFFF'); // 透明区域用白色
                    }
                }
                grid.push(row);
            }

            return { grid, N, M };
        }

        // ==================== 转换按钮 ====================

        document.getElementById('convertBtn').addEventListener('click', () => {
            document.getElementById('loading').classList.add('active');
            document.getElementById('noResult').style.display = 'none';
            document.getElementById('noStats').style.display = 'none';

            setTimeout(() => {
                try {
                    const result = convertToBeadGrid();
                    state.gridData = result;

                    // 渲染预览
                    renderBeadPreview(result);

                    // 统计颜色
                    calculateColorStats(result);

                    // 启用导出按钮
                    document.getElementById('exportImageBtn').disabled = false;
                    document.getElementById('exportStatsBtn').disabled = false;

                } catch (error) {
                    console.error('转换失败:', error);
                    alert('转换失败，请重试');
                } finally {
                    document.getElementById('loading').classList.remove('active');
                }
            }, 100);
        });

        // ==================== 步骤3: 渲染预览 ====================

        function renderBeadPreview(result) {
            const canvas = document.getElementById('beadPreview');
            const ctx = canvas.getContext('2d');
            const { grid, N, M } = result;

            const cellSize = Math.min(600 / N, 600 / M);
            canvas.width = N * cellSize;
            canvas.height = M * cellSize;

            for (let j = 0; j < M; j++) {
                for (let i = 0; i < N; i++) {
                    const x = i * cellSize;
                    const y = j * cellSize;

                    ctx.fillStyle = grid[j][i];
                    ctx.fillRect(x, y, cellSize, cellSize);

                    ctx.strokeStyle = '#ddd';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x, y, cellSize, cellSize);
                }
            }

            document.getElementById('resultContainer').classList.add('active');
            document.getElementById('gridSize').textContent = `${N} × ${M}`;
        }

        // ==================== 步骤4: 色系统计 ====================

        function calculateColorStats(result) {
            const { grid } = result;
            const counts = {};
            let total = 0;

            grid.forEach(row => {
                row.forEach(hex => {
                    counts[hex] = (counts[hex] || 0) + 1;
                    total++;
                });
            });

            state.colorCounts = counts;
            document.getElementById('beadCount').textContent = `${total} 颗`;

            renderColorStats();
        }

        function renderColorStats() {
            const container = document.getElementById('colorStats');
            const counts = state.colorCounts;

            const sortedColors = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

            let html = '<div class="color-stats">';
            sortedColors.forEach(hex => {
                const key = getDisplayKey(hex);
                const count = counts[hex];

                html += `
                    <div class="color-item">
                        <div class="color-swatch" style="background: ${hex}"></div>
                        <div class="color-info">
                            <div class="color-key">${key}</div>
                            <div class="color-count">${count} 颗</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            container.innerHTML = html;
        }

        // ==================== 步骤5: 导出 ====================

        // 导出拼豆图
        document.getElementById('exportImageBtn').addEventListener('click', () => {
            const { grid, N, M } = state.gridData;
            const cellSize = 30;

            const canvas = document.createElement('canvas');
            canvas.width = N * cellSize;
            canvas.height = M * cellSize;
            const ctx = canvas.getContext('2d');

            const fontSize = Math.max(8, cellSize * 0.35);
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let j = 0; j < M; j++) {
                for (let i = 0; i < N; i++) {
                    const x = i * cellSize;
                    const y = j * cellSize;
                    const hex = grid[j][i];

                    // 填充颜色
                    ctx.fillStyle = hex;
                    ctx.fillRect(x, y, cellSize, cellSize);

                    // 绘制色号
                    const key = getDisplayKey(hex);
                    const brightness = (
                        hexToRgb(hex).r * 0.299 +
                        hexToRgb(hex).g * 0.587 +
                        hexToRgb(hex).b * 0.114
                    );
                    ctx.fillStyle = brightness > 128 ? '#000' : '#fff';
                    ctx.fillText(key, x + cellSize/2, y + cellSize/2);

                    // 边框
                    ctx.strokeStyle = '#ddd';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x, y, cellSize, cellSize);
                }
            }

            // 下载
            const link = document.createElement('a');
            link.download = `bead-pattern-${N}x${M}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });

        // 导出色系统计
        document.getElementById('exportStatsBtn').addEventListener('click', () => {
            const counts = state.colorCounts;
            const sortedColors = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

            const canvas = document.createElement('canvas');
            const width = 600;
            const padding = 30;
            const lineHeight = 40;
            const height = padding * 2 + 60 + sortedColors.length * lineHeight + 60;

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);

            // 标题
            ctx.fillStyle = '#333';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('拼豆色系统计', padding, padding + 30);

            // 分隔线
            ctx.strokeStyle = '#ddd';
            ctx.beginPath();
            ctx.moveTo(padding, padding + 50);
            ctx.lineTo(width - padding, padding + 50);
            ctx.stroke();

            // 颜色列表
            ctx.font = '16px sans-serif';
            let y = padding + 80;

            sortedColors.forEach(hex => {
                const key = getDisplayKey(hex);
                const count = counts[hex];

                // 色块
                ctx.fillStyle = hex;
                ctx.fillRect(padding, y - 15, 25, 25);
                ctx.strokeStyle = '#ccc';
                ctx.strokeRect(padding, y - 15, 25, 25);

                // 色号
                ctx.fillStyle = '#333';
                ctx.textAlign = 'left';
                ctx.fillText(key, padding + 35, y);

                // 数量
                ctx.textAlign = 'right';
                ctx.fillText(`${count} 颗`, width - padding, y);

                y += lineHeight;
            });

            // 总计
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            ctx.strokeStyle = '#ddd';
            ctx.beginPath();
            ctx.moveTo(padding, y + 10);
            ctx.lineTo(width - padding, y + 10);
            ctx.stroke();

            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`总计: ${total} 颗`, width - padding, y + 40);

            // 下载
            const link = document.createElement('a');
            link.download = `bead-colors-stats.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });

        } // initializeApp 函数结束

        // 页面加载完成后初始化应用
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApp);
        } else {
            // DOM 已经加载完成
            initializeApp();
        }
