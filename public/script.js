const socket = io();
let ping = -1;
const vrDiv = document.getElementById("vr");
const leftDiv = document.getElementById("left");
const rightDiv = document.getElementById("right");
const pauseDiv = document.getElementById("pause");
const infoDivL = document.createElement("span");
infoDivL.style.position = "absolute";
infoDivL.style.zIndex = "30";
const infoDivR = document.createElement("span");
infoDivR.style.position = "absolute";
infoDivR.style.zIndex = "30";

leftDiv.appendChild(infoDivL);
rightDiv.appendChild(infoDivR);

const infoSpanL1 = document.createElement("span");
infoDivL.appendChild(infoSpanL1);
const infoSpanL2 = document.createElement("span");
infoDivL.appendChild(infoSpanL2);
const infoSpanR1 = document.createElement("span");
infoDivR.appendChild(infoSpanR1);
const infoSpanR2 = document.createElement("span");
infoDivR.appendChild(infoSpanR2);

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

async function req(a, b = r => r) {
    return await new Promise(async r => {
        try {
            r((await a.requestPermission()) === "granted");
        } catch (e) {
            b();
            r(true);
        }
    });
}

function clone(obj) {
    const clone = {};
    clone.prototype = obj.prototype;
    for (const property in obj) clone[property] = obj[property];
    return clone;
}

function time() {
    return Date.now() + (new Date()).getTimezoneOffset() * 1000 * 60;
}

function updatePing(t) {
    ping = (time() - t) / 2;
}

async function openFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) return await elem.requestFullscreen();
    if (elem["webkitRequestFullscreen"]) return await elem["webkitRequestFullscreen"]();
    if (elem["msRequestFullscreen"]) return await elem["msRequestFullscreen"]();
}

async function loadGLTFModel(glbFile) {
    return await new Promise(r => {
        const loader = new THREE.GLTFLoader();
        loader.load(glbFile, function (gltf) {
            const model = gltf.scene;
            model.traverse(object => object.isMesh ? (object.castShadow = true) : null);
            const skeleton = new THREE.SkeletonHelper(model);
            skeleton.visible = false;
            const animations = gltf.animations, mixer = new THREE.AnimationMixer(model);
            r({
                idle: mixer.clipAction(animations[0]),
                walk: mixer.clipAction(animations[3]),
                run: mixer.clipAction(animations[1]),
                skeleton, model
            });
        });
    });
}

function getFormattedTime(t) {
    const d = new Date(t);
    return d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
}

