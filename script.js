// --- 1. 基本設定 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x003366); 
scene.fog = new THREE.FogExp2(0x003366, 0.012);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);
const clock = new THREE.Clock();

let zukanOpen = false; 
let foundCount = 0;

// スマホ（タッチデバイス）かどうかの判定
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 'ontouchstart' in window;

// --- 2. プレイヤー操作と照明の設定 ---
const controls = new THREE.PointerLockControls(camera, document.body);
const startScreen = document.getElementById('start-screen');

startScreen.addEventListener('click', () => {
    startScreen.style.display = 'none';
    if (!isMobile) {
        controls.lock(); // PCの場合のみマウスをロック
    } else {
        document.getElementById('mobile-controls').style.display = 'block'; // スマホの場合はボタンを表示
    }
});

controls.addEventListener('unlock', () => { 
    if(!isMobile && !zukanOpen && foundCount < 200) startScreen.style.display = 'flex'; 
});
scene.add(controls.getObject());

const ambientLight = new THREE.AmbientLight(0x224466, 2.0); 
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xaaccff, 3.0);
dirLight.position.set(50, 200, 50);
scene.add(dirLight);

const headLight = new THREE.SpotLight(0xffffff, 500, 400, Math.PI / 4, 0.8, 1);
headLight.position.set(0, 0, 0); headLight.target.position.set(0, 0, -1);
camera.add(headLight, headLight.target);
let isLightOn = true;

function getGroundElevation(x, z) { return Math.sin(x * 0.04) * Math.cos(z * 0.04) * 12; }

// --- 3. 動的テクスチャ生成 ---
function createScaleTexture(colorHex) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + colorHex.toString(16).padStart(6, '0'); ctx.fillRect(0, 0, 256, 128);
    const grad = ctx.createLinearGradient(0, 0, 0, 128); grad.addColorStop(0, 'rgba(0,0,0,0.6)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(255,255,255,0.7)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    for(let y = 0; y < 128; y += 8) { for(let x = 0; x < 256; x += 12) { ctx.beginPath(); ctx.arc(x + ((y/8)%2===0?0:6), y, 8, 0, Math.PI); ctx.stroke(); } }
    return new THREE.CanvasTexture(canvas);
}
function createFinTexture(colorHex) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0)'; ctx.fillRect(0, 0, 128, 128);
    const grad = ctx.createLinearGradient(0, 0, 0, 128); grad.addColorStop(0, '#' + colorHex.toString(16).padStart(6, '0')); grad.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(128, 0); ctx.lineTo(128, 128); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; for(let i=0; i<=10; i++) { ctx.beginPath(); ctx.moveTo(i*12.8, 128); ctx.lineTo(128, 128 - i*12.8); ctx.stroke(); }
    return new THREE.CanvasTexture(canvas);
}

