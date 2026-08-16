const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const graphCanvas = document.getElementById('graphCanvas');
const graphCtx = graphCanvas.getContext('2d');

// モードを保持する変数を追加（ファイルの先頭付近やグローバル変数定義の場所に記述）
let currentGameMode = '';

// 英語表記のモード名を日本語に変換したい場合のマッピング（必要に応じて）
const modeNames = {
	tutorial: 'チュートリアル',
	easy: 'イージー',
	hard: 'ハード',
};

// ★ 追加: クリアボタンが既に表示されたかどうかのフラグ
let isClearButtonsShown = false;
let clearButtonTimer = null; // ★ 追加: ボタン表示タイマーのID保持用

// ==========================================
// ★ 修正: ウィンドウリサイズに合わせて解像度とグラフのレイアウトを更新
// ==========================================
// ==========================================
// ★ 修正: ウィンドウリサイズに合わせて解像度とグラフのレイアウトを更新
// ==========================================
function resizeCanvas() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const isLandscape = window.innerWidth > window.innerHeight;
	const graphContainer = document.getElementById('graph-container'); // ★ 追加

	if (isLandscape) {
		let gWidth = Math.max(300, Math.min(450, window.innerWidth * 0.25));
		let gHeight = gWidth * 0.75;

		// 解像度はキャンバスに設定
		graphCanvas.width = gWidth;
		graphCanvas.height = gHeight;

		// ★ 修正: 配置や枠線はコンテナに設定する
		if (graphContainer) {
			graphContainer.style.width = gWidth + 'px';
			graphContainer.style.height = gHeight + 'px';
			graphContainer.style.top = 'auto';
			graphContainer.style.bottom = '20px';
			graphContainer.style.left = '20px';

			graphContainer.style.borderLeft = '1px solid #dbe9f5';
			graphContainer.style.borderRight = '1px solid #dbe9f5';
			graphContainer.style.borderBottom = '1px solid #dbe9f5';
			graphContainer.style.borderRadius = '8px';
		}
	} else {
		let gWidth = window.innerWidth;
		let gHeight = gWidth * 0.5;

		graphCanvas.width = gWidth;
		graphCanvas.height = gHeight;

		// ★ 修正: 配置や枠線はコンテナに設定する
		if (graphContainer) {
			graphContainer.style.width = gWidth + 'px';
			graphContainer.style.height = gHeight + 'px';
			graphContainer.style.top = 'auto';
			graphContainer.style.bottom = '0px';
			graphContainer.style.left = '0px';

			graphContainer.style.borderLeft = 'none';
			graphContainer.style.borderRight = 'none';
			graphContainer.style.borderBottom = 'none';
			graphContainer.style.borderRadius = '16px 16px 0 0';
		}
	}
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ★ 追加: メモリ確保を避けるための使い回し用配列
const sharedThickArray = new Float32Array(2000);

// ==========================================
// ★ 追加: グラフのグリッド・数値の表示状態管理
// ==========================================
let showGraphGrid = true; // デフォルトはオフ

// グラフのキャンバスをクリックしたらトグルする
graphCanvas.addEventListener('click', () => {
	showGraphGrid = !showGraphGrid;
});

// ==========================================
//  エフェクト・描画設定
// ==========================================
const ENABLE_TOUCH_EFFECTS = true;

// 描画の独立トグル設定
let showLine = true; // 線の表示
let showDot = false; // 円の表示
let showShip = true; // ★ 船の表示（新規追加）

// ==========================================
// 一時停止状態の管理
// ==========================================
let isPaused = false;
let pauseStartTime = 0;
let gameTime = 0; // ★ アニメーション用ゲーム内時間

window.togglePause = function () {
	isPaused = !isPaused;
	const icon = document.getElementById('pauseIcon');

	if (isPaused) {
		if (icon) icon.className = 'fa-solid fa-play';
		pauseStartTime = performance.now(); // ポーズ開始時刻を記録
	} else {
		if (icon) icon.className = 'fa-solid fa-pause';
		// ポーズしていた時間を計算し、lastTapTime をずらす（再開直後のタップ判定狂いを防ぐ）
		let pauseDuration = performance.now() - pauseStartTime;
		if (lastTapTime !== 0) {
			lastTapTime += pauseDuration;
		}

		// ★ 追加: ポーズ解除時に描画用の内部時計も現在時刻にリセットし、ワープを完全に防ぐ
		lastTime = performance.now();
	}
	console.log('一時停止:', isPaused ? 'ON' : 'OFF');
};
// ==========================================
// ★ 追加: 設定メニューの開閉管理
// ==========================================
let isSettingsOpen = false;

// ==========================================
// ★ 修正: 設定メニューの開閉管理 (ホーム画面と共用)
// ==========================================
window.toggleSettings = function () {
	isSettingsOpen = !isSettingsOpen;

	const icon = document.getElementById('settingsIcon');
	const homeIcon = document.getElementById('homeSettingsIcon'); // ★ 追加
	const uiContainer = document.getElementById('ui-container');

	if (isSettingsOpen) {
		// 開く時の処理: アイコンを「×」に変え、メニューを表示
		if (icon) icon.className = 'fa-solid fa-xmark';
		if (homeIcon) homeIcon.className = 'fa-solid fa-xmark'; // ★ 追加
		uiContainer.classList.add('show');
	} else {
		// 閉じる時の処理: アイコンを「歯車」に戻し、メニューを隠す
		if (icon) icon.className = 'fa-solid fa-gear';
		if (homeIcon) homeIcon.className = 'fa-solid fa-gear'; // ★ 追加
		uiContainer.classList.remove('show');
	}
};

// ★ 追加: 波のモード切り替えフラグ
let instantWaveMode = false; // true: ラグなし(新方式), false: ラグあり(従来方式)

// ★ 追加: モード切替用の関数
window.toggleWaveMode = function () {
	instantWaveMode = !instantWaveMode;

	// 切り替え時に不自然にならないよう、状態を同期してバッファをリセット
	generator.amplitude = playerTarget.amplitude;
	displayAmplitude = playerTarget.amplitude;

	waveBuffer = [];
	generator.lastT = (-100 + playerOffset) / playerSpeed;

	let modeName = instantWaveMode ? 'ラグなし(新方式)' : 'ラグあり(従来方式)';
	console.log('波の描画モード:', modeName);
};

// ★ 追加: モード切替用の関数 (既存のすぐ下に追加)
let enableRhythmEffects = true; // 音ゲーエフェクトのON/OFF
// let floatingTexts = []; // 判定テキスト(PERFECT等)の管理配列
let tapParticles = []; // タップ時の火花パーティクル
// let currentCombo = 0; // 現在のコンボ数
let lastTapPos = { x: 0, y: 0 }; // 最後にタップした座標

window.toggleRhythmEffects = function () {
	enableRhythmEffects = !enableRhythmEffects;
	console.log('音ゲーエフェクト: ' + (enableRhythmEffects ? 'ON' : 'OFF'));
};

// ★ 追加: ピーク(上に凸)強調エフェクトのON/OFF
let enablePeakEmphasis = true;

window.togglePeakEmphasis = function () {
	enablePeakEmphasis = !enablePeakEmphasis;
	console.log('ピーク強調: ' + (enablePeakEmphasis ? 'ON' : 'OFF'));
};

// ==========================================
// 振幅の自動補正機能
// ==========================================
let enableAutoAmpCorrection = true; // 補正機能のON/OFF
let currentAmpScale = 1.0; // 現在適用されているスケール値
let targetAmpScale = 1.0; // ★ 追加: 目標となるスケール値
const MAX_WAVE_AMPLITUDE = 4.0;

// ★ 修正: 目標スケールを計算する関数（必要な時だけ呼ぶ）
window.updateTargetAmpScale = function () {
	let maxPossibleAmp = 0;
	for (let n = 1; n <= N; n++) {
		// ★ 変更: draw_a, draw_b ではなく、即座に変化する a, b を使って目標値を決める
		if (a[n] !== 0 || b[n] !== 0) {
			maxPossibleAmp += Math.sqrt(a[n] * a[n] + b[n] * b[n]);
		}
	}

	if (enableAutoAmpCorrection && maxPossibleAmp > MAX_WAVE_AMPLITUDE) {
		targetAmpScale = MAX_WAVE_AMPLITUDE / maxPossibleAmp;
	} else {
		targetAmpScale = 1.0;
	}
};

window.toggleAutoAmpCorrection = function () {
	enableAutoAmpCorrection = !enableAutoAmpCorrection;
	console.log('振幅自動補正: ' + (enableAutoAmpCorrection ? 'ON' : 'OFF'));
	updateTargetAmpScale(); // ★ ON/OFF切り替え時に再計算
};

// ★ 追加: 次の問題から適用する自機画像のファイル名
let nextShipSrc = 'ship_1.svg';

// ★ 追加: 自機選択ボタンのイベント設定
document.querySelectorAll('.ship-btn').forEach((btn) => {
	btn.addEventListener('click', (e) => {
		// 選択された自機のファイル名を取得
		let selectedShip = btn.getAttribute('data-ship');
		nextShipSrc = selectedShip;

		// UIの選択状態（activeクラス）を更新
		document.querySelectorAll('.ship-btn').forEach((b) => b.classList.remove('active'));
		btn.classList.add('active');

		// ==========================================
		// ★ 追加: 選択された画像を即座に読み込み直す
		// ==========================================
		isShipLoaded = false;
		shipImage.src = selectedShip;

		// ★ 追加: 自機を変えたら設定を保存
		saveSettings();
	});
});

// ★ 船の画像を読み込み、色を合成波の色に合わせる
const shipImage = new Image();
const coloredShipCanvas = document.createElement('canvas');
let isShipLoaded = false;

shipImage.src = 'ship_1.svg';
shipImage.onload = () => {
	let w = 40;
	let h = 40;
	coloredShipCanvas.width = w;
	coloredShipCanvas.height = h;
	let tCtx = coloredShipCanvas.getContext('2d');

	// まず元の船を描画
	tCtx.drawImage(shipImage, 0, 0, w, h);
	// 描画された部分にのみ色を重ねるモードに変更
	tCtx.globalCompositeOperation = 'source-in';
	tCtx.fillStyle = '#82a5c9'; // 下の合成波の色
	tCtx.fillRect(0, 0, w, h);

	isShipLoaded = true;
};

// 描画のパラメータ設定
let lineThickness = 2.5; // 線の太さ (ピクセル)
let dotSpacing = 60; // 円と円の間隔 (ピクセル)
let dotRadius = 8; // 円の半径 (ピクセル)
let dotAccentInterval = 6; // 何点おきに円を濃く(暗く)するか