async function init() {
    function updateInfo(elem, side) {
        elem.innerHTML = `${ping}ms`;
    }

    function updateInfos() {
        updateInfo(infoSpanL1, "left");
        updateInfo(infoSpanR1, "right");
    }

    let _open = 0;
    if (!await req(window.DeviceOrientationEvent) || !await req(window.DeviceMotionEvent)) {
        alert("Permission was denied!");
        setTimeout(() => window.location.reload(), 1000);
        return;
    }
    const isVROn = () => isMobile() && window.innerWidth > window.innerHeight;
    const width = () => isMobile() ? (window.innerWidth / 2) : window.innerWidth;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(120, width() / window.innerHeight, 0.1, 1000);
    const player = {
        position: {x: 0, y: 0, z: 0},
        rotation: {x: 0, y: 0, z: 0},
        posVel: {x: 0, y: 0, z: 0},
        rotVel: {x: 0, y: 0, z: 0},
        posVelSpeed: 0.1,
        rotVelSpeed: 0.1,
        cameraHeight: 0.5,

        init() {
            this.position.x = camera.position.x;
            this.position.y = camera.position.y - this.cameraHeight;
            this.position.z = camera.position.z;
            this.rotation.x = camera.rotation.x;
            this.rotation.y = camera.rotation.y;
            this.rotation.z = camera.rotation.z;
        },

        getCameraPosition() {
            return {...this.position, y: this.position.y + this.cameraHeight};
        },

        translateZ(n) {
            const {x, y, z} = camera.position;
            camera.translateZ(n);
            const diff = camera.position.clone().sub(new THREE.Vector3(x, y, z));
            this.position.x += diff.x;
            this.position.z += diff.z;
            const cameraPos = this.getCameraPosition();
            camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
        },

        update() {
            this.position.x += this.posVel.x * this.posVelSpeed;
            this.position.y += this.posVel.y * this.posVelSpeed;
            this.position.z += this.posVel.z * this.posVelSpeed;
            this.rotation.x += this.rotVelSpeed * this.rotVel.x;
            this.rotation.y += this.rotVelSpeed * this.rotVel.y;
            this.rotation.z += this.rotVelSpeed * this.rotVel.z;

            this.posVel.x *= (1 - this.posVelSpeed);
            this.posVel.y *= (1 - this.posVelSpeed);
            this.posVel.z *= (1 - this.posVelSpeed);

            this.rotVel.x *= (1 - this.rotVelSpeed);
            this.rotVel.y *= (1 - this.rotVelSpeed);
            this.rotVel.z *= (1 - this.rotVelSpeed);

            if (this.rotation.x < -Math.PI / 2) this.rotation.x = -Math.PI / 2;
            if (this.rotation.x > Math.PI / 2) this.rotation.x = Math.PI / 2;
        }
    };

    const renderer = new THREE.WebGLRenderer();

    function onResize() {
        camera.aspect = width() / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(width(), window.innerHeight);
        renderer2.setSize(width(), window.innerHeight);
    }

    leftDiv.appendChild(renderer.domElement);
    const renderer2 = new THREE.WebGLRenderer();
    rightDiv.appendChild(renderer2.domElement);
    const img = document.getElementById("img");
    onResize();

    function makeCube() {
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshNormalMaterial();
        return new THREE.Mesh(geometry, material);
    }

    /*const loader = new THREE.TextureLoader();
    await new Promise(r => {
        loader.load("./cube.png", texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            const boxSize = 5;
            texture.repeat.set(boxSize, boxSize);
            const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
            const material = new THREE.MeshBasicMaterial({map: texture, color: 0x01BE00, side: THREE.BackSide});
            const skybox = new THREE.Mesh(geometry, material);
            scene.add(skybox);
            r();
        });
    });*/

    const soldierData = await loadGLTFModel("./Soldier.glb");

    scene.background = new THREE.Color(0xa0a0a0);

    /*const geometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
    const material = new THREE.MeshBasicMaterial({color: 0x0000ff});
    const floor = new THREE.Mesh(geometry, material);
    floor.material.side = THREE.DoubleSide;
    floor.rotation.x = 90;
    scene.add(floor);*/

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x00ff00)
    }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -2;
    mesh.receiveShadow = true;
    scene.add(mesh);
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

    let serverData = {
        uuid: null,
        entities: []
    };

    document.serverData = serverData;
    document.camera = camera;

    const cubes = {};

    let moveKey = null;

    const updateMovement = () => {
        socket.emit("move", {
            position: player.position,
            rotation: {
                x: player.rotation.x,
                y: player.rotation.y,
                z: player.rotation.z
            },
            key: moveKey
        });
    };

    let cP;
    let chatPromise = new Promise(r => cP = r);

    socket.on("open", async ev => {
        if (++_open >= 2) window.location.reload();
        updatePing(ev.time);
        serverData.uuid = ev.uuid;
        socket.emit("ready2");
        updateMovement();
        await chatPromise;
        const {chat} = ev;
        messageDiv.forEach(i => {
            i.innerHTML = chat.map(i => {
                const {time, message} = i;
                return `[${getFormattedTime(time)}] ${message}`;
            });
        });
    });

    socket.on("addEntities", ev => {
        updatePing(ev.time);
        const {uuid} = ev;
        ev.entities.forEach(async ev => {
            const {entity} = ev;
            if (uuid === entity.uuid) return;
            const cb = (await loadGLTFModel("./Soldier.glb")).model;
            scene.add(cb);
            const eUuid = entity.uuid;
            cubes[eUuid] = {
                uuid: eUuid,
                parsed: entity,
                cube: cb,
                update: () => {
                    const entity = cubes[eUuid].parsed;
                    cb.position.x = entity.position.x;
                    cb.position.y = entity.position.y;
                    cb.position.z = entity.position.z;
                    cb.rotation.x = entity.rotation.x;
                    cb.rotation.y = entity.rotation.y;
                    cb.rotation.z = entity.rotation.z;
                },
                kill: () => {
                    scene.remove(cubes[eUuid].cube);
                    delete cubes[eUuid];
                }
            };
            cubes[eUuid].update();
        });
    });

    socket.on("removeEntity", ev => {
        updatePing(ev.time);
        cubes[ev.entity.uuid]?.kill();
    });

    socket.on("updateEntity", ev => {
        updatePing(ev.time);
        if (ev.uuid === ev.entity.uuid) {
            moveKey = ev.nextKey;
            return updateMovement();
        }
        if (!cubes[ev.entity.uuid]) return;
        cubes[ev.entity.uuid].parsed = ev.entity;
        cubes[ev.entity.uuid].update();
    });

    socket.emit("ready");

    let perspectiveMode = 0;

    camera.position.z = 5;
    camera.position.y = .5;

    player.init();

    let hasConfirmed = false;

    pauseDiv.style.display = "block";
    document.getElementById("pauseText").innerHTML = "Click to start";

    let fsSend = false;

    async function sendPermissions() {
        await renderer.domElement.requestPointerLock();
        if (!fsSend) await openFullscreen();
        fsSend = true;
        const motion = await req(DeviceMotionEvent, () => console.info("DeviceMotionEvent.requestPermission not supported"));
        const orientation = await req(DeviceOrientationEvent, () => console.info("DeviceOrientationEvent.requestPermission not supported"));
        if (!motion || !orientation) return window.location.reload();
    }

    async function pause() {
        hasConfirmed = false;
        pauseDiv.style.display = "block";
        document.getElementById("pauseText").innerHTML = "Click to resume";
    }

    pauseDiv.addEventListener("click", async () => {
        if (hasConfirmed) return;
        pauseDiv.style.display = "none";
        renderer.domElement.requestPointerLock = renderer.domElement.requestPointerLock || renderer.domElement["mozRequestPointerLock"] || renderer.domElement["webkitRequestPointerLock"];
        await renderer.domElement.requestPointerLock();
        addEventListener("blur", pause);
        await sendPermissions();
        hasConfirmed = true;
    });

    const messageDiv = [];

    const mDiv = () => {
        const messagesDiv = document.createElement("div");
        messagesDiv.style.position = "absolute";
        messagesDiv.style.width = "99.7%";
        messagesDiv.style.overflowY = "auto";
        messagesDiv.style.height = "87%";
        messagesDiv.style.border = "1px solid black";
        messagesDiv.style.background = "white";
        messagesDiv.style.color = "black";
        messagesDiv.style.fontFamily = "monospace";
        return messagesDiv;
    }

    let isMob = isMobile();

    if (isMobile()) {
        const chatDiv1 = document.createElement("div");
        chatDiv1.style.position = "absolute";
        chatDiv1.style.width = (window.innerWidth * .1) + "px";
        chatDiv1.style.height = (window.innerHeight * .1) + "px";
        chatDiv1.style.border = "1px solid black";
        infoSpanL2.appendChild(chatDiv1);
        messageDiv.push(mDiv());
        chatDiv1.appendChild(messageDiv[0]);

        const chatDiv2 = document.createElement("div");
        chatDiv2.style.position = "absolute";
        chatDiv2.style.width = (window.innerWidth * .1) + "px";
        chatDiv2.style.height = (window.innerHeight * .1) + "px";
        chatDiv2.style.border = "1px solid black";
        infoSpanR2.appendChild(chatDiv2);
        messageDiv.push(mDiv());
        chatDiv2.appendChild(messageDiv[1]);
    } else {
        const chatDiv = document.createElement("div");
        chatDiv.style.position = "absolute";
        chatDiv.style.width = (window.innerWidth * .3) + "px";
        chatDiv.style.height = (window.innerHeight * .3) + "px";
        chatDiv.style.border = "1px solid black";
        const chatInput = document.createElement("input");
        chatInput.style.bottom = "0";
        chatInput.style.position = "absolute";
        chatInput.style.width = "98.5%";
        chatInput.style.height = "10%";
        chatInput.style.border = "1px solid black";
        chatInput.style.background = "white";
        chatInput.style.color = "black";
        chatInput.style.fontFamily = "monospace";
        chatInput.style.outline = "none";
        chatInput.addEventListener("click", pause);
        chatInput.addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
                socket.emit("chat", {message: chatInput.value});
                chatInput.value = "";
            }
        });
        addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
                if (!ev.path.some(el => el === chatInput)) {
                    pause();
                    chatInput.focus();
                }
            }
        });
        messageDiv.push(mDiv());
        chatDiv.appendChild(chatInput);
        chatDiv.appendChild(messageDiv[0]);
        infoSpanL2.appendChild(chatDiv);
    }

    socket.on("chat", ev => {
        const message = `[${getFormattedTime(ev.time)}] ${ev.message}`;
        messageDiv.forEach(m => {
            m.innerHTML += m.innerHTML ? `<br>${message}` : message;
            m.scrollTop = m.scrollHeight;
        });
    });

    async function animate() {
        if (isMobile() !== isMob) return window.location.reload();
        updateInfos();
        camera.rotation.x = player.rotation.x;
        camera.rotation.y = player.rotation.y;
        camera.rotation.z = player.rotation.z;
        if (isMobile()) {
            infoDivL.style.left = "11%";
            infoDivL.style.top = "65%";
            infoDivR.style.left = "11%";
            infoDivR.style.top = "65%";
            infoDivL.style.fontSize = "12px";
            infoDivR.style.fontSize = "12px";
        } else {
            infoDivL.style.left = "1%";
            infoDivL.style.top = "65%";
        }
        if (hasConfirmed) {
            if (isVROn()) {
                leftDiv.style.left = "60px";
                infoDivL.style.left = (window.innerWidth * .01 + 60) + "px";
                infoDivR.style.left = (window.innerWidth * .01 + 60) + "px";
                img.style.display = "block";
                img.width = window.innerWidth;
                img.height = window.innerHeight;
                rightDiv.style.display = "block";
                vrDiv.style.display = "block";
                pauseDiv.style.display = "none";
                player.update();
                renderer.render(scene, camera);
                renderer2.render(scene, camera);
            } else {
                if (isMobile()) {
                    leftDiv.style.left = "60px";
                    vrDiv.style.display = "none";
                    pauseDiv.style.display = "block";
                    document.getElementById("pauseText").innerHTML = isMobile() ? "Wear your VR" : "Use your mobile device";
                } else {
                    if (mouseDown) player.translateZ(-0.1);
                    leftDiv.style.left = "0";
                    vrDiv.style.display = "block";
                    rightDiv.style.display = "none";
                    img.style.display = "none";
                    player.update();
                    renderer.render(scene, camera);
                }
            }
        }
        // TODO: model
        // TODO: username text on top
        // TODO: https://threejs.org/docs/examples/en/controls/PointerLockControls.html
        requestAnimationFrame(animate);
    }

    let mouse = null;
    let mouseDown = false;

    vrDiv.addEventListener("mousedown", () => {
        if (isVROn()) return;
        mouseDown = true;
    });

    vrDiv.addEventListener("mouseup", () => {
        if (isVROn()) return;
        mouseDown = false;
    });

    vrDiv.addEventListener("click", () => {
        if (isVROn()) player.translateZ(-0.5);
    });

    vrDiv.addEventListener("touchstart", ev => mouse = [ev.touches[0].clientX, ev.touches[0].clientY]);

    vrDiv.addEventListener("touchmove", ev => onMouseMove(ev.touches[0]));

    vrDiv.addEventListener("mousedown", ev => mouse = [ev.clientX, ev.clientY]);

    vrDiv.addEventListener("mousemove", onMouseMove);

    vrDiv.addEventListener("devicemotion", ev => {
        const {alpha, beta, gamma} = ev.rotationRate;
        if (beta === null) return;
        alert("0:" + alpha + ":" + beta + ":" + gamma);
    });

    addEventListener("keydown", ev => {
        if (ev.key === "Escape" && !isVROn() && hasConfirmed) pause();
    });

    window.addEventListener("deviceorientation", ev => {
        const {alpha, beta, gamma} = ev;
        if (beta === null) return;
        alert("1:" + alpha + ":" + beta + ":" + gamma);
    });

    function onMouseMove(ev) {
        if (mouse) {
            camera.rotation.order = isVROn() ? "XYZ" : "YXZ";
            const is = ev.movementX !== undefined;
            const xDist = is ? -ev.movementX : ev.clientX - mouse[0];
            const yDist = is ? -ev.movementY : ev.clientY - mouse[1];// multiply the rotations with -1 if rotations are inverted/negative

            if (yDist !== 0) {
                player.rotation.x += yDist !== 0 ? yDist / 100 : 0;
            }
            if (xDist !== 0) player.rotation.y += xDist !== 0 ? xDist / 100 : 0;
        }
        mouse = [ev.clientX, ev.clientY];
    }

    window.addEventListener("resize", () => onResize());

    await animate();
}

init().then(r => r);