// --- 4. 超リアルな魚モデル生成 ---
function createUltraRealFish(data) {
    const fishGroup = new THREE.Group();
    const scaleTex = createScaleTexture(data.colorHex);
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: scaleTex, bumpMap: scaleTex, bumpScale: 0.02, roughness: 0.2, metalness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.1 });
    const finTex = createFinTexture(data.colorHex);
    const finMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: finTex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, roughness: 0.3, clearcoat: 0.5 });

    const bodyGeo = new THREE.SphereGeometry(1.5, 32, 16);
    if(data.shapeType === 'lng') bodyGeo.scale(0.6, 0.8, 2.5); else if(data.shapeType === 'flt') bodyGeo.scale(0.3, 1.5, 1.2); else if(data.shapeType === 'rnd') bodyGeo.scale(1.2, 1.2, 1.0); else bodyGeo.scale(0.8, 1.2, 1.8);
    const body = new THREE.Mesh(bodyGeo, bodyMat); fishGroup.add(body);

    const eyeGeo = new THREE.SphereGeometry(0.15, 16, 16); const eyeMatWhite = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.1 }); const eyeMatBlack = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 });
    const leftEye = new THREE.Group(); leftEye.add(new THREE.Mesh(eyeGeo, eyeMatWhite)); const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), eyeMatBlack); leftPupil.position.z = 0.1; leftEye.add(leftPupil);
    let eyeZ = data.shapeType==='lng' ? 3.0 : 1.8; let eyeX = data.shapeType==='flt' ? 0.4 : 1.1;
    
    // 目標：位置にスケールを掛けない
    leftEye.position.set(eyeX, 0.2, eyeZ); leftEye.rotation.y = Math.PI / 6;
    const rightEye = leftEye.clone(); rightEye.position.x = -eyeX; rightEye.rotation.y = -Math.PI / 6; fishGroup.add(leftEye, rightEye);

    const finPlaneGeo = new THREE.PlaneGeometry(1.5, 1.5); finPlaneGeo.translate(0.75, 0.75, 0); 
    
    // 目標：背びれ、胸びれの位置にスケールを掛けない
    const dorsalFin = new THREE.Mesh(finPlaneGeo, finMat); dorsalFin.position.set(0, (data.shapeType==='flt'?2.0:1.4), 0.5); dorsalFin.rotation.y = -Math.PI / 2; if(data.shapeType==='flt') dorsalFin.scale.set(1.5, 1.5, 1); fishGroup.add(dorsalFin);
    const pectoralFinL = new THREE.Mesh(finPlaneGeo, finMat); pectoralFinL.position.set(1.0, -0.5, 1.2); pectoralFinL.rotation.set(-Math.PI/4, Math.PI/4, Math.PI/4); pectoralFinL.scale.set(0.6, 0.6, 0.6);
    const pectoralFinR = pectoralFinL.clone(); pectoralFinR.position.x = -1.0; pectoralFinR.rotation.set(-Math.PI/4, -Math.PI/4, -Math.PI/4); fishGroup.add(pectoralFinL, pectoralFinR);

    // 目標：しっぽの位置にスケールを掛けない
    const tailJoint = new THREE.Group(); tailJoint.position.z = (data.shapeType==='lng'?-3.5 : data.shapeType==='rnd'?-1.2 : -2.5);
    const tailGeo = new THREE.PlaneGeometry(2, 2); tailGeo.translate(0, 1, 0); const tail = new THREE.Mesh(tailGeo, finMat); tail.rotation.y = -Math.PI / 2; tail.rotation.z = -Math.PI / 4; tail.position.z = -0.5; tailJoint.add(tail); fishGroup.add(tailJoint);

    const checkTex = new THREE.CanvasTexture(document.createElement('canvas').getContext('2d').canvas); checkTex.image.width=128; checkTex.image.height=128; const cCtx = checkTex.image.getContext('2d'); cCtx.fillStyle = '#00ff44'; cCtx.font = 'bold 100px Arial'; cCtx.textAlign = 'center'; cCtx.textBaseline = 'middle'; cCtx.fillText('✔', 64, 64); checkTex.needsUpdate=true;
    const checkSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: checkTex, depthTest: false })); checkSprite.scale.set(3, 3, 1); checkSprite.position.y = 3; checkSprite.visible = false; fishGroup.add(checkSprite);

    // ここでまとめてスケール（大きさ）を適用
    fishGroup.scale.set(data.scale, data.scale, data.scale);
    
    fishGroup.userData = { id: data.id, bodyMesh: body, tailJoint: tailJoint, pecL: pectoralFinL, pecR: pectoralFinR, checkSprite: checkSprite, velocity: new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize().multiplyScalar(5), speed: 4 + Math.random() * 8, swimPhase: Math.random() * Math.PI * 2, targetBank: 0, type: 'fish' };
    fishGroup.position.set((Math.random() - 0.5) * 500, Math.random() * 60 + 15, (Math.random() - 0.5) * 500);
    scene.add(fishGroup); fishList.push(fishGroup); interactableObjects.push(body); body.userData.parentGroup = fishGroup;
}

