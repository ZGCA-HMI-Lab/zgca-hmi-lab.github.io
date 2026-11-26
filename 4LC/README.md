# 4LC 项目主页

主页源码。页面（`index.html`、`style.css`、`app.js`）只读 `content.json` 和 `media/`。素材槽位、放入规则和本地预览见 [media.md](media.md)，选材与轨迹规则见 [material.md](material.md)，零散想法记在 [notes.md](notes.md)。

## 页面结构

| 板块 | 内容 |
|---|---|
| From Cache Readout to Video | Cache 各表征的读出视频与生成结果 |
| Camera Control | 推进、后拉、横移、升降、摇镜、俯仰、环绕、变焦、滑动变焦、跟拍、防抖，另有少量组合镜头 |
| Time Control | 时间静止、时间倒流、先走后停；相机都沿原视频轨迹走 |
| Single View to Multiple Views | 驾驶、机器人第一视角、第一人称；每个新机位是原轨迹加一个固定偏移，各机位共用同一段场景时间 |
| Image to Video | 单张图片生成一段，可以带人物或动物的动作 |
| Image to World | 单张图片起步的长程探索与重访，每段生成后写回 Cache |
| Video Editing | 转场、换背景、改类别、删除；编辑前后用同一条相机轨迹同步播放 |
| Comparison with NeoVerse | 同一输入、同一轨迹，对比生成效果 |


## 素材与生成

- 素材库：`outputs/website-library/`，每类任务有 `traj.yaml`、`shots.tsv`、`reserve.tsv`、`reject.tsv`，字段和流程见该目录的 README，筛选结论在 `shortlist.md`。
- 生成脚本：`tools/generation/`。
- 页面内容：`python website/tools/content.py` 生成 `content.json`；Image to World 的拼图由 `tools/montage.py` 生成。

## 待办：跨 Cache 场景组合

把一个视频的运动主体放进另一个视频的场景，再沿新视角生成。目前只有单个 Cache 内的 CacheEntry 组合。

- [ ] 设计两个独立 Cache 之间的组合流程。
- [ ] 明确背景 Cache 与主体 Cache 的坐标、尺度、朝向和时间对齐，以及主体的几何、运动和各表征如何随变换保持对应。
- [ ] 明确主体落点、地面接触和与背景的深度遮挡。
- [ ] 用"静态场景探索视频＋动态主体视频"跑通，生成多个新视角。
