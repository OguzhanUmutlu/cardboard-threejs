// noinspection JSUnusedGlobalSymbols

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

function updateInfo(elem) {
    elem.innerHTML = `${ping}ms`;
}

function updateInfos() {
    updateInfo(infoSpanL1, "left");
    updateInfo(infoSpanR1, "right");
}

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
            model.rotation.order = "YXZ";
            const skeleton = new THREE.SkeletonHelper(model);
            skeleton.visible = false;
            const animations = gltf.animations, mixer = new THREE.AnimationMixer(model);
            const clock = new THREE.Clock();
            model._data = {
                animations: {
                    idle: mixer.clipAction(animations[0]),
                    walk: mixer.clipAction(animations[3]),
                    run: mixer.clipAction(animations[1])/*,
                    jump,
                    fall,
                    land,
                    hurt,
                    die*/
                }
            };
            r({
                skeleton, model, updateMixer: () => {
                    mixer.update(clock.getDelta());
                }
            });
        });
    });
}

function getFormattedTime(t) {
    const d = new Date(t);
    return d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
}

class V3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    mul(v) {
        this.x *= v.x;
        this.y *= v.y;
        this.z *= v.z;
        return this;
    }

    div(v) {
        this.x /= v.x;
        this.y /= v.y;
        this.z /= v.z;
        return this;
    }

    mulScalar(s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }

    divScalar(s) {
        this.x /= s;
        this.y /= s;
        this.z /= s;
        return this;
    }

    distance(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    getYawTo(v) {
        const dx = v.x - this.x;
        const dy = v.y - this.y;
        return Math.atan2(dy, dx) - Math.PI / 2;
    }

    getPitchTo(v) {
        const dx = v.x - this.x;
        const dy = v.y - this.y;
        const dz = v.z - this.z;
        return Math.atan2(dz, Math.sqrt(dx * dx + dy * dy));
    }

    setX(x) {
        this.x = x;
        return this;
    }

    setY(y) {
        this.y = y;
        return this;
    }

    setZ(z) {
        this.z = z;
        return this;
    }

    clone() {
        return new V3(this.x, this.y, this.z);
    }
}