// --- 5. データリスト ---
const rawFishList = [
    "クマノミ,std,ff6600,0.5","ナンヨウハギ,flt,0033ff,0.6","ツノダシ,flt,ffffff,0.7","チョウチョウウオ,flt,ffff00,0.6","エンゼルフィッシュ,flt,cccccc,0.7",
    "ホホジロザメ,lng,999999,3.5","ジンベエザメ,lng,445566,5.0","シュモクザメ,lng,888888,3.0","イタチザメ,lng,666655,3.2","オオメジロザメ,lng,777777,2.8",
    "シロナガスクジラ,lng,446688,8.0","マッコウクジラ,lng,333333,7.0","ザトウクジラ,lng,222233,6.5","シャチ,lng,111111,4.0","バンドウイルカ,lng,8899aa,2.5",
    "クロマグロ,std,112244,2.5","キハダマグロ,std,ffff33,2.3","メバチマグロ,std,223355,2.4","カジキマグロ,lng,224488,3.0","バショウカジキ,lng,334499,2.8",
    "マンタ,flt,222222,4.0","マダラトビエイ,flt,333333,2.5","アカエイ,flt,cc8855,1.5","ノコギリエイ,flt,998877,2.8","シビレエイ,flt,aa9977,1.2",
    "マンボウ,rnd,cccccc,3.0","リュウグウノツカイ,lng,ffaaaa,4.0","シーラカンス,std,444455,2.0","チョウチンアンコウ,rnd,111111,1.5","デメニギス,std,222222,0.8",
    "ヒラメ,flt,887755,1.5","カレイ,flt,776644,1.2","タツノオトシゴ,exo,ffcc55,0.4","ミノカサゴ,exo,ff5555,1.0","オニダルマオコゼ,exo,665544,1.2",
    "ハリセンボン,rnd,ddccaa,0.8","トラフグ,rnd,bbbbaa,1.0","ハコフグ,rnd,eeee55,0.6","ウマヅラハギ,flt,aaaa99,0.8","モンガラカワハギ,flt,333333,0.9",
    "ブダイ,std,33aa88,1.2","メガネモチノウオ,std,228866,2.5","ホンソメワケベラ,lng,3388ff,0.3","ハゼ,lng,aaaaaa,0.3","ギンポ,lng,888888,0.4",
    "ニシキテグリ,exo,33ccaa,0.3","キイロハギ,flt,ffff22,0.7","ニザダイ,flt,555555,0.9","クエ,std,554433,2.5","マハタ,std,665544,2.0",
    "スズキ,std,aaaaaa,1.5","マダイ,std,ff8888,1.2","チダイ,std,ff7777,1.0","クロダイ,std,444444,1.2","イシダイ,flt,bbbbbb,1.1",
    "ブリ,std,8899aa,1.8","カンパチ,std,aaaa99,1.7","ヒラマサ,std,99aa99,1.7","シマアジ,std,dddddd,1.2","アジ,std,bbbbcc,0.6",
    "サバ,lng,5588cc,0.7","イワシ,lng,99aabb,0.4","サンマ,lng,8899aa,0.6","トビウオ,std,4466aa,0.7","サヨリ,lng,cccccc,0.5",
    "ダツ,lng,aaaaaa,1.2","カマス,lng,999999,1.0","サケ,std,ffaaaa,1.5","マス,std,ffbbbb,1.2","ニジマス,std,ffcccc,1.0",
    "ピラルク,lng,dd5555,3.0","アロワナ,lng,ffccaa,1.8","ネオンテトラ,std,00ffff,0.2","グッピー,std,ff55aa,0.2","プラティ,std,ff4400,0.2",
    "コリドラス,std,aa9988,0.3","プレコ,flt,444444,0.6","エンゼルフィッシュ(淡),flt,dddddd,0.5","ディスカス,flt,ff8855,0.6","オスカー,std,443322,0.8",
    "ピラニア,std,882222,0.7","電気ウナギ,lng,333333,2.5","ウツボ,lng,aa8844,2.0","アナゴ,lng,bb9977,1.0","ウナギ,lng,222222,1.0",
    "タチウオ,lng,eeeeee,1.5","サケガシラ,lng,ffcccc,2.0","テンガイマカティ,flt,aa5555,1.5","キンメダイ,std,ff0000,1.0","ノドグロ,std,ff3333,0.8",
    "クロムツ,std,222222,1.0","メバル,std,443322,0.6","カサゴ,std,cc5544,0.7","アイナメ,lng,aa8844,0.8","ホッケ,lng,aaaaaa,0.9",
    "タラ,std,bbbbbb,1.5","スケトウダラ,lng,aaaaaa,1.2","アンコウ,flt,554433,1.8","オヒョウ,flt,555544,3.0","サワラ,lng,888888,1.5",
    "シイラ,std,55ff55,2.0","メダカ,std,aaaaaa,0.1","コイ,std,cc9955,1.2","フナ,std,888888,0.8","金魚,rnd,ff3300,0.4",
    "ナマズ,lng,333333,1.5","ドジョウ,lng,776655,0.4","ワカサギ,lng,cccccc,0.3","シラウオ,lng,eeeeee,0.2","ハタハタ,std,ccbb99,0.5",
    "メガロドン,lng,666666,9.0","ラブカ,lng,554433,2.0","ミツクリザメ,lng,ffbbbb,2.5","メガマウス,lng,222222,3.5","ネコザメ,lng,887755,1.5",
    "トラザメ,lng,aa9955,1.0","カスザメ,flt,aa9977,1.5","ノコギリザメ,lng,998877,1.8","エイラクブカ,lng,aaaaaa,1.2","ドチザメ,lng,888888,1.2",
    "シロイルカ,lng,ffffff,3.0","イッカク,lng,dddddd,3.0","スナメリ,lng,cccccc,1.8","ジュゴン,lng,999999,2.5","マナティー,lng,888888,2.5",
    "ヨシキリザメ,lng,4466aa,2.5","アオザメ,lng,335599,3.0","ニタリ,lng,555555,3.0","オンデンザメ,lng,444444,4.0","ダルマザメ,lng,555544,0.5",
    "ゴマモンガラ,flt,aa8855,1.0","サザナミヤッコ,flt,223366,0.8","タテジマキンチャクダイ,flt,eeee22,0.8","ルリスズメダイ,std,0055ff,0.2","デバスズメダイ,std,88ccff,0.2",
    "ミスジスズメ,std,ffffff,0.2","トゲチョウチョウウオ,flt,ffff55,0.5","フエヤッコダイ,flt,ffff00,0.4","ハシナガチョウチョウ,flt,ffaa00,0.5","アケボノチョウチョウ,flt,eeeeee,0.5",
    "カエルアンコウ,rnd,ffaa55,0.5","ハナオコゼ,rnd,ccaa55,0.4","マツカサウオ,exo,ddaa22,0.5","イシガキフグ,rnd,cccccc,0.7","マフグ,rnd,aaaaaa,0.8",
    "クサフグ,rnd,99aa88,0.3","アベニーパファー,rnd,ddcc55,0.1","ヨウジウオ,lng,88aa66,0.5","ヘコアユ,lng,aaaa99,0.3","ダイオウイカ,exo,ff5555,5.0"
];
const rawPlantList = [
    "ワカメ,swd,338833,1.0","コンブ,swd,226622,1.2","アマモ,swd,44aa44,0.8","ウミブドウ,anm,33aa66,0.5","アカモク,swd,88aa77,1.0","トサカノリ,swd,aa7788,0.9",
    "ミドリイシ,cbr,33ccaa,2.0","キクメイシ,cbn,ffaa88,2.5","脳サンゴ,cbn,ffff88,2.8","エダサンゴ,cbr,ee8855,2.2","ウミウチワ,swd,ff88cc,1.5","ウミトサカ,cbr,ff5555,2.0",
    "イソギンチャク,anm,ff44ff,1.0","クマノミイソギンチャク,anm,ff8800,1.2","センジュイソギンチャク,anm,aa66ff,1.5","イボイソギンチャク,anm,88bbdd,1.0",
    "ハナサンゴ,anm,ffaa22,0.8","ディスクコーラル,anm,ffff33,0.6","バブルコーラル,anm,ddeeff,1.0","スターポリプ,anm,88ff88,0.7","ツツウミウサギ,cbr,ffeecc,1.2",
    "マメスナギンチャク,anm,ffee55,0.5","ウミエラ,swd,ffffaa,1.0","ウミシダ,cbr,ff3300,1.5","クシサンゴ,cbr,ffdd88,1.2",
    "サボテングサ,cbr,aaccaa,1.0","トゲサンゴ,cbr,ffaaaa,1.2","カワラサンゴ,cbn,ddccaa,1.0","オオウミキノコ,cbn,eeeeee,1.8","イボヤギ,cbr,ffff55,1.0",
    "クサビライシ,cbn,ffcc55,0.8","スリバチサンゴ,cbn,ccddbb,1.2","ナガレハナサンゴ,anm,ddffff,1.0","ヤギ,cbr,aa6622,2.0","ハネモ,swd,88aa66,0.7",
    "ウミウチワ青,swd,4466aa,1.5","アナアオサ,swd,88cc88,0.6","フサモ,swd,bbccbb,0.8","ハナガササンゴ,cbn,ffffaa,2.0","ミズタマサンゴ,anm,ddeeff,1.2",
    "ナガレハナ青,anm,88ccff,1.0","コモンサンゴ,cbr,ffaa88,1.5","エダサンゴ青,cbr,00ffcc,2.2","イソギンチャク青,anm,00ffff,1.0","ウミブドウ青,anm,00cc99,0.5",
    "サンゴモ,swd,aa8899,0.8","リュウグウノツカイモ,swd,ff8888,1.0","ヒトデモ,swd,ffff88,1.2","サンゴモ青,swd,8888ff,0.8","ヒメタチモ,swd,cccccc,0.6"
];