// パラメータ調整用のグローバル関数
window.setLineThickness = function (value) {
	lineThickness = Math.max(0.5, Number(value));
};
window.setDotSpacing = function (value) {
	dotSpacing = Math.max(2, Number(value));
};
window.setDotRadius = function (value) {
	dotRadius = Math.max(1, Number(value));
};
window.setDotAccentInterval = function (value) {
	dotAccentInterval = Math.max(1, Number(value));
};

// 表示トグル用のグローバル関数
window.toggleShowLine = function () {
	showLine = !showLine;
};
window.toggleShowDot = function () {
	showDot = !showDot;
};
// ★ 船の表示を切り替えるグローバル関数
window.toggleShowShip = function () {
	showShip = !showShip;
};

// ==========================================
// ★ 修正: グラフキャンバスの表示/非表示の切り替え
// ==========================================
let isGraphVisible = true;

window.toggleShowGraph = function () {
	isGraphVisible = !isGraphVisible;

	// ★ 修正: グラフの表示反映 (applySettings関数内)
	const graphContainer = document.getElementById('graph-container');
	const showGraphBtn = document.getElementById('showGraphBtn');
	if (graphContainer) {
		graphContainer.style.display = isGraphVisible ? 'block' : 'none';
	}
	if (showGraphBtn) {
		showGraphBtn.style.display = isGraphVisible ? 'none' : 'flex';
	}

	console.log('グラフ表示:', isGraphVisible ? 'ON' : 'OFF');
	if (typeof saveSettings === 'function') saveSettings(); // 状態を保存
};

// キーボードでの切り替え (L: 線, D: 円, S: 船, Space: タップ)
window.addEventListener('keydown', (e) => {
	const key = e.key.toLowerCase();

	if (key === 'l') window.toggleShowLine();
	if (key === 'd') window.toggleShowDot();
	if (key === 's') window.toggleShowShip(); // ★ Sキーで船の表示/非表示
	if (key === 'm') window.toggleWaveMode(); // ★ 追加: Mキーで波のモード切替
	if (key === 'r') window.toggleRhythmEffects(); // ★ Rキーで音ゲーエフェクト切替
	if (key === 'p') window.togglePeakEmphasis(); // ★ Pキーでピーク強調切替を追加
	if (key === 'c') window.toggleAutoAmpCorrection(); // ★ 追加: Cキーで振幅自動補正の切替
	if (key === 'g') window.toggleShowGraph(); // ★ 追加: Cキーで振幅自動補正の切替

	if (e.code === 'Space' || e.key === ' ') {
		e.preventDefault();
		const randomX = Math.random() * canvas.width;
		const randomY = Math.random() * canvas.height;
		registerTap(randomX, randomY);
	}
});

// ==========================================
//  ゲームパラメータ
// ==========================================
const N = 6;
const T_base = 2400; // 基本周期(ms) n=1の周期

// ★ 追加: 計算負荷を下げるため、各周波数(omega)を事前計算しておく
const OMEGAS = new Array(N + 1).fill(0);
for (let n = 1; n <= N; n++) {
	OMEGAS[n] = (2 * Math.PI * n) / (T_base / 1000);
}

// 係数の最小値と最大値
const MIN_COEFF = 0.5;
const MAX_COEFF = 2;

// ★ 追加: 成分が0以外(存在する)になる確率 (0.0 〜 1.0)
let coeffPresenceProbability = 0.3;

// ★ 追加: 確率を外部から変更するためのグローバル関数
window.setCoeffPresenceProbability = function (value) {
	// 0.0 (0%) から 1.0 (100%) の範囲に収める
	coeffPresenceProbability = Math.max(0, Math.min(1.0, Number(value)));
	console.log('係数出現確率を ' + coeffPresenceProbability * 100 + '% に設定しました');
};

// 流れる速度の設定 (ピクセル/秒)
// ★ const から let に変更して可変にします
let targetSpeed = 400;
let playerSpeed = 400;

// ★ 波の進行速度を変更するためのグローバル関数を追加
window.setWaveSpeed = function (value) {
	let speed = Math.max(10, Number(value));
	if (speed === targetSpeed) return; // 変更がない場合はスキップ

	// 波が途切れたり消えたりしないよう、速度変更の比率に合わせてオフセットを調整
	let ratio = speed / targetSpeed;
	targetOffset *= ratio;
	playerOffset *= ratio;

	targetSpeed = speed;
	playerSpeed = speed;

	// バッファ（過去と未来の波の記憶）の整合性が崩れないようリセットし、
	// 現在の画面左端の時間から波を即座に再構築する
	waveBuffer = [];
	generator.lastT = (-100 + playerOffset) / playerSpeed;
};

// ★ 追加: プレイヤー波の振幅設定用パラメータ
let tapAmplitudeStep = 0.75; // 1タップあたりの振幅増加量
let maxPlayerAmplitude = 1.5; // 振幅の最大制限値
let enableYTapAmplitude = false; // タップした縦位置(Y座標)で振幅を直接制御するかどうか

// グローバル調整関数
window.setTapAmplitudeStep = function (value) {
	tapAmplitudeStep = Math.max(0.1, Number(value));
};
window.setMaxPlayerAmplitude = function (value) {
	maxPlayerAmplitude = Math.max(0.5, Number(value));
};
window.toggleYTapAmplitude = function () {
	enableYTapAmplitude = !enableYTapAmplitude;
};

// 論理的な波の成分 (分離されると即座に0になる)
let a = new Array(N + 1).fill(0);
let b = new Array(N + 1).fill(0);

// 描画用の波の成分 (1秒かけて徐々に論理成分に追従する)
let draw_a = new Array(N + 1).fill(0);
let draw_b = new Array(N + 1).fill(0);

let extracted = [];
let missed = [];

// 波ごとのスクロールオフセット
let targetOffset = 0;
let playerOffset = 0;

let lastTime = performance.now();

// ★ 追加: クリア状態と船のアニメーション用変数
let isCleared = false;
let shipAnimState = 0; // 0: 通常, 1: 後ろに下がる(タメ), 2: 急加速で飛んでいく
let shipAnimTimer = 0;
let shipOffsetX = 0;
let shipVelocityX = 0;

// ★ 追加: 水しぶきのパーティクル配列
let splashes = [];

// タップ判定とエフェクト用
let lastTapTime = 0;
let intervals = [];
let ripples = [];
let lineRipples = [];
let globalShake = 0;

// プレイヤー波の目標パラメータ
let playerTarget = {
	omega: (2 * Math.PI) / (T_base / 1000),
	amplitude: 0,
	hitState: 0,
};

let currentDecayRate = 0.1;
let hitStateTimer = 0;

// ★ 追加: リアルタイムで波全体の振幅を管理する変数
let displayAmplitude = 0;
let displayAmpVel = 0;

// 画面右端で波を生成するジェネレータ
let generator = {
	lastT: 0,
	phi: 0,
	omega: (2 * Math.PI) / (T_base / 1000),
	omegaVel: 0,
	amplitude: 0,
	ampVel: 0,
	hitState: 0,
};

// 波の時系列サンプルバッファ
let waveBuffer = [];

// ランダムな係数を生成する関数
function generateCoefficient() {
	// ★ 修正: 設定された確率(coeffPresenceProbability)に基づいて 0 以外になるか判定
	// (Math.random() は 0.0 以上 1.0 未満の乱数を返す)
	if (Math.random() >= coeffPresenceProbability) {
		return 0;
	}

	// MIN_COEFF 〜 MAX_COEFF の間の実数を選択
	let value = MIN_COEFF + Math.random() * (MAX_COEFF - MIN_COEFF);

	// さらに50%の確率で正負を決定
	let sign = Math.random() < 0.5 ? 1 : -1;

	return value * sign;
}

function initGame() {
	// ★ 追加: タイマーの割り込みキャンセルとボタン非表示
	if (clearButtonTimer) {
		clearTimeout(clearButtonTimer);
		clearButtonTimer = null;
	}
	isClearButtonsShown = false;
	const clearBtns = document.getElementById('clear-buttons-container');
	if (clearBtns) {
		clearBtns.style.display = 'none';
	}

	let hasNonZero = false;
	for (let n = 1; n <= N; n++) {
		a[n] = generateCoefficient();
		b[n] = generateCoefficient();
		if (a[n] !== 0 || b[n] !== 0) hasNonZero = true;
	}
	// もしすべて0になってしまった場合は、最低でも a[1] に成分を持たせる
	if (!hasNonZero) {
		let fallbackValue = MIN_COEFF + Math.random() * (MAX_COEFF - MIN_COEFF);
		a[1] = fallbackValue * (Math.random() < 0.5 ? 1 : -1);
	}
	extracted = [];
	missed = [];

	for (let n = 1; n <= N; n++) {
		draw_a[n] = a[n];
		draw_b[n] = b[n];
	}

	waveBuffer = [];
	ripples = [];
	lineRipples = [];
	globalShake = 0;

	// ==========================================
	// ★ 追加: タップ判定に関わる状態を完全にリセット
	// ==========================================
	lastTapTime = 0;
	intervals = [];

	targetOffset = 0;
	playerOffset = 0;
	lastTime = performance.now();

	// ★ 追加: アニメーション状態のリセット
	isCleared = false;
	shipAnimState = 0;
	shipOffsetX = 0;
	shipVelocityX = 0;

	// ==========================================
	// ★ 修正: 選択されている自機を適用
	// ==========================================
	isShipLoaded = false;
	shipImage.src = nextShipSrc;
	// ==========================================

	// ★ 追加: 水しぶきのリセット
	splashes = [];

	// ★ 追加: 音ゲーエフェクトのリセット
	// currentCombo = 0;
	tapParticles = [];
	// floatingTexts = [];

	let defaultOmega = (2 * Math.PI) / (T_base / 1000);

	playerTarget = { omega: defaultOmega, amplitude: 0, hitState: 0 };
	currentDecayRate = 0.1;

	// ★ 追加: リセット処理
	displayAmplitude = 0;
	displayAmpVel = 0;

	generator = {
		lastT: 0,
		phi: 0,
		omega: defaultOmega,
		omegaVel: 0,
		amplitude: 0,
		ampVel: 0,
		hitState: 0,
	};
	hitStateTimer = 0;

	updateTargetAmpScale();

	document.getElementById('msg').innerText = '';
}