async function init() {
    class Entity extends V3 {
        yaw = 0;
        pitch = 0;
        headYaw = 0;
        eyeHeight = 1.5;
        onGround = true;
        isSneaking = false;
        isSprinting = false;
        isFlying = false;
        isSwimming = false;
        isClimbing = false;
        isJumping = false;
        actionId = 0;
        lastActionId = -1;
        closed = true;

        /**
         * @param {number} x
         * @param {number} y
         * @param {number} z
         * @param {number} uuid
         * @param model
         */
        constructor(x, y, z, uuid, model) {
            super(x, y, z);
            this.uuid = uuid;
            this.model = model;
        }

        init() {
            this.closed = false;
            serverData.entities[this.uuid] = this;
            scene.add(this.model);
        }

        static getDirection(yaw, pitch, n = 1) {
            const v = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0)));
            return new V3(v.x, v.y, v.z).mulScalar(-1 * n);
        }

        getDirection(n = 1) {
            return Entity.getDirection(this.yaw, this.pitch, n);
        }

        getLeftDirection(n = 1) {
            return Entity.getDirection(this.yaw - Math.PI / 2, this.pitch, n);
        }

        getRightDirection(n = 1) {
            return Entity.getDirection(this.yaw + Math.PI / 2, this.pitch, n);
        }

        /**
         * @returns {boolean}
         */
        update() {
            if (this.model) {
                this.model.position.x = this.x;
                this.model.position.y = this.y;
                this.model.position.z = this.z;
                this.model.rotation.y = this.yaw;
                this.model.rotation.x = this.pitch;
                if (this.actionId !== this.lastActionId) {
                    this.lastActionId = this.actionId;
                    this.model._data.animations[["idle", "walk"][this.actionId] || "idle"].play();
                }
            }
            return true;
        }

        lookAt(v) {
            this.yaw = this.getYawTo(v);
            this.pitch = this.getPitchTo(v);
            return this;
        }

        close() {
            this.closed = true;
            if (this.model) scene.remove(this.model);
            delete serverData.entities[this.uuid];
            return this;
        }
    }

    class Living extends Entity {
        health = 10;
        maxHealth = 10;
        gravity = 0.08;

        yawVelocity = 0;
        pitchVelocity = 0;
        headYawVelocity = 0;
        velocity = new V3(0, 0, 0);

        /**
         * @param {number} x
         * @param {number} y
         * @param {number} z
         * @param {number} uuid
         * @param model
         */
        constructor(x, y, z, uuid, model) {
            super(x, y, z, uuid, model);
        }

        move(x, y, z) {
            if (x instanceof V3) return this.move(x.x, x.y, x.z);
            this.velocity.x += x;
            this.velocity.y += y;
            this.velocity.z += z;
            return this;
        }

        update() {
            const delta = 1; // TODO: global clock
            if (!this.isFlying && !this.onGround) this.velocity.y -= this.gravity;
            this.yaw += this.yawVelocity * delta * 0.1;
            this.pitch += this.pitchVelocity * delta * 0.1;
            this.headYaw += this.headYawVelocity * delta * 0.1;

            this.yawVelocity *= (1 - delta * 0.1);
            this.pitchVelocity *= (1 - delta * 0.1);
            this.headYawVelocity *= (1 - delta * 0.1);

            this.add(this.velocity.clone().mulScalar(delta * 0.1));
            this.velocity.mulScalar(1 - delta * 0.1);
            return super.update();
        }
    }

    class Player extends Living {
        lastPos = new V3(0, 0, 0);
        lastYawNPitch = [0, 0];
        socket = null;
        online = false;
        moveKey = null;
        isFirstMove = true;
        perspectiveMode = 0;
        jumpVelocity = 3;

        /**
         * @param {number} x
         * @param {number} y
         * @param {number} z
         * @param {number} uuid
         * @param {Socket} socket
         */
        constructor(x, y, z, uuid, socket) {
            super(x, y, z, uuid, null);
            this.socket = socket;
        }

        async init() {
            this.closed = false;
            this.online = true;
            socket.on("ping", ev => {
                updatePing(ev.time);
                this.socket.emit("pong");
            });
            socket.on("kicked", ev => {
                alert("You got kicked!\nReason: " + ev.reason);
                window.location.reload();
            });
            socket.on("open", async ev => {
                if (++_open >= 2) window.location.reload();
                updatePing(ev.time);
                serverData.uuid = ev.uuid;
                socket.emit("ready2");
                player.uuid = ev.uuid;
                // TODO: store player positions in server etc.
                await chatPromise;
                const {chat} = ev;
                messageDiv.forEach(i => {
                    i.innerHTML = chat.map(i => {
                        const {time, message} = i;
                        return `[${getFormattedTime(time)}] ${message}`;
                    }).join("<br>");
                });
            });
            socket.on("addEntities", ev => {
                updatePing(ev.time);
                ev.entities.forEach(async ev => {
                    const {entity} = ev;
                    if (player.uuid === entity.uuid || serverData.entities[entity.uuid]) return;
                    const {model} = await loadGLTFModel("./Soldier.glb");
                    const ent = new Entity(entity.position.x, entity.position.y, entity.position.z, entity.uuid, model);
                    ent.yaw = entity.yaw;
                    ent.pitch = entity.pitch;
                    ent.headYaw = entity.headYaw;
                    ent.init();
                });
            });
            socket.on("removeEntity", ev => {
                updatePing(ev.time);
                const {uuid} = ev.entity;
                if (!serverData.entities[uuid]) return;
                serverData.entities[uuid].close();
            });
            socket.on("updateEntity", ev => {
                updatePing(ev.time);
                const {entity} = ev;
                if (ev.uuid === entity.uuid) {
                    if (ev.nextKey) player.moveKey = ev.nextKey
                    return;
                }
                if (!serverData.entities[entity.uuid]) return;
                const ent = serverData.entities[entity.uuid];
                ent.x = entity.position.x;
                ent.y = entity.position.y;
                ent.z = entity.position.z;
                ent.yaw = entity.yaw;
                ent.pitch = entity.pitch;
                ent.headYaw = entity.headYaw;
                ent.actionId = entity.actionId;
            });
            socket.emit("ready");
            this._model = (await loadGLTFModel("./Soldier.glb")).model;
        }

        updateCamera() {
            let pos;
            switch (this.perspectiveMode) {
                case 0:
                    pos = this.clone().add(new V3(0, this.eyeHeight, 0));
                    camera.position.set(pos.x, pos.y, pos.z);
                    camera.rotation.x = this.pitch;
                    camera.rotation.y = this.yaw + this.headYaw;
                    break;
                case 1:
                    pos = this.clone().add(new V3(0, this.eyeHeight * 1.5, 0)).sub(Entity.getDirection(this.yaw, 0).mulScalar(2).setY(0));
                    camera.position.set(pos.x, pos.y, pos.z);
                    camera.lookAt(new THREE.Vector3(this.x, this.y + this.eyeHeight, this.z));
                    break;
                case 2:
                    pos = this.clone().add(new V3(0, this.eyeHeight * 1.5, 0)).sub(Entity.getDirection(this.yaw, 0).mulScalar(-2).setY(0));
                    camera.position.set(pos.x, pos.y, pos.z);
                    camera.lookAt(new THREE.Vector3(this.x, this.y + this.eyeHeight, this.z));
                    break;
            }
        }

        async update() {
            const prs = this.perspectiveMode;
            this.perspectiveMode = middleMouseDown ? 1 : (rightMouseDown ? 2 : 0);
            if (prs !== this.perspectiveMode) {
                if (this.model) scene.remove(this.model);
                this.model = null;
                switch (this.perspectiveMode) {
                    case 1:
                    case 2:
                        scene.add(this.model = this._model);
                        break;
                }
            }
            this.broadcastMovement();
            this.updateCamera();
            camera.updateMatrix();
            if (this.y <= 0) {
                this.y = 0;
                this.velocity.y = 0;
                this.isJumping = false;
                this.onGround = true;
            }
            this.onGround = !this.isJumping;
            if (heldKeys[" "] && this.onGround) {
                this.isJumping = true;
                this.velocity.y += this.jumpVelocity;
            }
            return super.update();
        }

        hasMoved() {
            return this.lastPos.distance(this) > 0 || this.lastYawNPitch[0] !== this.yaw || this.lastYawNPitch[1] !== this.headYaw || this.lastYawNPitch[2] !== this.pitch;
        }

        broadcastMovement() {
            if (!this.hasMoved() || (!this.moveKey && !this.isFirstMove)) return false;
            this.isFirstMove = false;
            this.lastPos = this.clone();
            this.lastYawNPitch = [this.yaw, this.headYaw, this.pitch];
            this.socket.emit("move", {
                position: {x: this.x, y: this.y, z: this.z},
                yaw: this.yaw,
                pitch: this.pitch,
                headYaw: this.headYaw,
                actionId: this.actionId,
                key: this.moveKey
            });
            this.moveKey = null;
            return true;
        }
    }

    let heldKeys = {};
    addEventListener("keydown", ev => heldKeys[ev.key] = true);
    addEventListener("keyup", ev => delete heldKeys[ev.key]);
    addEventListener("blur", () => heldKeys = {});
    let _open = 0;
    if (!await req(window.DeviceOrientationEvent) || !await req(window.DeviceMotionEvent)) {
        alert("Permission was denied!");
        setTimeout(() => window.location.reload(), 1000);
        return;
    }
    const isVROn = () => isMobile() && window.innerWidth > window.innerHeight;
    const width = () => isMobile() ? (window.innerWidth / 2) : window.innerWidth;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(100, width() / window.innerHeight, 0.1, 1000);

    function onResize() {
        camera.aspect = width() / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(width(), window.innerHeight);
        renderer2.setSize(width(), window.innerHeight);
    }

    const renderer = new THREE.WebGLRenderer();
    leftDiv.appendChild(renderer.domElement);
    const renderer2 = new THREE.WebGLRenderer();
    rightDiv.appendChild(renderer2.domElement);
    const img = document.getElementById("img");
    onResize();
    scene.background = new THREE.Color(0xa0a0a0);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({color: new THREE.Color(0x00ff00)}));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -2;
    mesh.receiveShadow = true;
    scene.add(mesh);
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);
    const serverData = {uuid: null, /*** @type {Object<number, Entity>} */entities: {}};
    let cP;
    let chatPromise = new Promise(r => cP = r);
    const player = new Player(0, 0, 0, -1, socket);
    player.init();
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 256, 0);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(0, 256, 0);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 2;
    dirLight.shadow.camera.bottom = -2;
    dirLight.shadow.camera.left = -2;
    dirLight.shadow.camera.right = 2;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 40;
    scene.add(dirLight);
    let isPaused = false;
    pauseDiv.style.display = "block";
    document.getElementById("pauseText").innerHTML = "Click to start";
    let fsSend = false;

    async function sendPermissions() {
        await renderer.domElement.requestPointerLock();
        if (!fsSend) await openFullscreen();
        fsSend = true;
        const motion = await req(window.DeviceMotionEvent);
        const orientation = await req(window.DeviceOrientationEvent);
        if (!motion || !orientation) return window.location.reload();
    }

    async function pause() {
        isPaused = false;
        pauseDiv.style.display = "block";
        document.getElementById("pauseText").innerHTML = "Click to resume";
    }

    pauseDiv.addEventListener("click", async () => {
        if (isPaused) return;
        pauseDiv.style.display = "none";
        renderer.domElement.requestPointerLock = renderer.domElement.requestPointerLock || renderer.domElement["mozRequestPointerLock"] || renderer.domElement["webkitRequestPointerLock"];
        await renderer.domElement.requestPointerLock();
        addEventListener("blur", pause);
        await sendPermissions();
        isPaused = true;
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
            if (ev.key === "Enter") if (!ev.path.some(el => el === chatInput)) {
                pause();
                chatInput.focus();
            }
        });
        messageDiv.push(mDiv());
        chatDiv.appendChild(chatInput);
        chatDiv.appendChild(messageDiv[0]);
        infoSpanL2.appendChild(chatDiv);
    }
    cP();
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
        if (isPaused) {
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
                Object.values(serverData.entities).forEach(e => e.update());
                renderer.render(scene, camera);
                renderer2.render(scene, camera);
            } else {
                if (isMobile()) {
                    leftDiv.style.left = "60px";
                    vrDiv.style.display = "none";
                    pauseDiv.style.display = "block";
                    document.getElementById("pauseText").innerHTML = isMobile() ? "Wear your VR" : "Use your mobile device";
                } else {
                    player.actionId = 0;
                    if (isMobile()) {
                        if (mouseDown) {
                            player.actionId = 1;
                            player.move(player.getDirection(.1).setY(0));
                        }
                    } else {
                        if (heldKeys["w"]) {
                            player.actionId = 1;
                            player.move(player.getDirection(.1).setY(0));
                        }
                        if (heldKeys["s"]) {
                            player.actionId = 1;
                            player.move(player.getDirection(-.1).setY(0));
                        }
                        if (heldKeys["a"]) {
                            player.actionId = 1;
                            player.move(player.getRightDirection(.1).setY(0));
                        }
                        if (heldKeys["d"]) {
                            player.actionId = 1;
                            player.move(player.getLeftDirection(.1).setY(0));
                        }
                    }
                    leftDiv.style.left = "0";
                    vrDiv.style.display = "block";
                    rightDiv.style.display = "none";
                    img.style.display = "none";
                    player.update();
                    Object.values(serverData.entities).forEach(e => e.update());
                    renderer.render(scene, camera);
                }
            }
        }
        // TODO: model
        // TODO: nametag text on top
        // TODO: https://threejs.org/docs/examples/en/controls/PointerLockControls.html
        // TODO: animations
        // TODO: light for model
        requestAnimationFrame(animate);
    }

    let mouse = null;
    let mouseDown = false;
    let middleMouseDown = false;
    let rightMouseDown = false;
    vrDiv.addEventListener("mousedown", ev => {
        mouseDown = true;
        if (ev.button === 1) middleMouseDown = true;
        if (ev.button === 2) rightMouseDown = true;
    });
    vrDiv.addEventListener("mouseup", ev => {
        mouseDown = false;
        if (ev.button === 1) middleMouseDown = false;
        if (ev.button === 2) rightMouseDown = false;
    });
    vrDiv.addEventListener("click", () => isVROn() ? player.move(player.getDirection().setY(0)) : null);
    vrDiv.addEventListener("touchstart", ev => mouse = [ev.touches[0].clientX, ev.touches[0].clientY]);
    vrDiv.addEventListener("touchmove", ev => onMouseMove(ev.touches[0]));
    vrDiv.addEventListener("mousedown", ev => mouse = [ev.clientX, ev.clientY]);
    vrDiv.addEventListener("mousemove", onMouseMove);
    vrDiv.addEventListener("devicemotion", ev => {
        const {alpha, beta, gamma} = ev.rotationRate;
        if (beta === null) return;
        alert("0:" + alpha + ":" + beta + ":" + gamma);
    });
    addEventListener("keydown", ev => ev.key === "Escape" && !isVROn() && isPaused ? pause() : null);
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
            const yDist = is ? -ev.movementY : ev.clientY - mouse[1];
            if (yDist !== 0) {
                player.pitch += yDist !== 0 ? yDist / 100 : 0;
                if (player.pitch > Math.PI / 2) player.pitch = Math.PI / 2;
                if (player.pitch < -Math.PI / 2) player.pitch = -Math.PI / 2;
            }
            if (xDist !== 0) player.yaw += xDist !== 0 ? xDist / 100 : 0;
        }
        mouse = [ev.clientX, ev.clientY];
    }

    window.addEventListener("resize", () => onResize());
    await animate();
}

init().then(r => r);