const fishData = []; const plantData = [];
rawFishList.forEach((raw, i) => { const p = raw.split(','); fishData.push({id: i, name: p[0], shapeType: p[1], colorStr: p[2], colorHex: parseInt(p[2], 16), scale: parseFloat(p[3]), found: false, iconUrl: '', type: 'fish'}); });
rawPlantList.forEach((raw, i) => { const p = raw.split(','); plantData.push({id: 150+i, name: p[0], shapeType: p[1], colorStr: p[2], colorHex: parseInt(p[2], 16), scale: parseFloat(p[3]), found: false, iconUrl: '', type: 'plant'}); });
const allData = [...fishData, ...plantData];

const plantGeometries = { swd: new THREE.PlaneGeometry(1.5, 5, 2, 8).rotateX(Math.PI/2), cbr: new THREE.ConeGeometry(0.5, 4, 6), cbn: new THREE.SphereGeometry(2, 16, 16), anm: new THREE.SphereGeometry(1, 16, 16) };
const smoothMat = new THREE.MeshStandardMaterial({ flatShading: false, roughness: 0.5, metalness: 0.2 });
const swdMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });

function createPlant(data) {
    const plantGroup = new THREE.Group();
    const mat = smoothMat.clone(); mat.color.set(data.colorHex); const sMat = swdMat.clone(); sMat.color.set(data.colorHex);
    if(data.shapeType==='swd') { for(let k=0; k<5; k++) { const swd = new THREE.Mesh(plantGeometries.swd, sMat); swd.rotation.y = k * Math.PI/3 + Math.random()*Math.PI/10; swd.position.y = 2.5; plantGroup.add(swd); }
    } else if(data.shapeType==='cbr') { for(let k=0; k<4; k++) { const cbr = new THREE.Mesh(plantGeometries.cbr, mat); cbr.rotation.set(Math.random()*Math.PI/6 - Math.PI/12, k*Math.PI/2 + Math.random()*Math.PI/10, Math.random()*Math.PI/6 - Math.PI/12); cbr.position.y = 2.0; plantGroup.add(cbr); }
    } else if(data.shapeType==='cbn') { const cbn = new THREE.Mesh(plantGeometries.cbn, mat); cbn.position.y = 1.0; plantGroup.add(cbn);
    } else {
        const base = new THREE.Mesh(plantGeometries.anm, mat); base.position.y = 0.5; plantGroup.add(base);
        for(let k=0; k<20; k++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.5, 6), mat); cone.rotation.set(Math.PI/2 - Math.random()*Math.PI/10, 0, k*Math.PI/10 + Math.random()*Math.PI/10); cone.position.set(0.8*Math.cos(k*Math.PI/10), 1.0, 0.8*Math.sin(k*Math.PI/10)); cone.rotation.z = Math.atan2(0.8*Math.sin(k*Math.PI/10), 0.8*Math.cos(k*Math.PI/10)) - Math.PI/2; plantGroup.add(cone); }
    }

    const checkTex = new THREE.CanvasTexture(document.createElement('canvas').getContext('2d').canvas); checkTex.image.width=128; checkTex.image.height=128; const cCtx = checkTex.image.getContext('2d'); cCtx.fillStyle = '#00ff44'; cCtx.font = 'bold 100px Arial'; cCtx.textAlign = 'center'; cCtx.textBaseline = 'middle'; cCtx.fillText('✔', 64, 64); checkTex.needsUpdate=true;
    const checkSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: checkTex, depthTest: false })); checkSprite.scale.set(3, 3, 1); checkSprite.position.y = (data.shapeType==='cbn'?3:data.shapeType==='swd'?5.5:data.shapeType==='cbr'?4.5:2.5); checkSprite.visible = false; plantGroup.add(checkSprite);

    plantGroup.scale.set(data.scale, data.scale, data.scale); plantGroup.userData = {id: data.id, checkSprite: checkSprite, type: 'plant'};
    const x = (Math.random() - 0.5) * 600; const z = (Math.random() - 0.5) * 600; plantGroup.position.set(x, getGroundElevation(x, z), z); plantGroup.rotation.y = Math.random() * Math.PI * 2;
    scene.add(plantGroup); interactableObjects.push(...plantGroup.children.filter(c => c instanceof THREE.Mesh)); plantGroup.children.filter(c => c instanceof THREE.Mesh).forEach(m => m.userData.parentGroup = plantGroup);
}