// タップ処理
function registerTap(x, y) {
	// ★ 追加: ポーズ中は入力やエフェクト生成を一切無視する
	if (isPaused) return;

	let now = performance.now();

	// ★ 追加: 音ゲーエフェクト (タップ時のスパーク)
	if (enableRhythmEffects) {
		for (let i = 0; i < 8; i++) {
			let angle = Math.random() * Math.PI * 2;
			let speed = 50 + Math.random() * 150;
			tapParticles.push({
				x: x,
				y: y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 1.0,
				color: '#82b4e6', // 水色
			});
		}
	}

	// ★ 修正: ENABLE_TOUCH_EFFECTS から enableRhythmEffects に変更
	if (enableRhythmEffects) {
		ripples.push({ x: x, y: y, radius: 0, alpha: 0.5 });
		lineRipples.push({ x: x, time: 0, intensity: 1.0 });
		globalShake = 1.0;
	}

	// ★ 修正: Y座標タップによる振幅調整とパラメータ適用の追加
	if (enableYTapAmplitude && typeof y === 'number') {
		const playerWaveCenterY = 100; // プレイヤー波の中心Y座標
		// 中心線からの距離に応じて振幅を設定 (距離に応じた直感的な操作)
		let distFromCenter = Math.abs(y - playerWaveCenterY);
		let calculatedAmp = (distFromCenter / 40) * maxPlayerAmplitude;

		// 画面タップ時は計算値、または従来の加算値の大きい方を採用
		playerTarget.amplitude = Math.min(
			Math.max(calculatedAmp, playerTarget.amplitude + tapAmplitudeStep * 0.5),
			maxPlayerAmplitude,
		);
	} else {
		// キーボード(Space)などの場合はステップ加算
		playerTarget.amplitude = Math.min(
			playerTarget.amplitude + tapAmplitudeStep,
			maxPlayerAmplitude,
		);
	}

	if (lastTapTime !== 0) {
		let dt = now - lastTapTime;

		if (dt > T_base * 1.5) {
			intervals = [];
			playerTarget.omega = (2 * Math.PI) / (T_base / 1000);
		} else {
			if (intervals.length > 0) {
				let prevSum = intervals.reduce((a, b) => a + b, 0);
				let prevAvg = prevSum / intervals.length;
				if (Math.abs(dt - prevAvg) > prevAvg * 0.35) {
					intervals = [];
				}
			}

			intervals.push(dt);

			let sum = intervals.reduce((a, b) => a + b, 0);
			let avg = sum / intervals.length;

			playerTarget.omega = (2 * Math.PI) / (avg / 1000);

			// ==========================================
			// ★ 修正: 周期が約2秒以上（1900ms〜）の場合は 3クリック(2インターバル) で判定
			// 短い周期の場合は従来通り最低 4クリック(3インターバル) 以上を要求する
			// ==========================================
			let requiredIntervals = avg >= 1900 ? 2 : 3;

			if (sum >= 2000 && intervals.length >= requiredIntervals) {
				let success = judgeRhythm(avg);
				if (success) {
					intervals = []; // 成功時はリセット
				} else {
					intervals.shift(); // 失敗時は一番古い間隔を捨てて次へ
				}
			}
		}
	}

	lastTapTime = now;
}

function judgeRhythm(avgInterval) {
	let estimated_m = T_base / avgInterval;
	let m = Math.round(estimated_m);

	if (Math.abs(estimated_m - m) < 0.35 && m >= 1 && m <= N) {
		if (a[m] !== 0 || b[m] !== 0) {
			playerTarget.hitState = 1;
			hitStateTimer = 900;

			// // ★ 追加: 成功時 (PERFECT)
			// if (enableRhythmEffects) {
			// 	currentCombo++;
			// 	spawnFloatingText('PERFECT!!', lastTapPos.x, lastTapPos.y - 30, '#48b884');
			// }

			let ex_a = a[m];
			let ex_b = b[m];

			a[m] = 0;
			b[m] = 0;

			extracted.push({ n: m, a: ex_a, b: ex_b, draw_a: 0, draw_b: 0 });

			// ★ 追加: 波が分離(抽出)されたので補正スケールを再計算する
			updateTargetAmpScale();

			checkClear();

			return true;
		} else {
			let isAlreadyExtracted = extracted.some((ex) => ex.n === m);
			if (!isAlreadyExtracted && !missed.includes(m)) {
				missed.push(m);

				// 	// ★ 追加: 不正解追加時 (MISS)
				// 	if (enableRhythmEffects) {
				// 		currentCombo = 0;
				// 		spawnFloatingText('MISS...', lastTapPos.x, lastTapPos.y - 30, '#e66e6e');
				// 	}
				// } else {
				// 	// ★ 追加: 抽出済みの波に再度ヒットした場合 (GREAT)
				// 	if (enableRhythmEffects) {
				// 		spawnFloatingText('GREAT', lastTapPos.x, lastTapPos.y - 30, '#e0c060');
				// 	}
			}
		}
		// } else {
		// 	// ★ 追加: リズムが全く合っていない場合もコンボをリセット
		// 	if (enableRhythmEffects) currentCombo = 0;
	}

	playerTarget.hitState = -1;
	hitStateTimer = 700;
	return false;
}

// // ★ 追加: フローティングテキスト生成ヘルパー
// function spawnFloatingText(text, x, y, color) {
// 	floatingTexts.push({
// 		text: text,
// 		x: x,
// 		y: y,
// 		life: 1.0,
// 		color: color,
// 	});
// }

function checkClear() {
	for (let n = 1; n <= N; n++) {
		if (a[n] !== 0 || b[n] !== 0) return; // 残りの波があるかチェック
	}

	// ★ 修正: クリア演出の開始
	if (!isCleared) {
		isCleared = true;
		shipAnimState = 1; // タメのアニメーションを開始
		shipAnimTimer = 0;

		// setTimeout(() => {
		// 	document.getElementById('msg').innerText = 'Clear! 澄み切った水面になりました！';
		// }, 1000);
	}
}

function updateWaveBuffer() {
	let t_right = (canvas.width + 100 + playerOffset) / playerSpeed;
	const dt_step = 1 / playerSpeed;
	const baseOmega = (2 * Math.PI) / (T_base / 1000);

	let currentRealTime = performance.now();
	let timeSinceLastTap = lastTapTime === 0 ? 99999 : currentRealTime - lastTapTime;

	let expectedInterval = ((2 * Math.PI) / playerTarget.omega) * 1000;
	let isTapping = timeSinceLastTap < expectedInterval * 1.5 + 150;

	if (generator.lastT === 0) {
		generator.lastT = playerOffset / playerSpeed;
	}

	while (generator.lastT < t_right) {
		generator.lastT += dt_step;

		let omegaRatio = playerTarget.omega / baseOmega;

		// ★ 従来方式(ラグあり)の場合のみ、右端の未来位置で減衰計算を行う
		if (!instantWaveMode) {
			let targetDecayRate = isTapping ? 0.1 * omegaRatio : 0.2 + 2 * omegaRatio;
			currentDecayRate += (targetDecayRate - currentDecayRate) * 0.015;
			playerTarget.amplitude -= dt_step * currentDecayRate;

			if (playerTarget.amplitude <= 0) {
				playerTarget.amplitude = 0;
				playerTarget.omega = baseOmega;
			}

			if (hitStateTimer > 0) {
				hitStateTimer -= dt_step * 1000;
				if (hitStateTimer <= 0) {
					playerTarget.hitState = 0;
				}
			}

			let ampAccel = (playerTarget.amplitude - generator.amplitude) * 0.03;
			generator.ampVel += ampAccel;
			generator.ampVel *= 0.65;
			generator.amplitude += generator.ampVel;
			if (generator.amplitude < 0) generator.amplitude = 0;

			generator.hitState = playerTarget.hitState;
		}

		// 周波数の変化はどちらのモードでも適用
		let omegaAccel = (playerTarget.omega - generator.omega) * 0.02;
		generator.omegaVel += omegaAccel;
		generator.omegaVel *= 0.75;
		generator.omega += generator.omegaVel;
		generator.phi += generator.omega * dt_step;

		// ★ 両方のモードに対応するため、基本波形(baseY)と振幅適用後(y)の両方を保存
		let baseY = 2 * Math.cos(generator.phi);
		let y = instantWaveMode ? baseY : generator.amplitude * baseY;

		waveBuffer.push({
			t: generator.lastT,
			y: y,
			baseY: baseY,
			state: instantWaveMode ? playerTarget.hitState : generator.hitState,
		});
	}

	let t_left = (-100 + playerOffset) / playerSpeed;
	// ==========================================
	// ★ 修正: 毎回の shift() 呼び出しによる負荷を減らすため、まとめて splice() する
	// ==========================================
	let removeCount = 0;
	while (waveBuffer.length > removeCount && waveBuffer[removeCount].t < t_left) {
		removeCount++;
	}
	if (removeCount > 0) {
		waveBuffer.splice(0, removeCount);
	}
}

function getCanvasPos(e) {
	const rect = canvas.getBoundingClientRect();
	const clientX = e.touches ? e.touches[0].clientX : e.clientX;
	const clientY = e.touches ? e.touches[0].clientY : e.clientY;
	return {
		x: clientX - rect.left,
		y: clientY - rect.top,
	};
}

canvas.addEventListener('mousedown', (e) => {
	e.preventDefault();
	let pos = getCanvasPos(e);
	registerTap(pos.x, pos.y);
});

// ★ 追加: マウスホイールで振幅を直感的に増減
// canvas.addEventListener(
// 	'wheel',
// 	(e) => {
// 		e.preventDefault();
// 		let delta = e.deltaY < 0 ? 0.3 : -0.3; // 上スクロールで増加、下スクロールで減少
// 		playerTarget.amplitude = Math.min(
// 			Math.max(0, playerTarget.amplitude + delta),
// 			maxPlayerAmplitude,
// 		);
// 	},
// 	{ passive: false },
// );

canvas.addEventListener(
	'touchstart',
	(e) => {
		e.preventDefault();
		let pos = getCanvasPos(e);
		registerTap(pos.x, pos.y);
	},
	{ passive: false },
);

