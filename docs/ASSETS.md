# 角色与程序资产

`assets/queen-poses.webp`：通过内置 imagegen 生成的原创四姿态皇后图集。实际图像 1254×1254，2×2 等分，每格 627×627；等待 / 停止下注 / 发牌 / 赔付。PNG 经格式转码为 WebP，118,034 字节；未改变画面内容。项目不需要生成工具或 API 密钥即可运行。

`src/game/cards.ts`：使用 Canvas 程序绘制牌面、点数符号、宫廷牌字母纹章和 Q 牌背；按花色和点数缓存。`src/styles.css` 中的筹码、牌靴和丝线纹理是游戏 UI 资产，不依赖外部素材网络。

音效由 Web Audio 合成；首次用户手势后解锁，静音和四个音量通道可调。

## 生成提示词

+Use case: stylized-concept. Asset type: a production 2D game character pose atlas for Queen Entertainment baccarat simulator. Create ONE square 2048x2048 image with four equal 1024x1024 cells in an exact 2x2 grid, no gutters or borders. SAME realistic adult woman queen in every cell, identical face, camera, costume and lighting. Waist-up, seated, full forearms and anatomically correct hands visible, centered head at same coordinates in all four frames. High-end cinematic character portrait, pale natural skin, dark swept-back hair, tailored midnight teal high-neck long-sleeve gown with subtle gothic European tailoring, tiny silver tiara like a fine headband, antique silver brooch. Dignified, cool, mysterious, restrained, mature 30s, not sexualized, no cleavage, no cartoon, no glamour-model look. Dark clean near-black #080f15 background in each cell so atlas can blend into dark UI; faint soft rim light teal, ivory key light, realistic fabric and human texture. Torso ends at very bottom edge of each cell; hands rest on a very dark thin horizontal desk edge at y=850 inside each cell. TOP LEFT: neutral idle, hands gently resting near each other, face looking towards viewer. TOP RIGHT: stop-betting gesture, left hand gently raised open palm, gaze toward viewer. BOTTOM LEFT: dealing gesture with right hand extended toward viewer's left holding one small facedown dark teal playing card near desk, eyes looking down towards that card. BOTTOM RIGHT: payout gesture, left hand extended toward viewer's right palm down gently pushing three small ivory chips on desk, eyes towards desk. Keep same shoulder positions and head size in all frames, head no crowns cut off. Quiet private salon atmosphere, editorial photo realism. No text, no numbers, no logos, no extra hands, no decorative panels, no scene outside these four frames.

这是一组基础姿态图集，不是动作捕捉或连续角色动画。后续应在真人手部动作、连续姿态过渡与视觉对齐上继续制作资产。