const interactableObjects = []; const fishList = []; 
fishData.forEach(data => createUltraRealFish(data));
plantData.forEach(data => createPlant(data));

const particleCount = 5000; const particleGeo = new THREE.BufferGeometry(); const particlePos = new Float32Array(particleCount * 3);
for(let i=0; i < particleCount * 3; i++) particlePos[i] = (Math.random() - 0.5) * 600;
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
const particles = new THREE.Points(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.7 })); scene.add(particles);

const groundGeo = new THREE.PlaneGeometry(800, 800, 100, 100); const posAttr = groundGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) posAttr.setZ(i, getGroundElevation(posAttr.getX(i), posAttr.getY(i)));
groundGeo.computeVertexNormals(); const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x1a2a35, roughness: 0.9, flatShading: true })); ground.rotation.x = -Math.PI / 2; scene.add(ground);

allData.forEach(data => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#005588'; ctx.fillRect(0, 0, 64, 64); ctx.fillStyle = `#${data.colorStr}`; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5; ctx.beginPath();
    if(data.type==='plant') {
        if (data.shapeType === 'swd') ctx.fillRect(10, 5, 44, 54); else if (data.shapeType === 'cbr') { ctx.moveTo(32, 55); ctx.lineTo(15, 15); ctx.lineTo(49, 15); ctx.fill(); } else if (data.shapeType === 'cbn') { ctx.arc(32, 32, 22, 0, Math.PI * 2); ctx.fill(); } else { ctx.arc(32, 32, 18, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); ctx.fillRect(10, 28, 10, 8); }
    } else {
        if (data.shapeType === 'std') { ctx.moveTo(55, 32); ctx.lineTo(15, 15); ctx.lineTo(15, 49); ctx.fill(); ctx.fillRect(5, 25, 15, 14); } else if (data.shapeType === 'rnd') { ctx.arc(32, 32, 22, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(5, 28, 10, 8); } else if (data.shapeType === 'flt') ctx.fillRect(10, 15, 44, 34); else if (data.shapeType === 'lng') ctx.fillRect(5, 25, 54, 14); else { ctx.arc(32, 32, 20, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); ctx.fillRect(10, 28, 10, 8); }
    }
    data.iconUrl = canvas.toDataURL();
});

