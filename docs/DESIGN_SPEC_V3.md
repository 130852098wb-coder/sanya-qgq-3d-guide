# 三亚千古情 3D 实景导览图 V3 执行规格书（真实地图定位 + 双指水平旋转 + 指南针）

> 执行者：Codex (`gpt-6.2-astra`, `reasoning_effort=max`)
> 约束铁律：**保留 V2 已验收通过的暖玉朱金旗舰 UI、正确路网、千古情广场/风情街位置、圆盘柔雾草地与 390px 移动端布局；在此基础上精准落地 V3 四大地图核心能力，严禁破坏已有 UI 风格与 390px 移动端无溢出约束。**

## 一、核心升级 1：高德/宋城同款手机手势（单指平移 + 双指缩放兼 360° 水平旋转 + 锁死俯仰角）

修改 `scene-3d.js` 的相机与手势控制：
1. **严格锁定俯仰角（绝不上下乱翻、绝不钻地）**：
   - 定义黄金极角 `const LOCKED_POLAR = Math.PI / 2 - phi;`（即原导游图俯角 `36.37°`，对应极角约 `53.63°`）；
   - 设置 `controls.minPolarAngle = LOCKED_POLAR; controls.maxPolarAngle = LOCKED_POLAR;`；
   - 设置 `controls.enableRotate = true; controls.screenSpacePanning = false;`；
   - **PC 鼠标映射**：`controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };`（左键纯平移，右键 360° 水平旋转，滚轮缩放）。
2. **手机触摸自定义双指扭转旋转（原生 OrbitControls 不支持双指同时捏合缩放 + 扭转水平旋转，必须补充干净的触摸监听）**：
   - `controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };`（确保**单指滑动 100% 纯地面平移**，绝不误触旋转）；
   - 在 `renderer.domElement` 上监听两指 `touchstart / touchmove / touchend`：
     - 记录双指向量夹角 `Math.atan2(dy, dx)`，当两指角度累计变化超过 `3°` 防抖阈值后，将角度增量平滑绕 `controls.target` 的世界 Y 轴旋转 `perspCam.position`（只改水平偏航角 Yaw，绝不改俯仰角 Pitch！），保持 `perspCam.lookAt(controls.target)`；
     - 在水平旋转接近默认正向（差值 `< 2.5°` 且松手）时可做柔和反馈，但严禁卡顿。
   - **关键修复**：`focusPoint`、`resetOverview`、`flyTo`、`fitView` 必须支持**以当前相机水平偏航角**或**一键回正至默认偏航角（`theta`）**平滑飞行！新增导出方法：
     - `resetHeading()`：`0.35s` 平滑旋转回默认正向（景区入口朝下，`azimuth = theta`），不改变当前缩放与目标点；
     - `getHeadingDeg()`：返回当前地图相对默认正向的偏航角度（度数），并每帧通过回调通知 UI 实时驱动动态指南针旋转！

## 二、核心升级 2：真实地理定位（GPS 蓝点 + 手机朝向光束 + 园外优雅模拟 + 外部地图导航）

1. 在 `park-data.js` 中新增真实地理坐标标定常量与转换函数：
   - 景区地理基准（三亚市吉阳区迎宾路 333 号，WGS84）：
     - `PARK_GEO_ANCHOR = { lat: 18.2915, lng: 109.5311, originXZ: { x: 0, z: 0 }, headingDeg: 45, parkRadiusMeters: 650 }`
   - 导出 `geoToParkXZ(lat, lng)`（将经纬度转米制偏移再旋转映射到 3D 世界 `(x, z)`，并计算距景区中心距离 `distanceFromParkMeters` 及是否在园内 `inPark`）；
   - 导出 `findNearestRoadNode(x, z)`（根据 3D 坐标找出最近的真实步行路网节点 ID，用于将「我的位置」直接作为步行导航起点！）。
2. 在 `scene-3d.js` 中新增 3D「我的位置」蓝点与朝向扇形锥体：
   - 制作高德/宋城同款 3D 蓝点定位标记：发光白边天蓝实心圆点（`#1E88E5`）+ 柔和呼吸扩散蓝环动画 + 半透明朝向扇形光束（随 `deviceorientation` 罗盘朝向转动）；
   - 导出 `setUserLocation(x, z, headingDeg, visible)`：更新蓝点位置与朝向；调用时可选平滑聚焦至该点。
3. 在 `index.html` 中新增定位交互与园外无缝衔接：
   - 在右侧悬浮工具栏顶部/合理位置增加精致的 **「定位」毛玻璃圆球按钮**（带定位准星 SVG 图标，保持 390px 手机端右侧工具列不拥挤不裁切，最多 4 颗紧凑圆球，高度自动适配）；
   - 点击「定位」按钮：
     - 调用浏览器 `navigator.geolocation.getCurrentPosition / watchPosition`（HTTPS 下可用）；
     - 若定位在景区内（`inPark === true`）：立即在 3D 地图上点亮实时蓝色定位点，自动将导航起点切换为「我的当前位置」，并轻提示「已定位您在园区内，可直接发起步行导航」；
     - 若定位在景区外（或 PC 无 GPS / 用户拒绝权限）：绝不报丑陋弹窗！在顶部下方弹出极简毛玻璃 Toast 提示「当前距景区 XX km（或未获取定位），已开启入口实景定位演示」，同时将模拟蓝点放在「景区入口 / 爱情广场」并支持点击「前往三亚千古情（外部地图导航）」拉起高德/腾讯/苹果地图导航链接（`https://uri.amap.com/marker?position=109.5311,18.2915&name=三亚千古情景区`）。

## 三、核心升级 3：动态宋城风指南针罗盘 + 2D/3D 手绘实景底图模式切换

1. **动态指南针按钮（右上角或右侧工具栏上方）**：
   - 采用东方暖玉毛玻璃圆形徽章 + 宋城朱红/鎏金双色菱形指针 SVG；
   - 指针随 `getHeadingDeg()` 实时同步转动；当地图处于默认正向（`|deg| < 2°`）时处于淡雅低存在感状态，一旦用户双指/右键旋转即立刻高亮浮现；点击后 `0.35s` 平滑回正正向。
2. **「手绘底图」融合开关（升级原顶部右上角的地图图标按钮）**：
   - 保留 `1:1原图核对` 能力，同时升级为更实用的 **「底图贴地融合」**：开启后在 3D 地面铺上与坐标系 1:1 对齐的景区真实手绘导览艺术底图（含周边道路、停车场、公交站、水系与绿化纹理，透明度可调），3D 立体建筑稳稳拔地而起在手绘地图之上，既像杭州宋城手绘导览一样清晰丰富，又有 3D 立体旋转和实时 GPS 蓝点！

## 四、硬性质量红线（必须保持 V2 全部成果不回退）

1. **严禁破坏 390×844 手机竖屏布局**：顶栏、右侧工具列（4 颗圆球紧凑排布 `width: 40px; height: 40px` @max-width:600px）、底部双段 Dock 必须 100% 落在屏幕内，绝不溢出裁切；
2. **严禁破坏 V2 路网纠偏与广场布局**：喊泉到礼品店/剧院假路必须保持彻底删除，千古情广场露空、风情街归位、圆盘 3000m 柔雾草地不变；
3. **严禁引入任何外部 CDN 脚本/CSS**（仅外部导航跳转链接为标准 `<a>` 超链，页面自身运行零外部依赖）；
4. 只修改 `F:\三亚千古情3D导览图\park-data.js`、`scene-3d.js`、`index.html`，不改动 `showcase.html` 和 `models/`。