// ★ 修正: 色文字列の生成を分離して取得できるようにする
function getWaveColorStr(state, isAccent = false) {
	let r = 110,
		g = 190,
		b = 255,
		a = 0.85;
	if (state === 1) {
		r = 72;
		g = 184;
		b = 132;
		a = 0.95;
	} else if (state === -1) {
		r = 230;
		g = 110;
		b = 110;
		a = 0.95;
	}

	if (isAccent) {
		r = Math.floor(r * 0.65);
		g = Math.floor(g * 0.65);
		b = Math.floor(b * 0.65);
		a = 1.0;
	}
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function setWaveStyle(state, isFill = false, isAccent = false) {
	let colorStr = getWaveColorStr(state, isAccent);
	if (isFill) {
		ctx.fillStyle = colorStr;
	} else {
		ctx.strokeStyle = colorStr;
	}
}

// ==========================================
// ★ 修正: ピークの強調を行いながら波を綺麗に描画する汎用ヘルパー
// ==========================================
function drawEmphasizedLine(ctx, pts, baseThick, colorStyle, isEmphasize) {
	if (pts.length === 0) return;

	// ★ 修正: new Array(pts.length).fill(baseThick) を削除し、共有配列を初期化して使う
	for (let i = 0; i < pts.length; i++) {
		sharedThickArray[i] = baseThick;
	}

	if (isEmphasize) {
		let inConvex = false;
		let startIdx = 0;

		const processRegion = (start, end) => {
			let len = end - start;
			if (len >= 8) {
				let p1 = Math.floor(start + len * 0.25);
				let p2 = Math.floor(start + len * 0.375);
				let p3 = Math.floor(start + len * 0.625);
				let p4 = Math.floor(start + len * 0.75);

				for (let j = p1; j <= p4; j++) {
					let t = baseThick;
					if (j >= p2 && j <= p3) {
						t = baseThick * 2.0;
					} else if (j > p1 && j < p2) {
						let ratio = (j - p1) / (p2 - p1);
						let smoothRatio = ratio * ratio * (3 - 2 * ratio);
						t = baseThick + baseThick * 1.0 * smoothRatio;
					} else if (j > p3 && j < p4) {
						let ratio = (p4 - j) / (p4 - p3);
						let smoothRatio = ratio * ratio * (3 - 2 * ratio);
						t = baseThick + baseThick * 1.0 * smoothRatio;
					}

					// ★ 修正: thickArray から sharedThickArray に変更
					if (j >= 0 && j < pts.length) {
						sharedThickArray[j] = t;
					}
				}
			}
		};

		// 上に凸（山）の区間を検出して処理
		for (let i = 0; i < pts.length; i++) {
			let isConvex = pts[i].d2 < 0;
			if (isConvex && !inConvex) {
				inConvex = true;
				startIdx = i;
			} else if (!isConvex && inConvex) {
				inConvex = false;
				processRegion(startIdx, i - 1);
			}
		}
		if (inConvex) {
			processRegion(startIdx, pts.length - 1);
		}
	}

	let getColor = typeof colorStyle === 'function' ? colorStyle : () => colorStyle;

	// ★ 修正: パスの切り替えを減らすため、0.5px単位( * 2 / 2 )で丸める
	let currentThick = Math.round(sharedThickArray[0] * 2) / 2;

	ctx.lineWidth = currentThick;
	ctx.strokeStyle = getColor(pts[0]);
	ctx.lineCap = 'butt'; // 重なった部分の色が濃くなるのを防ぐ
	ctx.lineJoin = 'round';

	ctx.beginPath();
	ctx.moveTo(pts[0].x, pts[0].py);

	for (let i = 1; i < pts.length; i++) {
		// ★ 修正: こちらも 0.5px単位 に変更
		let nextThick = Math.round(sharedThickArray[i] * 2) / 2;
		let nextColor = getColor(pts[i]);
		let currColor = getColor(pts[i - 1]);

		// 太さや色が変わるタイミングで一度線を描画し、新しいパスを繋ぐ
		if (nextThick !== currentThick || nextColor !== currColor) {
			// 一旦現在の太さで今の座標まで線を引く
			ctx.lineTo(pts[i].x, pts[i].py);
			ctx.stroke();

			// 新しい太さ/色を設定
			currentThick = nextThick;
			ctx.lineWidth = currentThick;
			ctx.strokeStyle = nextColor;

			// 新しいパスを今の座標から開始する
			ctx.beginPath();
			ctx.moveTo(pts[i].x, pts[i].py);
		} else {
			ctx.lineTo(pts[i].x, pts[i].py);
		}
	}
	ctx.stroke();
}

// ==========================================
// 係数グラフを描画する関数 (graphCanvas用)
// ==========================================
function drawCoefficientGraph() {
	graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

	const w = graphCanvas.width;
	const h = graphCanvas.height;
	const midY = h / 2;

	// MAX_COEFF に基づいて縦軸のスケールを決定
	const maxVal = Math.ceil(MAX_COEFF) + 0.2;
	const scaleY = (h / 2 - 20) / maxVal;

	// ==========================================
	// ★ 修正: 左右の余白を均等にし、0 と N+1 の位置を定義
	// ==========================================
	const marginX = 25; // 左右の余白（必要に応じて調整してください）
	// (0 から N+1 まで) の区間を N+1 等分する
	const stepX = (w - marginX * 2) / (N + 1);

	const startX = marginX; // x = 0 の座標
	const endX = w - marginX; // x = N+1 の座標

	// ==========================================
	// ★ 修正: showGraphGridがtrueの時のみグリッドと数値を描画
	// ==========================================
	if (showGraphGrid) {
		// 背景のグリッド線の描画
		graphCtx.strokeStyle = '#e0e0e0';
		graphCtx.lineWidth = 1;

		// // 縦線 (Nの値によって数が動的に変わる)
		// for (let n = 1; n <= N; n++) {
		// 	let px = startX + n * stepX;
		// 	graphCtx.beginPath();
		// 	graphCtx.moveTo(px, 0);
		// 	graphCtx.lineTo(px, h);
		// 	graphCtx.stroke();
		// }

		// 横線とY軸の目盛り数値
		let maxLine = Math.ceil(MAX_COEFF);
		graphCtx.fillStyle = '#666';
		graphCtx.font = '12px Arial';
		graphCtx.textAlign = 'right';
		graphCtx.textBaseline = 'middle';

		// for (let v = -maxLine; v <= maxLine; v++) {
		// 	if (v === 0) continue;
		// 	let py = midY - v * scaleY;

		// 	// グリッド線
		// 	graphCtx.beginPath();
		// 	graphCtx.moveTo(startX, py); // 左端 (0の位置)
		// 	graphCtx.lineTo(endX, py); // 右端 (N+1の位置)
		// 	graphCtx.stroke();

		// 	// 目盛り数値の描画
		// 	// graphCtx.fillText(v.toString(), 25, py);
		// }

		// ★ 修正: showGraphGridがtrueの時のみ0の目盛りとX軸ラベルを描画
		// 0の目盛り
		graphCtx.fillStyle = '#666';
		graphCtx.font = '12px Arial';
		graphCtx.textAlign = 'right';
		graphCtx.textBaseline = 'middle';
		// graphCtx.fillText('0', 25, midY);

		// X軸ラベル (n=1, n=2...)
		graphCtx.fillStyle = '#333';
		graphCtx.font = '14px Arial';
		graphCtx.textAlign = 'center';
		graphCtx.textBaseline = 'top';
		for (let n = 1; n <= N; n++) {
			let px = startX + n * stepX;
			graphCtx.fillText(n, px, midY + 10);
		}

		// ★ 修正: showGraphGridがtrueの時のみタイトルと凡例を表示する
		graphCtx.textAlign = 'left';
		graphCtx.textBaseline = 'alphabetic';
		graphCtx.font = '14px Arial';
		graphCtx.fillStyle = '#333';
		// スケール変更に合わせて文字のY座標も少し上に(30 -> 25)移動
		graphCtx.fillText('Fourier係数', 15, 25);

		graphCtx.font = '14px Arial';
		graphCtx.fillStyle = '#666'; // 凡例はグレーに統一
		graphCtx.fillText('▼ a (cos)', 120, 25);
		graphCtx.fillText('▲ b (sin)', 200, 25);
	}

	// ==========================================
	// グラフのX軸（中央線 y=0）※これは常に表示する
	// ==========================================
	graphCtx.beginPath();
	graphCtx.moveTo(startX, midY); // 左端 (0の位置)
	graphCtx.lineTo(endX, midY); // 右端 (N+1の位置)
	graphCtx.strokeStyle = '#333';
	graphCtx.lineWidth = 1;
	graphCtx.stroke();

	// ==========================================
	// 三角形を描画するヘルパー関数
	// ==========================================
	const drawTriangleUp = (ctx, x, y, size) => {
		ctx.beginPath();
		ctx.moveTo(x, y - size); // 頂点（上）
		ctx.lineTo(x + size, y + size * 0.8); // 右下
		ctx.lineTo(x - size, y + size * 0.8); // 左下
		ctx.closePath();
		ctx.fill();
	};

	const drawTriangleDown = (ctx, x, y, size) => {
		ctx.beginPath();
		ctx.moveTo(x, y + size); // 頂点（下）
		ctx.lineTo(x + size, y - size * 0.8); // 右上
		ctx.lineTo(x - size, y - size * 0.8); // 左上
		ctx.closePath();
		ctx.fill();
	};

	// ==========================================
	// 抽出された成分の棒グラフ（ステム）とプロットを描画
	// ==========================================
	for (let i = 0; i < extracted.length; i++) {
		let ex = extracted[i];
		let n = ex.n;
		let px = startX + n * stepX;

		// 分離された波の描画色（HSL）と一致させる
		let waveColor = `hsl(${n * 50}, 60%, 65%)`;

		graphCtx.strokeStyle = waveColor;
		graphCtx.fillStyle = waveColor;
		graphCtx.lineWidth = 2.5;

		// --- a_n (cos): ▼ ---
		let yA = midY - ex.a * scaleY;
		if (ex.a !== 0) {
			graphCtx.beginPath();
			graphCtx.moveTo(px, midY);
			graphCtx.lineTo(px, yA);
			graphCtx.stroke();
		}
		drawTriangleDown(graphCtx, px, yA, 6);

		// --- b_n (sin): ▲ ---
		let yB = midY - ex.b * scaleY;
		if (ex.b !== 0) {
			graphCtx.beginPath();
			graphCtx.moveTo(px, midY);
			graphCtx.lineTo(px, yB);
			graphCtx.stroke();
		}
		drawTriangleUp(graphCtx, px, yB, 6);
	}

	// ==========================================
	// 不正解となった成分 (a_n=0, b_n=0)
	// ==========================================
	for (let i = 0; i < missed.length; i++) {
		let n = missed[i];
		let px = 30 + n * stepX;

		// 該当する周波数(n)の色を計算
		let waveColor = `hsl(${n * 50}, 60%, 65%)`;
		graphCtx.fillStyle = waveColor;

		// 0のライン上に重ねて描画（▼と▲が合わさって六芒星のような形になります）
		drawTriangleDown(graphCtx, px, midY, 6);
		drawTriangleUp(graphCtx, px, midY, 6);
	}
}

function draw(time) {
	requestAnimationFrame(draw);

	// ★ 修正: ブラウザから渡されるtimeではなく、システム時計(performance.now)を直接使う
	let now = performance.now();
	let dt = now - lastTime;
	lastTime = now;

	// ★ 修正: dtが巨大になった場合だけでなく、スリープ復帰等でマイナスになった場合も防ぐ
	if (dt > 100 || dt < 0) {
		dt = 16;
	}

	// ポーズ中は経過時間を0にすることで全アニメーション・波の進行を停止
	if (isPaused) {
		dt = 0;
	}

	gameTime += dt; // ポーズ中は進まないゲーム内時間

	let dt_sec = dt / 1000;

	targetOffset += dt_sec * targetSpeed;
	playerOffset += dt_sec * playerSpeed;

	// ==========================================
	// ★ 新方式(ラグなし)の場合のみ、現在時刻ベースで減衰を計算
	// ==========================================
	if (instantWaveMode) {
		let currentRealTime = performance.now();
		let timeSinceLastTap = lastTapTime === 0 ? 99999 : currentRealTime - lastTapTime;
		let expectedInterval = ((2 * Math.PI) / playerTarget.omega) * 1000;
		let isTapping = timeSinceLastTap < expectedInterval * 1.5 + 150;
		let baseOmega = (2 * Math.PI) / (T_base / 1000);
		let omegaRatio = playerTarget.omega / baseOmega;

		let targetDecayRate = isTapping ? 0.1 * omegaRatio : 0.2 + 2 * omegaRatio;

		currentDecayRate += (targetDecayRate - currentDecayRate) * (dt_sec * 4.5);
		playerTarget.amplitude -= dt_sec * currentDecayRate;

		if (playerTarget.amplitude <= 0) {
			playerTarget.amplitude = 0;
			playerTarget.omega = baseOmega;
		}

		if (hitStateTimer > 0) {
			hitStateTimer -= dt_sec * 1000;
			if (hitStateTimer <= 0) {
				playerTarget.hitState = 0;
			}
		}

		let simSteps = Math.max(1, Math.floor(dt_sec * 300));
		for (let i = 0; i < simSteps; i++) {
			let ampAccel = (playerTarget.amplitude - displayAmplitude) * 0.03;
			displayAmpVel += ampAccel;
			displayAmpVel *= 0.65;
			displayAmplitude += displayAmpVel;
			if (displayAmplitude < 0) displayAmplitude = 0;
		}
	}

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// 1. エフェクト演算 & 背景波紋の描画
	// ★ 修正: ENABLE_TOUCH_EFFECTS から enableRhythmEffects に変更
	if (enableRhythmEffects) {
		for (let i = ripples.length - 1; i >= 0; i--) {
			let r = ripples[i];
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
			ctx.strokeStyle = `rgba(130, 180, 230, ${r.alpha})`;
			ctx.lineWidth = 2;
			ctx.stroke();

			r.radius += dt * 0.2;
			r.alpha -= dt / 800;
			if (r.alpha <= 0) ripples.splice(i, 1);
		}

		globalShake = Math.max(0, globalShake - (dt / 1000) * 4.0);

		for (let i = lineRipples.length - 1; i >= 0; i--) {
			let r = lineRipples[i];
			r.time += dt / 1000;
			r.intensity -= (dt / 1000) * 1.2;
			if (r.intensity <= 0) lineRipples.splice(i, 1);
		}
	}

	let transitionSpeed = 2.0 * (dt / 1000);
	for (let n = 1; n <= N; n++) {
		if (draw_a[n] !== a[n]) {
			let diff = a[n] - draw_a[n];
			draw_a[n] += Math.sign(diff) * Math.min(transitionSpeed, Math.abs(diff));
		}
		if (draw_b[n] !== b[n]) {
			let diff = b[n] - draw_b[n];
			draw_b[n] += Math.sign(diff) * Math.min(transitionSpeed, Math.abs(diff));
		}
	}

	// const playerWaveCenterY = 100;
	// const targetWaveCenterY = 220;

	// ★ 修正後: 画面の高さ（canvas.height）に対する割合で配置する
	// const playerWaveCenterY = canvas.height * 0.15; // 上から15%の位置
	// const targetWaveCenterY = canvas.height * 0.35; // 上から35%の位置
	// ★ 修正後: 画面の高さに比例したベースの振幅サイズを計算
	const baseAmp = 20; // 画面の高さの2.5%を波の基本振幅にする
	const playerWaveCenterY = canvas.height * 0.15;
	const targetWaveCenterY = canvas.height * 0.35;

	// ★ 円の配置基準位置 (キャンバス幅の1/5)
	const baseX = canvas.width / 5;

	// ガクッと急に波が小さくならないよう、滑らかにスケールを追従させる
	currentAmpScale += (targetAmpScale - currentAmpScale) * dt_sec * 5.0;

	// ==========================================
	// 2. メインの合成波 (問題の波)
	// ==========================================
	if (showLine) {
		let pts = [];
		// ★ 修正: xを3ピクセルずつ進めて計算量を1/3にする
		for (let x = -20; x <= canvas.width + 20; x += 3) {
			let t = (x + targetOffset) / targetSpeed;
			let y = 0;
			let d2 = 0; // 2階微分(曲率)
			for (let n = 1; n <= N; n++) {
				if (draw_a[n] !== 0 || draw_b[n] !== 0) {
					// ★ 修正: 毎回の割り算を避け、事前計算した配列を使う
					let omega = OMEGAS[n];
					let cos_val = Math.cos(omega * t);
					let sin_val = Math.sin(omega * t);
					y += draw_a[n] * cos_val + draw_b[n] * sin_val;
					if (enablePeakEmphasis) {
						// 加速度から上に凸かを判定
						d2 += -omega * omega * (draw_a[n] * cos_val + draw_b[n] * sin_val);
					}
				}
			}

			// ★ 修正: 補正スケールを Y と加速度(d2) に適用する
			y *= currentAmpScale;
			d2 *= currentAmpScale;

			let py = targetWaveCenterY - y * baseAmp;
			pts.push({ x: x, py: py, d2: d2 });
		}
		drawEmphasizedLine(ctx, pts, lineThickness, '#82a5c9', enablePeakEmphasis);
	}

	if (showDot) {
		let startK = Math.ceil(-baseX / dotSpacing); // 画面左端を描画するための開始インデックス
		for (let k = startK; ; k++) {
			let x = baseX + k * dotSpacing;
			if (x > canvas.width) break;

			let t = (x + targetOffset) / targetSpeed;
			let y = 0;
			for (let n = 1; n <= N; n++) {
				if (draw_a[n] !== 0 || draw_b[n] !== 0) {
					let omega = OMEGAS[n];
					y += draw_a[n] * Math.cos(omega * t) + draw_b[n] * Math.sin(omega * t);
				}
			}

			// ★ 修正: 補正スケールを適用
			y *= currentAmpScale;

			let py = targetWaveCenterY - y * baseAmp;

			// ★ 修正: 船が通常状態(0)のときだけ円をスキップする（飛んでいった後は円を描画する）
			if (showShip && isShipLoaded && k === 0 && shipAnimState === 0) {
				continue;
			}

			// k=0 (x=baseX) のときに必ず濃い円になるように計算
			let accentIndex = ((k % dotAccentInterval) + dotAccentInterval) % dotAccentInterval;
			let isAccent = accentIndex === 0;

			ctx.fillStyle = isAccent ? '#4b6c8f' : '#82a5c9';

			ctx.beginPath();
			ctx.arc(x, py, dotRadius, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// ★ 追加: 船のアニメーション計算
	if (shipAnimState === 1) {
		shipAnimTimer += dt / 1000;
		if (shipAnimTimer < 1.2) {
			// 0.4秒かけて左に最大40px下がる (サインカーブで滑らかに)
			shipOffsetX = -60 * Math.sin((shipAnimTimer / 1.2) * (Math.PI / 2));
		} else {
			shipAnimState = 2; // 加速ステートへ移行
			shipVelocityX = 0;
		}
	} else if (shipAnimState === 2) {
		// 右へ急加速 (加速度: 3000px/s^2)
		shipVelocityX += (dt / 1000) * 3000;
		shipOffsetX += shipVelocityX * (dt / 1000);
	}

	let currentShipX = baseX + shipOffsetX;

	// ★ 修正: 船のアイコンを波に乗せる処理 (baseX ではなく currentShipX を使用する)
	if (showShip && isShipLoaded) {
		let t_base = (currentShipX + targetOffset) / targetSpeed;
		let t_next = (currentShipX + 1 + targetOffset) / targetSpeed;
		let y_base = 0;
		let y_next = 0;

		for (let n = 1; n <= N; n++) {
			// 描画用の波に追従させる
			if (draw_a[n] !== 0 || draw_b[n] !== 0) {
				let omega = OMEGAS[n];
				y_base += draw_a[n] * Math.cos(omega * t_base) + draw_b[n] * Math.sin(omega * t_base);
				y_next += draw_a[n] * Math.cos(omega * t_next) + draw_b[n] * Math.sin(omega * t_next);
			}
		}

		// ★ 修正: 船が乗る波の高さにも補正スケールを適用
		y_base *= currentAmpScale;
		y_next *= currentAmpScale;

		let shipY = targetWaveCenterY - y_base * baseAmp;
		let shipY_next = targetWaveCenterY - y_next * baseAmp;

		let shipAngle = Math.atan2(shipY_next - shipY, 1);

		const maxAngle = 20 * (Math.PI / 180);
		if (shipAngle > maxAngle) shipAngle = maxAngle;
		if (shipAngle < -maxAngle) shipAngle = -maxAngle;

		let shipWidth = 40;
		let shipHeight = 40;

		// ==========================================
		// ★ 追加: 水しぶきの生成 (急加速中のみ)
		// ==========================================
		if (shipAnimState === 2) {
			// 1フレームあたり数個のしぶきを生成
			for (let i = 0; i < 2; i++) {
				splashes.push({
					x: currentShipX - 10 + Math.random() * 5, // 船の後ろの方
					y: shipY - 10 + Math.random() * 5, // 船の底付近
					vx: -150 - Math.random() * 150, // 左方向へ勢いよく散る
					vy: -20 + Math.random() * 40, // 上下に少しブレる
					radius: 1 + Math.random() * 3.5, // 大きさ
					alpha: 0.7 + Math.random() * 0.3, // 透明度
				});
			}
		}

		// ==========================================
		// ★ 追加: 水しぶきの更新と描画
		// ==========================================
		for (let i = splashes.length - 1; i >= 0; i--) {
			let p = splashes[i];
			p.x += p.vx * (dt / 1000);
			p.y += p.vy * (dt / 1000);
			p.radius += (dt / 1000) * 5; // 少しずつ大きくなる
			p.alpha -= (dt / 1000) * 1.5; // 約0.6秒でフワッと消える

			if (p.alpha <= 0) {
				splashes.splice(i, 1);
				continue;
			}

			ctx.beginPath();
			ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(130, 165, 201, ${p.alpha})`; // 水色っぽい白
			ctx.fill();
		}

		ctx.save();
		// currentShipX の位置に移動
		ctx.translate(currentShipX, shipY);

		// 飛んでいくときは船の先端を少し上に向ける演出を追加
		if (shipAnimState === 2) {
			shipAngle -= 0.2; // 上を向かせる
		}

		ctx.rotate(shipAngle);
		ctx.drawImage(coloredShipCanvas, -shipWidth / 2, -shipHeight + 0, shipWidth, shipHeight);
		ctx.restore();
	}

	// ==========================================
	// ★ 追加: 「ALL CLEAR!」テキストの演出
	// 船の表示設定に関わらず、クリア時に左から現れて中央で止まる
	// ==========================================
	if (isCleared && shipAnimState === 2) {
		let textX = Math.min(canvas.width / 2, currentShipX - 280);

		ctx.save();
		ctx.font = 'bold 24px Arial, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		let floatY = Math.sin(gameTime / 150) * 2;
		let textY = targetWaveCenterY - 25 + floatY;

		ctx.fillStyle = '#4b6c8f';
		ctx.fillText('ALL CLEAR!', textX, textY);

		ctx.restore();

		// ==========================================
		// ★ 追加: 「ALL CLEAR!」表示から数秒後（例: 2秒後）にボタンを表示する
		// ==========================================
		if (!isClearButtonsShown) {
			isClearButtonsShown = true;
			clearButtonTimer = setTimeout(() => {
				if (isCleared) {
					// ★ 追加: タイマー発火時に本当にクリア状態か確認
					const clearBtns = document.getElementById('clear-buttons-container');
					if (clearBtns) {
						clearBtns.style.display = 'flex';
					}
				}
			}, 1500);
		}
	}

	updateWaveBuffer();

	// ==========================================
	// 3. プレイヤーの波
	// ==========================================
	if (waveBuffer.length > 1) {
		if (showLine) {
			let pts = [];
			for (let i = 0; i < waveBuffer.length; i += 2) {
				let p = waveBuffer[i];
				let x = p.t * playerSpeed - playerOffset;

				if (x >= -20 && x <= canvas.width + 20) {
					let waveY = instantWaveMode ? p.baseY * displayAmplitude : p.y;
					let py = playerWaveCenterY - waveY * baseAmp;

					// ★ 修正: ENABLE_TOUCH_EFFECTS から enableRhythmEffects に変更
					if (enableRhythmEffects) {
						py -= Math.sin(x * 0.05) * globalShake * 2;
						for (let r of lineRipples) {
							let dx = Math.abs(x - r.x);
							let waveSpeed = 200;
							let dist = r.time * waveSpeed;
							if (dx < dist + 60 && dx > dist - 60) {
								let localPhase = (dx - dist) * 0.08;
								let rippleAmplitude = 5 * r.intensity * Math.cos(localPhase);
								py += rippleAmplitude;
							}
						}
					}
					// プレイヤー波の基本成分(cos)から上に凸を判定
					let d2 = enablePeakEmphasis ? -p.baseY : 0;
					pts.push({ x: x, py: py, d2: d2, state: p.state });
				}
			}

			// 状態に応じて動的に色を割り当てる関数
			let playerColorFunc = (p) => {
				let state = instantWaveMode ? playerTarget.hitState : p.state;
				return getWaveColorStr(state, false);
			};

			drawEmphasizedLine(ctx, pts, lineThickness + 0.5, playerColorFunc, enablePeakEmphasis);
		}

		if (showDot) {
			if (waveBuffer.length > 0) {
				let firstWorldX = waveBuffer[0].t * playerSpeed;
				let startK = Math.ceil(-baseX / dotSpacing);

				for (let k = startK; ; k++) {
					let x = baseX + k * dotSpacing;
					if (x > canvas.width) break;

					let worldX = x + playerOffset;
					let idx = Math.round(worldX - firstWorldX);

					if (idx >= 0 && idx < waveBuffer.length) {
						let p = waveBuffer[idx];

						// ★ モードによって高さを切り替え
						let waveY = instantWaveMode ? p.baseY * displayAmplitude : p.y;
						let py = playerWaveCenterY - waveY * baseAmp;

						// ★ 修正: ENABLE_TOUCH_EFFECTS から enableRhythmEffects に変更
						if (enableRhythmEffects) {
							py -= Math.sin(x * 0.05) * globalShake * 2;
							for (let r of lineRipples) {
								let dx = Math.abs(x - r.x);
								let waveSpeed = 200;
								let dist = r.time * waveSpeed;
								if (dx < dist + 60 && dx > dist - 60) {
									let localPhase = (dx - dist) * 0.08;
									let rippleAmplitude = 5 * r.intensity * Math.cos(localPhase);
									py += rippleAmplitude;
								}
							}
						}

						let renderState = instantWaveMode ? playerTarget.hitState : p.state;
						let accentIndex = ((k % dotAccentInterval) + dotAccentInterval) % dotAccentInterval;
						let isAccent = accentIndex === 0;
						setWaveStyle(renderState, true, isAccent);

						ctx.beginPath();
						ctx.arc(x, py, dotRadius, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}
		}
	}

	// ==========================================
	// 4. 分離された波 (下部)
	// ==========================================
	// ★ 修正: この問題に存在する正解の波の総数をカウントする
	let totalValidWaves = extracted.length;
	for (let n = 1; n <= N; n++) {
		if (a[n] !== 0 || b[n] !== 0) {
			totalValidWaves++;
		}
	}

	// 描画開始位置（画面の55%の位置から）
	let startY = canvas.height * 0.55;
	let endMargin = 40;
	let availableHeight = canvas.height - endMargin - startY;

	// ★ 修正: 波の間隔の最大値は「45px(固定)」
	let yOffset = Math.min(45, availableHeight / Math.max(1, totalValidWaves));

	// ★ 修正: 分離された波の振幅スケールの最大値も「12px(固定)」
	let ampScale = Math.min(12, yOffset * 0.4);

	for (let i = 0; i < extracted.length; i++) {
		let ex = extracted[i];

		// 係数のアニメーション遷移
		if (ex.draw_a !== ex.a) {
			let diff = ex.a - ex.draw_a;
			ex.draw_a += Math.sign(diff) * Math.min(transitionSpeed, Math.abs(diff));
		}
		if (ex.draw_b !== ex.b) {
			let diff = ex.b - ex.draw_b;
			ex.draw_b += Math.sign(diff) * Math.min(transitionSpeed, Math.abs(diff));
		}

		// ★ 修正: 計算した yOffset を使ってベースのY座標を決定
		let baseY = startY + i * yOffset;

		if (showLine) {
			let pts = [];
			// ★ 修正: 3ピクセルずつ進める
			for (let x = -20; x <= canvas.width + 20; x += 3) {
				let t = (x + targetOffset) / targetSpeed;
				// ★ 修正: OMEGASから取得
				let omega = OMEGAS[ex.n];
				let y = ex.draw_a * Math.cos(omega * t) + ex.draw_b * Math.sin(omega * t);

				// 滑らかなピーク強調用の微分計算
				let d2 = enablePeakEmphasis ? -omega * omega * y : 0;

				// 調整された ampScale を適用してY座標を計算
				let py = baseY - y * ampScale;
				pts.push({ x: x, py: py, d2: d2 });
			}
			let colorStr = `hsla(${ex.n * 50}, 60%, 65%, 0.8)`;
			drawEmphasizedLine(ctx, pts, Math.max(1, lineThickness - 0.5), colorStr, enablePeakEmphasis);
		}

		if (showDot) {
			let startK = Math.ceil(-baseX / dotSpacing);

			// ★ 修正: パスをまとめて一回で描画するための準備 (Path2D)
			let pathNormal = new Path2D();
			let pathAccent = new Path2D();
			let radius = Math.max(1, dotRadius - 1);

			for (let k = startK; ; k++) {
				let x = baseX + k * dotSpacing;
				if (x > canvas.width) break;

				let t = (x + targetOffset) / targetSpeed;
				let omega = OMEGAS[ex.n];
				let y = ex.draw_a * Math.cos(omega * t) + ex.draw_b * Math.sin(omega * t);

				let py = baseY - y * ampScale;
				let accentIndex = ((k % dotAccentInterval) + dotAccentInterval) % dotAccentInterval;
				let isAccent = accentIndex === 0;

				// ★ 修正: 描画せず、パスに円の形だけを追加していく
				if (isAccent) {
					pathAccent.moveTo(x + radius, py);
					pathAccent.arc(x, py, radius, 0, Math.PI * 2);
				} else {
					pathNormal.moveTo(x + radius, py);
					pathNormal.arc(x, py, radius, 0, Math.PI * 2);
				}
			}

			// ★ 修正: 最後にまとめて色を塗る (stroke/fillの呼び出し回数が激減します)
			ctx.fillStyle = `hsla(${ex.n * 50}, 60%, 65%, 0.8)`; // 通常色
			ctx.fill(pathNormal);

			ctx.fillStyle = `hsla(${ex.n * 50}, 60%, 45%, 1.0)`; // アクセント色 (明度を下げて濃く)
			ctx.fill(pathAccent);
		}
	}

	// ==========================================
	// ★ 追加: 音ゲーライクエフェクトの更新と描画
	// ==========================================
	if (enableRhythmEffects) {
		// // 1. コンボ表示 (背景に大きく脈打つように表示)
		// if (currentCombo >= 2) {
		// 	ctx.save();
		// 	ctx.font = 'bold 80px "Arial Black", sans-serif';
		// 	ctx.textAlign = 'center';
		// 	ctx.textBaseline = 'middle';
		// 	ctx.fillStyle = `rgba(255, 215, 0, 0.15)`; // 薄いゴールド

		// 	// ポップなアニメーション (時間経過で少しだけ伸縮する)
		// 	let scale = 1 + Math.sin(performance.now() / 100) * 0.05;
		// 	ctx.translate(canvas.width / 2, canvas.height / 2);
		// 	ctx.scale(scale, scale);
		// 	ctx.fillText(currentCombo + ' COMBO!', 0, 0);
		// 	ctx.restore();
		// }

		// 2. タップパーティクル (重力で少し落ちながらフェードアウト)
		for (let i = tapParticles.length - 1; i >= 0; i--) {
			let p = tapParticles[i];
			p.x += p.vx * dt_sec;
			p.y += p.vy * dt_sec;
			p.vy += 200 * dt_sec; // 下方向への重力
			p.life -= dt_sec * 2.5;

			if (p.life <= 0) {
				tapParticles.splice(i, 1);
				continue;
			}

			ctx.beginPath();
			ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
			ctx.fillStyle = p.color;
			ctx.globalAlpha = p.life;
			ctx.fill();
			ctx.globalAlpha = 1.0;
		}

		// // 3. 判定フローティングテキスト (上に登りながらフェードアウト)
		// for (let i = floatingTexts.length - 1; i >= 0; i--) {
		// 	let ft = floatingTexts[i];
		// 	ft.y -= 50 * dt_sec; // 上へ移動
		// 	ft.life -= dt_sec * 1.2;

		// 	if (ft.life <= 0) {
		// 		floatingTexts.splice(i, 1);
		// 		continue;
		// 	}

		// 	ctx.save();
		// 	ctx.font = 'bold 28px "Arial Black", sans-serif';
		// 	ctx.textAlign = 'center';
		// 	ctx.textBaseline = 'middle';

		// 	// ライフ(1.0 -> 0.0)に合わせて拡大していく演出
		// 	let tScale = 1.0 + (1.0 - ft.life) * 0.5;
		// 	ctx.translate(ft.x, ft.y);
		// 	ctx.scale(tScale, tScale);

		// 	// 文字の縁取り
		// 	ctx.lineWidth = 4;
		// 	ctx.strokeStyle = '#ffffff';
		// 	ctx.globalAlpha = ft.life;
		// 	ctx.strokeText(ft.text, 0, 0);

		// 	// 文字の塗りつぶし
		// 	ctx.fillStyle = ft.color;
		// 	ctx.fillText(ft.text, 0, 0);

		// 	ctx.restore();
		// }
	}

	// ==========================================
	// 5. 新キャンバスへ係数グラフを描画
	// ==========================================
	drawCoefficientGraph();

	// ==========================================
	// ★ 画面左上にゲームモードを表示
	// ==========================================
	if (currentGameMode) {
		ctx.save();
		ctx.font = 'bold 16px Arial, sans-serif'; // 文字のフォントとサイズ
		ctx.fillStyle = '#4b6c8f'; // 文字色（見やすい青灰色など）
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';

		// 左上 (X: 20px, Y: 20px) の位置に描画
		ctx.fillText(`${currentGameMode}`, 20, 20);

		ctx.restore();
	}
}

// ==========================================
// ★ 追加: 設定の保存と読み込み機能
// ==========================================

// デフォルト設定の定義
const defaultSettings = {
	waveSpeed: 400,
	lineThickness: 2.5,
	dotSpacing: 60,
	dotRadius: 8,
	dotAccentInterval: 6,
	showLine: true,
	showDot: false,
	showShip: true,
	isGraphVisible: true,
	selectedShip: 'ship_1.svg',
};

// 1. 設定を適用する関数 (UIとゲーム内変数を両方更新する)
window.applySettings = function (settings) {
	// スライダーのUI更新
	document.getElementById('speedSlider').value = settings.waveSpeed;
	document.getElementById('lineThicknessSlider').value = settings.lineThickness;
	document.getElementById('dotSpacingSlider').value = settings.dotSpacing;
	document.getElementById('dotRadiusSlider').value = settings.dotRadius;
	document.getElementById('dotAccentIntervalSlider').value = settings.dotAccentInterval;

	// ゲーム内パラメーターの更新
	if (typeof setWaveSpeed === 'function') setWaveSpeed(settings.waveSpeed);
	if (typeof setLineThickness === 'function') setLineThickness(settings.lineThickness);
	if (typeof setDotSpacing === 'function') setDotSpacing(settings.dotSpacing);
	if (typeof setDotRadius === 'function') setDotRadius(settings.dotRadius);
	if (typeof setDotAccentInterval === 'function') setDotAccentInterval(settings.dotAccentInterval);

	// トグル系フラグの更新
	if (typeof showLine !== 'undefined') showLine = settings.showLine;
	if (typeof showDot !== 'undefined') showDot = settings.showDot;
	if (typeof showShip !== 'undefined') showShip = settings.showShip;
	isGraphVisible = settings.isGraphVisible;

	// ==========================================
	// ★ 追加: トグルスイッチのUI表示状態を同期させる
	// ==========================================
	if (document.getElementById('chkShowLine'))
		document.getElementById('chkShowLine').checked = showLine;
	if (document.getElementById('chkShowDot'))
		document.getElementById('chkShowDot').checked = showDot;
	if (document.getElementById('chkShowShip'))
		document.getElementById('chkShowShip').checked = showShip;

	// ==========================================
	// ★ 修正: グラフの表示反映（コンテナとボタンの両方を制御する）
	// ==========================================
	const graphContainer = document.getElementById('graph-container');
	const showGraphBtn = document.getElementById('showGraphBtn');

	if (graphContainer) {
		graphContainer.style.display = isGraphVisible ? 'block' : 'none';
	}
	if (showGraphBtn) {
		showGraphBtn.style.display = isGraphVisible ? 'none' : 'flex';
	}
	// ==========================================

	// 自機の反映
	nextShipSrc = settings.selectedShip;
	document.querySelectorAll('.ship-btn').forEach((btn) => {
		if (btn.getAttribute('data-ship') === settings.selectedShip) {
			btn.classList.add('active');
			if (typeof shipImage !== 'undefined') {
				isShipLoaded = false;
				shipImage.src = settings.selectedShip;
			}
		} else {
			btn.classList.remove('active');
		}
	});
};

// 2. 現在の状態を localStorage に保存する関数
window.saveSettings = function () {
	const settings = {
		waveSpeed: Number(document.getElementById('speedSlider').value),
		lineThickness: Number(document.getElementById('lineThicknessSlider').value),
		dotSpacing: Number(document.getElementById('dotSpacingSlider').value),
		dotRadius: Number(document.getElementById('dotRadiusSlider').value),
		dotAccentInterval: Number(document.getElementById('dotAccentIntervalSlider').value),
		showLine: typeof showLine !== 'undefined' ? showLine : true,
		showDot: typeof showDot !== 'undefined' ? showDot : true,
		showShip: typeof showShip !== 'undefined' ? showShip : true,
		isGraphVisible: isGraphVisible,
		selectedShip: nextShipSrc,
	};
	localStorage.setItem('fourielSettings', JSON.stringify(settings));
};

// 3. localStorage から読み込む関数
window.loadSettings = function () {
	const savedData = localStorage.getItem('fourielSettings');
	let settings = { ...defaultSettings }; // デフォルトをベースにする
	if (savedData) {
		try {
			// 保存データがあれば上書きする
			const parsed = JSON.parse(savedData);
			settings = { ...settings, ...parsed };
		} catch (e) {
			console.error('設定の読み込みに失敗しました', e);
		}
	}
	applySettings(settings);
};

// 4. デフォルトに戻す関数
window.resetSettings = function () {
	// if (confirm('設定をデフォルトに戻しますか？')) {
	// 現在の自機の選択状態を取得して保持する
	// 現在の自機の選択状態とグラフの表示状態を取得して保持する
	const currentShip = nextShipSrc;
	const currentGraphVisible = isGraphVisible;

	// デフォルト設定を展開しつつ、保持したい項目だけ現在の値で上書きして適用する
	const settingsToApply = {
		...defaultSettings,
		selectedShip: currentShip,
		isGraphVisible: currentGraphVisible,
	};

	applySettings(settingsToApply);
	saveSettings();
	// }
};

// ★ 追加: ロード時に保存された設定を読み込んで反映する
loadSettings();

// ==========================================
// ★ 修正: ホーム画面の波とタイトルのアニメーション (減衰処理をゲーム画面と完全統一)
// ==========================================
let homeRipples = []; // タップ時の波紋エフェクト配列
let homeWaveBuffer = []; // 波の履歴を保存するバッファ
let homePlayerOffset = 0; // ホーム画面用のスクロールオフセット
let homeFreqMultiplier = 1.0; // 波の周波数倍率
let cachedTitleColor = null;
let lastHomeTime = performance.now();
let homeLastTapTime = 0; // 最後にタップした時間を記録
let homeCurrentDecayRate = 0; // ★ 追加: 現在の振幅減衰率
let homeTapIntervals = []; // ★ 追加: 実際のタップ間隔を記録する配列

// ラグありモード（instantWaveMode = false）を再現するためのターゲットとジェネレータ
const defaultHomeOmega = (2 * Math.PI) / (2400 / 1000);
let homePlayerTarget = {
	omega: defaultHomeOmega,
	amplitude: 0,
};
let homeGenerator = {
	lastT: 0,
	phi: 0,
	omega: defaultHomeOmega,
	omegaVel: 0,
	amplitude: 0,
	ampVel: 0,
};

// ==========================================
// ★ 追加: ホーム画面の波を初期状態にリセットする関数
// ==========================================
function resetHomeWave() {
	const tBase = typeof T_base !== 'undefined' ? T_base : 2400;
	const baseOmega = (2 * Math.PI) / (tBase / 1000);

	homePlayerTarget = { omega: baseOmega, amplitude: 0 };
	homeGenerator = { lastT: 0, phi: 0, omega: baseOmega, omegaVel: 0, amplitude: 0, ampVel: 0 };
	homeFreqMultiplier = 1.0;
	homeLastTapTime = 0;
	homeCurrentDecayRate = 0;
	homeTapIntervals = [];
	homeRipples = [];
	homeWaveBuffer = [];
}

function initHomeWave() {
	const canvas = document.getElementById('homeWaveCanvas');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');

	// 上が見切れないよう高さを少し拡張 (100 -> 140)
	canvas.width = 800;
	canvas.height = 140;

	// 波紋専用キャンバスの初期化
	let rippleCanvas = document.getElementById('homeRippleCanvas');
	if (!rippleCanvas) {
		rippleCanvas = document.createElement('canvas');
		rippleCanvas.id = 'homeRippleCanvas';
		rippleCanvas.style.position = 'fixed';
		rippleCanvas.style.top = '0';
		rippleCanvas.style.left = '0';
		rippleCanvas.style.pointerEvents = 'none';
		rippleCanvas.style.zIndex = '9999';
		document.body.appendChild(rippleCanvas);
	}
	const rippleCtx = rippleCanvas.getContext('2d');

	const resizeRippleCanvas = () => {
		rippleCanvas.width = window.innerWidth;
		rippleCanvas.height = window.innerHeight;
	};
	window.addEventListener('resize', resizeRippleCanvas);
	resizeRippleCanvas();

	const chars = document.querySelectorAll('.title-char');
	const waveCenterY = canvas.height / 2 - 30; // タイトルに近づけた基準位置

	let wasHidden = false; // ★ 非表示からの切り替わり検知フラグ

	const addTap = (e) => {
		if (e && e.target && e.target.closest('button, a, input, select, [role="button"]')) {
			return;
		}

		if (e) e.preventDefault();
		let now = performance.now();
		let clientX = e.touches
			? e.touches[0].clientX
			: e.clientX !== undefined
				? e.clientX
				: window.innerWidth / 2;
		let clientY = e.touches
			? e.touches[0].clientY
			: e.clientY !== undefined
				? e.clientY
				: window.innerHeight / 2;

		const tBase = typeof T_base !== 'undefined' ? T_base : 2400;

		if (homeLastTapTime !== 0) {
			let dtTap = now - homeLastTapTime;
			if (dtTap >= tBase * 1.5) {
				homeFreqMultiplier = 1.0;
				homeTapIntervals = [];
			} else {
				homeTapIntervals.push(dtTap);
				if (homeTapIntervals.length > 3) homeTapIntervals.shift();
				let avgInterval = homeTapIntervals.reduce((a, b) => a + b, 0) / homeTapIntervals.length;
				avgInterval = Math.max(avgInterval, tBase / 8.0);
				homeFreqMultiplier = tBase / avgInterval;
			}
		}
		homeLastTapTime = now;

		let step = typeof tapAmplitudeStep !== 'undefined' ? tapAmplitudeStep : 0.75;
		let maxAmp = typeof maxPlayerAmplitude !== 'undefined' ? maxPlayerAmplitude : 1.5;

		homePlayerTarget.amplitude = Math.min(homePlayerTarget.amplitude + step, maxAmp);

		const baseOmega = (2 * Math.PI) / (tBase / 1000);
		homePlayerTarget.omega = baseOmega * homeFreqMultiplier;

		homeRipples.push({ x: clientX, y: clientY, radius: 0, alpha: 0.6 });
	};

	document.addEventListener('mousedown', addTap);
	document.addEventListener('touchstart', addTap, { passive: false });

	function drawHome() {
		requestAnimationFrame(drawHome);

		const homeScreen = document.getElementById('home-screen');
		const isHidden = homeScreen && homeScreen.style.display === 'none';

		// 非表示中（ゲーム画面表示中など）
		if (isHidden) {
			wasHidden = true; // 次回表示時にリセットするためのフラグを設定
			lastHomeTime = performance.now();
			return;
		}

		// ★ ホーム画面に戻ってきた瞬間のリセット処理
		if (wasHidden) {
			resetHomeWave();
			wasHidden = false;
		}

		let now = performance.now();
		let dt = now - lastHomeTime;
		lastHomeTime = now;

		if (dt > 100 || dt < 0) dt = 16;
		let dt_sec = dt / 1000;

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		rippleCtx.clearRect(0, 0, rippleCanvas.width, rippleCanvas.height);

		if (!cachedTitleColor && chars.length > 0) {
			cachedTitleColor = window.getComputedStyle(chars[0]).color;
		}
		const waveColor = cachedTitleColor || 'rgba(255, 255, 255, 0.85)';

		const speed = typeof targetSpeed !== 'undefined' ? targetSpeed : 400;
		const tBase = typeof T_base !== 'undefined' ? T_base : 2400;
		const baseOmega = (2 * Math.PI) / (tBase / 1000);

		homePlayerOffset += dt_sec * speed;

		// 減衰・消失判定
		let expectedInterval = ((2 * Math.PI) / homePlayerTarget.omega) * 1000;
		let timeSinceLastTap = now - homeLastTapTime;
		let isTapping = homeLastTapTime !== 0 && timeSinceLastTap <= expectedInterval * 1.5 + 150;

		let omegaRatio = homeFreqMultiplier;
		let targetDecayRate = isTapping ? 0.1 * omegaRatio : 0.2 + 2 * omegaRatio;

		homeCurrentDecayRate += (targetDecayRate - homeCurrentDecayRate) * (dt_sec * 5.0);
		homePlayerTarget.amplitude -= homeCurrentDecayRate * dt_sec;

		if (homePlayerTarget.amplitude <= 0) {
			homePlayerTarget.amplitude = 0;
			homeFreqMultiplier = 1.0;
			homeTapIntervals = [];
		}

		homePlayerTarget.omega = baseOmega * homeFreqMultiplier;

		// 波バッファの生成
		let t_right = (canvas.width + 100 + homePlayerOffset) / speed;
		const dt_step = 1 / speed;

		if (homeGenerator.lastT === 0) {
			homeGenerator.lastT = homePlayerOffset / speed;
		}

		while (homeGenerator.lastT < t_right) {
			homeGenerator.lastT += dt_step;

			let omegaAccel = (homePlayerTarget.omega - homeGenerator.omega) * 0.02;
			homeGenerator.omegaVel += omegaAccel;
			homeGenerator.omegaVel *= 0.75;
			homeGenerator.omega += homeGenerator.omegaVel;
			homeGenerator.phi += homeGenerator.omega * dt_step;

			let ampAccel = (homePlayerTarget.amplitude - homeGenerator.amplitude) * 0.03;
			homeGenerator.ampVel += ampAccel;
			homeGenerator.ampVel *= 0.65;
			homeGenerator.amplitude += homeGenerator.ampVel;
			if (homeGenerator.amplitude < 0) homeGenerator.amplitude = 0;

			let baseY = 2 * Math.cos(homeGenerator.phi);
			let y = homeGenerator.amplitude * baseY;

			homeWaveBuffer.push({
				t: homeGenerator.lastT,
				y: y,
				baseY: baseY,
			});
		}

		let t_left = (-100 + homePlayerOffset) / speed;
		let removeCount = 0;
		while (homeWaveBuffer.length > removeCount && homeWaveBuffer[removeCount].t < t_left) {
			removeCount++;
		}
		if (removeCount > 0) {
			homeWaveBuffer.splice(0, removeCount);
		}

		// 1. 波紋描画
		for (let i = homeRipples.length - 1; i >= 0; i--) {
			let r = homeRipples[i];
			rippleCtx.save();
			rippleCtx.beginPath();
			rippleCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
			rippleCtx.strokeStyle = waveColor;
			rippleCtx.globalAlpha = r.alpha;
			rippleCtx.lineWidth = 2;
			rippleCtx.stroke();
			rippleCtx.restore();

			r.radius += dt * 0.2;
			r.alpha -= dt / 800;
			if (r.alpha <= 0) homeRipples.splice(i, 1);
		}

		// 2. 波の描画
		const baseAmp = 15;
		let pts = [];

		for (let i = 0; i < homeWaveBuffer.length; i += 2) {
			let p = homeWaveBuffer[i];
			let x = p.t * speed - homePlayerOffset;

			if (x >= -20 && x <= canvas.width + 20) {
				let py = waveCenterY - (p.y / 2) * baseAmp;
				let d2 = typeof enablePeakEmphasis !== 'undefined' && enablePeakEmphasis ? -p.baseY : 0;
				pts.push({ x: x, py: py, d2: d2 });
			}
		}

		let colorFunc = () => waveColor;

		if (typeof drawEmphasizedLine === 'function') {
			let thick = typeof lineThickness !== 'undefined' ? lineThickness + 0.5 : 3.0;
			drawEmphasizedLine(
				ctx,
				pts,
				thick,
				colorFunc,
				typeof enablePeakEmphasis !== 'undefined' ? enablePeakEmphasis : true,
			);
		} else {
			ctx.beginPath();
			ctx.lineWidth = 3;
			ctx.strokeStyle = waveColor;
			for (let i = 0; i < pts.length; i++) {
				if (i === 0) ctx.moveTo(pts[i].x, pts[i].py);
				else ctx.lineTo(pts[i].x, pts[i].py);
			}
			ctx.stroke();
		}

		// 3. タイトル文字のアニメーション
		if (chars.length > 0 && homeWaveBuffer.length > 0) {
			const startX = canvas.width / 2 - 120;
			const charSpacing = 30;
			const firstWorldX = homeWaveBuffer[0].t * speed;

			chars.forEach((span, i) => {
				let charX = startX + i * charSpacing;
				if (span.classList.contains('version')) {
					charX += 50;
				}

				let worldX = charX + homePlayerOffset;
				let idx = Math.round(worldX - firstWorldX);

				if (idx >= 0 && idx < homeWaveBuffer.length) {
					let y = homeWaveBuffer[idx].y / 2;
					span.style.transform = `translateY(${-y * 6}px)`;
				}
			});
		}
	}

	requestAnimationFrame(drawHome);
}

// ホーム画面の波ループを起動
initHomeWave();

initGame();
requestAnimationFrame(draw);

// ==========================================
// 次の問題に進むボタンの処理
// ==========================================
const nextButton = document.getElementById('nextButton');
if (nextButton) {
	nextButton.addEventListener('click', () => {
		initGame(); // ゲームの状態をリセットして新しい波を生成
	});
}

// ==========================================
// ★ 修正: ホーム画面に戻る処理 (表示切替)
// ==========================================
window.goHome = function () {
	// ホーム画面を表示する
	document.getElementById('home-screen').style.display = 'flex';

	// クリア画面のボタン群が開いていたら隠す
	const clearBtns = document.getElementById('clear-buttons-container');
	if (clearBtns) {
		clearBtns.style.display = 'none';
	}
	isClearButtonsShown = false;

	// 裏でゲームが動き続けないように一時停止にする
	if (!isPaused) {
		togglePause();
	}
};

// ==========================================
// ★ 修正: ゲームスタート処理 (モード引数を追加)
// ==========================================
window.startGame = function (mode) {
	console.log('選択されたモード:', mode);

	// ★ 受け取った mode を保存（マッピング定義があれば日本語名に、なければそのまま設定）
	currentGameMode = modeNames[mode] || mode;

	// ※ 今後ここでモードごとの設定（波の数 N の変更やスピード調整など）を分岐させることができます。
	// 例: if (mode === 'easy') { targetSpeed = 300; N = 3; } など

	// ホーム画面を隠す
	document.getElementById('home-screen').style.display = 'none';

	// ホーム画面で設定メニュー（ui-container）を開いたままスタートした場合は閉じる
	if (isSettingsOpen) {
		toggleSettings();
	}

	// 一時停止状態なら解除する
	if (isPaused) {
		togglePause();
	}

	// ゲームを初期化して開始
	initGame();
};

// ==========================================
// ★ 追加: 次の問題に進む処理（設定画面の処理を流用）
// ==========================================
window.nextProblem = function () {
	// ボタンを隠す
	const clearBtns = document.getElementById('clear-buttons-container');
	if (clearBtns) {
		clearBtns.style.display = 'none';
	}
	isClearButtonsShown = false;

	// 設定画面にある「次の問題に進む」ボタンの処理を流用・実行
	initGame();
};