const grid = document.getElementById("zukan-grid");
allData.forEach(data => {
    const div = document.createElement("div"); div.id = `zukan-item-${data.id}`; div.className = 'zukan-item unknown';
    div.innerHTML = `<div class="fish-icon"><img src="${data.iconUrl}" alt="未発見" width="64" height="64"></div><div class="info"><div class="no">No.${data.id + 1}</div><div class="name">？？？？？？</div></div>`;
    grid.appendChild(div);
});

function activateCompleteMode() {
    document.getElementById('complete-message').classList.add("show"); 
    scene.fog.density = 0; ambientLight.intensity = 2.0; headLight.intensity = 1000; scene.background = new THREE.Color(0x88ccff);
}

function recordDiscovery(objectGroup) {
    const id = objectGroup.userData.id; const data = allData[id];
    if (data.found) return; data.found = true; foundCount++;
    objectGroup.userData.checkSprite.visible = true;
    document.getElementById('score-display').innerText = `🐟 発見数: ${foundCount} / 200`; document.getElementById('zukan-progress').innerText = `発見数: ${foundCount} / 200`;
    const div = document.getElementById(`zukan-item-${id}`); div.className = 'zukan-item discovered'; div.querySelector('img').style.opacity = '1'; div.querySelector('img').style.filter = 'none'; div.querySelector('.name').innerText = data.name; 
    const msg = document.getElementById("discovery-message"); msg.innerText = `${data.name} を記録！`; msg.classList.add("show"); setTimeout(() => msg.classList.remove("show"), 2000);
    if (foundCount >= 200) activateCompleteMode();
}

// 【新機能】隠しコマンド実行関数
function executeCheatCode() {
    if (foundCount >= 200) return;
    allData.forEach(data => {
        if (!data.found) {
            data.found = true; const div = document.getElementById(`zukan-item-${data.id}`); div.className = 'zukan-item discovered';
            div.querySelector('img').style.opacity = '1'; div.querySelector('img').style.filter = 'none'; div.querySelector('.name').innerText = data.name;
        }
    });
    scene.children.forEach(child => { if (child.userData && child.userData.checkSprite) child.userData.checkSprite.visible = true; });
    foundCount = 200; document.getElementById('score-display').innerText = `🐟 発見数: 200 / 200`; document.getElementById('zukan-progress').innerText = `発見数: 200 / 200`;
    activateCompleteMode();
}

// --- 6. PC＆スマホ キー・タッチ・隠しコマンド入力 ---
const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
const velocity = new THREE.Vector3(); const direction = new THREE.Vector3();
let cheatBuffer = ""; 

// [PC] キーボード操作と隠しコマンド
document.addEventListener('keydown', (e) => {
    // 隠しコマンド判定
    if (e.key && e.key.length === 1) {
        cheatBuffer += e.key; if (cheatBuffer.length > 10) cheatBuffer = cheatBuffer.slice(-10);
        if (cheatBuffer === "hatosabure") { cheatBuffer = ""; executeCheatCode(); }
    }
    if (e.code === 'KeyW') keys.w = true; if (e.code === 'KeyS') keys.s = true; if (e.code === 'KeyA') keys.a = true; if (e.code === 'KeyD') keys.d = true; if (e.code === 'Space') keys.space = true; if (e.code === 'ShiftLeft') keys.shift = true;
    if (e.code === 'KeyE') { zukanOpen = !zukanOpen; document.getElementById('zukan-overlay').style.display = zukanOpen ? 'block' : 'none'; if(!isMobile) { if(zukanOpen) controls.unlock(); else controls.lock(); } }
});
document.addEventListener('keyup', (e) => { if (e.code === 'KeyW') keys.w = false; if (e.code === 'KeyS') keys.s = false; if (e.code === 'KeyA') keys.a = false; if (e.code === 'KeyD') keys.d = false; if (e.code === 'Space') keys.space = false; if (e.code === 'ShiftLeft') keys.shift = false; });

// [PC] クリック操作
document.addEventListener('mousedown', (e) => {
    if (!controls.isLocked && !isMobile) return;
    if (e.button === 2) { isLightOn = !isLightOn; headLight.intensity = isLightOn ? (foundCount === 200 ? 1000 : 500) : 0; document.getElementById('light-status').innerText = isLightOn ? "💡 LIGHT: ON" : "💡 LIGHT: OFF"; document.getElementById('light-status').style.color = isLightOn ? "#ffcc00" : "#555"; } 
    else if (e.button === 0 && !isMobile) { 
        const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); const intersects = raycaster.intersectObjects(interactableObjects);
        if (intersects.length > 0) { const group = intersects[0].object.userData.parentGroup; recordDiscovery(group); group.rotation.z += Math.PI * 2; }
    }
});
document.addEventListener('contextmenu', e => e.preventDefault());

// [スマホ] タッチ操作
const bindBtn = (id, key) => {
    const btn = document.getElementById(id); if(!btn) return;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; }, {passive: false});
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
};
bindBtn('btn-up', 'w'); bindBtn('btn-down', 's'); bindBtn('btn-left', 'a'); bindBtn('btn-right', 'd'); bindBtn('btn-ascend', 'space'); bindBtn('btn-descend', 'shift');

// [スマホ] アクションボタン
const btnRecord = document.getElementById('btn-record');
if(btnRecord) btnRecord.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); const intersects = raycaster.intersectObjects(interactableObjects);
    if (intersects.length > 0) { const group = intersects[0].object.userData.parentGroup; recordDiscovery(group); group.rotation.z += Math.PI * 2; }
});
const btnLight = document.getElementById('btn-light');
if(btnLight) btnLight.addEventListener('touchstart', (e) => {
    e.preventDefault(); isLightOn = !isLightOn; headLight.intensity = isLightOn ? (foundCount >= 200 ? 1000 : 500) : 0; 
    document.getElementById('light-status').innerText = isLightOn ? "💡 LIGHT: ON" : "💡 LIGHT: OFF"; document.getElementById('light-status').style.color = isLightOn ? "#ffcc00" : "#555";
});
const btnZukan = document.getElementById('btn-zukan');
if(btnZukan) btnZukan.addEventListener('touchstart', (e) => {
    e.preventDefault(); zukanOpen = !zukanOpen; document.getElementById('zukan-overlay').style.display = zukanOpen ? 'block' : 'none';
});
const btnCloseZukan = document.getElementById('close-zukan-btn');
if(btnCloseZukan) btnCloseZukan.addEventListener('click', () => {
    zukanOpen = false; document.getElementById('zukan-overlay').style.display = 'none';
});

// [スマホ] 隠しコマンド（スコア10回タップ）
let scoreTapCount = 0;
document.getElementById('score-display').addEventListener('touchstart', (e) => {
    scoreTapCount++;
    if(scoreTapCount >= 10) { executeCheatCode(); scoreTapCount = 0; }
});

// [スマホ] スワイプで視点操作
let touchStartX = 0; let touchStartY = 0;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && e.target.tagName !== 'BUTTON' && !e.target.classList.contains('pad-btn') && !e.target.classList.contains('action-btn')) {
        touchStartX = e.touches[0].pageX; touchStartY = e.touches[0].pageY;
        euler.setFromQuaternion(camera.quaternion);
    }
}, {passive: false});

document.addEventListener('touchmove', (e) => {
    if (!isMobile || zukanOpen) return;
    if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('pad-btn') && !e.target.classList.contains('action-btn')) {
        e.preventDefault(); 
        if (e.touches.length === 1) {
            const touchX = e.touches[0].pageX; const touchY = e.touches[0].pageY;
            const deltaX = touchX - touchStartX; const deltaY = touchY - touchStartY;
            euler.y -= deltaX * 0.005; euler.x -= deltaY * 0.005;
            euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));
            camera.quaternion.setFromEuler(euler);
            touchStartX = touchX; touchStartY = touchY;
        }
    }
}, {passive: false});

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// --- 7. メインループ（バグ修正・速度2倍） ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta(); const time = clock.getElapsedTime();
    
    if (controls.isLocked || (isMobile && document.getElementById('start-screen').style.display === 'none' && !zukanOpen)) {
        
        // 【修正】慣性（減衰）の計算を維持するため、velocityを初期化せずに引き継ぐ
        velocity.x -= velocity.x * 4.0 * delta; 
        velocity.z -= velocity.z * 4.0 * delta; 
        velocity.y -= velocity.y * 4.0 * delta;
        
        direction.z = Number(keys.w) - Number(keys.s); 
        direction.x = Number(keys.d) - Number(keys.a); 
        direction.y = Number(keys.space) - Number(keys.shift); 
        direction.normalize(); 
        
        // 【移動速度を2倍にアップ！】 (旧100.0 -> 新200.0)
        const speedMulti = 200.0; 
        
        if (keys.w || keys.s) velocity.z -= direction.z * speedMulti * delta; 
        if (keys.a || keys.d) velocity.x -= direction.x * speedMulti * delta; 
        if (keys.space || keys.shift) velocity.y += direction.y * speedMulti * delta;
        
        // カメラの移動を適用
        controls.moveRight(-velocity.x * delta); 
        controls.moveForward(-velocity.z * delta); 
        camera.position.y += velocity.y * delta;
        
        const pos = camera.position; const groundY = getGroundElevation(pos.x, pos.z);
        if (pos.y < groundY + 8) pos.y = groundY + 8;
        if (pos.y > 100) pos.y = 100;
        document.getElementById('coord-display').innerText = `POS: X ${Math.round(pos.x)}, Y ${Math.round(pos.y)}, Z ${Math.round(pos.z)}`;
    }
    
    const positions = particles.geometry.attributes.position.array;
    for(let i=1; i < particleCount * 3; i+=3) { positions[i] += 0.08; if(positions[i] > 120) positions[i] = -20; }
    particles.geometry.attributes.position.needsUpdate = true;
    
    const playerPos = camera.position;
    fishList.forEach((fish) => {
        const ud = fish.userData; 
        const distToPlayer = fish.position.distanceTo(playerPos);
        
        if (distToPlayer < 70) { 
            const escapeDir = new THREE.Vector3().subVectors(fish.position, playerPos).normalize(); 
            ud.velocity.add(escapeDir.multiplyScalar(25 * delta)); 
            ud.speed = 25; 
        } else { 
            ud.velocity.x += (Math.random() - 0.5) * 4 * delta; 
            ud.velocity.y += (Math.random() - 0.5) * 2 * delta; 
            ud.velocity.z += (Math.random() - 0.5) * 4 * delta; 
            ud.speed = THREE.MathUtils.lerp(ud.speed, 6, delta); 
        }

        ud.velocity.normalize().multiplyScalar(ud.speed); 
        fish.position.add(ud.velocity.clone().multiplyScalar(delta));
        
        const targetLook = fish.position.clone().add(ud.velocity);
        fish.lookAt(targetLook);
        
        const turnSpeed = ud.velocity.x * 0.05;
        fish.rotation.z = THREE.MathUtils.lerp(fish.rotation.z, turnSpeed, delta * 2);

        const swimTime = time * ud.speed * 1.5 + ud.swimPhase;
        ud.bodyMesh.rotation.y = Math.sin(swimTime) * 0.15; 
        ud.tailJoint.rotation.y = Math.sin(swimTime - 1.5) * 0.4; 
        ud.pecL.rotation.z = Math.sin(swimTime * 0.5) * 0.2 + Math.PI/4; 
        ud.pecR.rotation.z = Math.sin(swimTime * 0.5) * -0.2 - Math.PI/4; 
        
        const fishGroundY = getGroundElevation(fish.position.x, fish.position.z);
        if (fish.position.y < fishGroundY + 3) { fish.position.y = fishGroundY + 3; ud.velocity.y += 20 * delta; }
        if (fish.position.y > 90) { fish.position.y = 90; ud.velocity.y -= 20 * delta; }
        if (fish.position.length() > 400) ud.velocity.multiplyScalar(-1); 
    });
    renderer.render(scene, camera);
}
animate();