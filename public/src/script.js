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

const gltfModels = [];

class GLTFModel {
    static SOLDIER_STATES = {"Idle": "Idle", "Run": "Run", "TPose": "TPose", "Walk": "Walk"};
    static ROBOT_STATES = {
        "Idle": "Idle",
        "Walking": "Walking",
        "Running": "Running",
        "Dance": "Dance",
        "Death": "Death",
        "Sitting": "Sitting",
        "Standing": "Standing"
    };
    static ROBOT_EMOTES = {
        "Jump": "Jump",
        "Yes": "Yes",
        "No": "No",
        "Wave": "Wave",
        "Punch": "Punch",
        "ThumbsUp": "ThumbsUp"
    };

    static LOOP_TYPES = {
        ONCE: THREE.LoopOnce,
        REPEAT: THREE.LoopRepeat,
        PING_PONG: THREE.LoopPingPong
    };

    constructor(file) {
        this.file = file;
    }

    async init() {
        const loader = new THREE.GLTFLoader();
        // noinspection JSUnresolvedFunction
        this.gltf = await new Promise(r => loader.load(this.file, r));
        this.model = this.gltf.scene;
        this.model.rotation.order = "YXZ";
        this.skeleton = new THREE.SkeletonHelper(this.model);
        this.skeleton.visible = false;
        const animations = this.gltf.animations;
        this.mixer = new THREE.AnimationMixer(this.model);
        gltfModels.push(this);
        this.clock = new THREE.Clock();
        this.currentAction = null;
        this.animations = {};
        this.model._data = this;
        for (let i = 0; i < animations.length; i++) {
            const clip = animations[i];
            // noinspection JSUnresolvedFunction
            const action = this.mixer.clipAction(clip);
            this.model._data.animations[clip.name] = action;
            switch (this.file) {
                case "./Soldier.glb":
                    break;
                case "./Robot.glb":
                    if (GLTFModel.ROBOT_EMOTES[clip.name] || ["Punch", "ThumbsUp"].includes(clip.name) >= 4) {
                        action.clampWhenFinished = true;
                        action.loop = GLTFModel.LOOP_TYPES.ONCE;
                    }
                    break;
            }
        }
        return this;
    }

    updateMixer() {
        this.mixer.update(this.clock.getDelta());
    }

    setWeight(action, weight) {
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);
    }

    fadeToAction(action, duration) {
        this.currentAction = action;
        if (this.currentAction !== action && this.currentAction) this.currentAction.fadeOut(duration);
        if (this.currentAction === action) return;
        this.currentAction = action;
        action.reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(duration)
            .play();
        console.log(action);
    }

    executeCrossFade(startAction, endAction, duration) {
        this.setWeight(endAction, 1);
        endAction.time = 0;
        startAction.crossFadeTo(endAction, duration, true);
    }

    playAction(action) {
        this.currentAction = action;
        action.enabled = true;
        action.play();
    }
}

async function loadGLTFModel(glbFile) {
    return new GLTFModel(glbFile).init();
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
        modelCache = {};

        /**
         * @param {number} x
         * @param {number} y
         * @param {number} z
         * @param {number} uuid
         * @param {string} modelId
         */
        constructor(x, y, z, uuid, modelId) {
            super(x, y, z);
            this.uuid = uuid;
            this.modelId = modelId;
        }

        async init() {
            await this.setModel(this.modelId, true, true);
            this.closed = false;
            serverData.entities[this.uuid] = this;
            scene.add(this.model);
        }

        async setModel(id, update = true, force = false) {
            if (this.modelId !== id || force) {
                this.modelId = id;
                const m = this.modelCache[id] = (this.modelCache[id] || (await loadGLTFModel(this.modelId)).model);
                if (update) {
                    if (this.model) scene.remove(this.model);
                    scene.add(this.model = m);
                }
                switch (id) {
                    case "./Soldier.glb":
                        break;
                    case "./Robot.glb":
                        this.model._data.gltf.scene.scale.set(.35, .35, .35)
                        break;
                }
            }
        }

        static getDirection(yaw, pitch, n = 1) {
            const v = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0)));
            return new V3(v.x, v.y, v.z).mulScalar(-1 * n);
        }

        static getLeftDirection(yaw, pitch, n = 1) {
            return Entity.getDirection(yaw - Math.PI / 2, pitch, n);
        }

        static getRightDirection(yaw, pitch, n = 1) {
            return Entity.getDirection(yaw + Math.PI / 2, pitch, n);
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
            if (!(this instanceof Player)) {
                if (!this._text) {
                    this._text = createText("Guest " + this.uuid);
                    scene.add(this._text);
                }
                this._text.rotation.order = "YXZ";
                const yaw = player.yaw + player.headYaw;
                const y = this.getYawTo(player.clone());
                this._text.position.x = this.x - 1.1;
                this._text.position.y = this.y + this.eyeHeight + 0.2;
                this._text.position.z = this.z;
                this._text.rotation.y = yaw;
            }
            this.updateModel();
            return true;
        }

        updateModel() {
            if (this.model) {
                this.model.position.x = this.x;
                this.model.position.y = this.y;
                this.model.position.z = this.z;
                this.model.rotation.y = this.yaw;
                //this.model.rotation.x = this.pitch;
                if (this.actionId !== this.lastActionId) {
                    this.lastActionId = this.actionId;
                    const ACTION_MAP = [
                        [GLTFModel.SOLDIER_STATES.Idle, GLTFModel.SOLDIER_STATES.Walk, GLTFModel.SOLDIER_STATES.Run],
                        [GLTFModel.ROBOT_STATES.Idle, GLTFModel.ROBOT_STATES.Walking, GLTFModel.ROBOT_STATES.Running],
                    ];
                    this.model._data.fadeToAction(this.model._data.animations[ACTION_MAP[["./Soldier.glb", "./Robot.glb"].indexOf(this.model._data.file)][this.actionId]]);
                }
            }
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
            if (this._text) scene.remove(this._text);
            this._text = null;
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
         * @param {string} modelId
         */
        constructor(x, y, z, uuid, modelId) {
            super(x, y, z, uuid, modelId);
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
            super(x, y, z, uuid, "./Soldier.glb");
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
            socket.on("disconnect", ev => {
                alert("Connection lost!");
                window.location.reload();
            });
            socket.on("open", async ev => {
                if (++_open >= 2) window.location.reload();
                updatePing(ev.time);
                serverData.uuid = ev.uuid;
                socket.emit("ready2");
                player.uuid = ev.uuid;
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
                    const ent = new Entity(entity.position.x, entity.position.y, entity.position.z, entity.uuid, entity.model);
                    ent.yaw = entity.yaw;
                    ent.pitch = entity.pitch;
                    ent.headYaw = entity.headYaw;
                    await ent.init();
                    window.ff = ent;
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
                ent.setModel(entity.model);
            });
            socket.emit("ready");
            this._model = (await loadGLTFModel(this.modelId)).model;
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
                    // noinspection JSUnresolvedFunction
                    pos = this.clone().add(new V3(0, this.eyeHeight * 1.5, 0)).sub(Entity.getDirection(this.yaw, 0).mulScalar(2).setY(0));
                    camera.position.set(pos.x, pos.y, pos.z);
                    camera.lookAt(new THREE.Vector3(this.x, this.y + this.eyeHeight, this.z));
                    break;
                case 2:
                    // noinspection JSUnresolvedFunction
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
            if (this.lastActionId !== this.action) this.lastActionId = this.action;
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

        async updateModelId(id) {
            await this.setModel(["./Soldier.glb", "./Robot.glb"][id], !!this.perspectiveMode);
            this.socket.emit("updateModel", {model: id});
        }
    }

    class RigidBody {
        constructor() {
        }

        createBox(mass, pos, quat, size) {
            this.transform = new Ammo.btTransform();
            this.transform.setIdentity();
            this.transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
            this.transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
            this.motionState = new Ammo.btDefaultMotionState(this.transform);
            this.btSize = new Ammo.btVector3(size.x * .5, size.y * .5, size.z * .5);
            this.shape = new Ammo.btBoxShape(this.btSize);
            this.localInertia = new Ammo.btVector3(0, 0, 0);
            if (mass > 0) this.shape.calculateLocalInertia(mass, this.localInertia);
            this.info = new Ammo.btRigidBodyConstructionInfo(mass, this.motionState, this.shape, this.localInertia);
            this.body = new Ammo.btRigidBody(this.info);
        }

        createSphere(mass, pos, quat, radius) {
            this.transform = new Ammo.btTransform();
            this.transform.setIdentity();
            this.transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
            this.transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
            this.motionState = new Ammo.btDefaultMotionState(this.transform);
            this.shape = new Ammo.btSphereShape(radius);
            this.localInertia = new Ammo.btVector3(0, 0, 0);
            if (mass > 0) this.shape.calculateLocalInertia(mass, this.localInertia);
            this.info = new Ammo.btRigidBodyConstructionInfo(mass, this.motionState, this.shape, this.localInertia);
            this.body = new Ammo.btRigidBody(this.info);
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
        const select_menu = document.getElementById("select_menu");
        const x = Math.min(window.innerWidth, window.innerHeight);
        select_menu.style.width = x * .8 + "px";
        select_menu.style.height = x * .8 + "px";
    }

    window.Ammo = await Ammo();

    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();
    const physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
    physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));

    const transformAux1 = new Ammo.btTransform();

    const renderer = new THREE.WebGLRenderer();
    leftDiv.appendChild(renderer.domElement);
    const renderer2 = new THREE.WebGLRenderer();
    rightDiv.appendChild(renderer2.domElement);
    const img = document.getElementById("img");
    onResize();
    scene.background = new THREE.Color(0xa0a0a0);

    function createBoxBody(mass, pos, quat, size, color) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshPhongMaterial({color}));
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);

        const rbBox = new RigidBody();
        rbBox.createBox(mass, new THREE.Vector3(pos.x, pos.y, pos.z), new THREE.Quaternion(), new THREE.Vector3(size.x, size.y, size.z));
        physicsWorld.addRigidBody(rbBox.body);

        rigidBodies.push({mesh: box, rigidBody: rbBox});
        return {box, rigid: rbBox};
    }

    function createSphereBody(mass, pos, quat, radius, color) {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius), new THREE.MeshPhongMaterial({color}));
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        scene.add(sphere);

        const rbSphere = new RigidBody();
        rbSphere.createSphere(mass, new THREE.Vector3(pos.x, pos.y, pos.z), new THREE.Quaternion(), radius);
        physicsWorld.addRigidBody(rbSphere.body);

        rigidBodies.push({mesh: sphere, rigidBody: rbSphere});
        return {sphere, rigid: rbSphere};
    }

    const rigidBodies = [];

    createBoxBody(0, new THREE.Vector3(0, -1, 0), new THREE.Quaternion(), new THREE.Vector3(100, 1, 100), 0x808080);

    let isPaused = false;
    addEventListener("mousemove", ev => {
        if (!isPaused) return;
        if (mouseDown && mouseDownButton === 0) {
            const {rigid} = createSphereBody(.01, camera.position.clone(), camera.quaternion.clone(), 0.1, 0x00ff00);
            const direction = player.getDirection(10);
            const cameraForce = new Ammo.btVector3(direction.x, direction.y, direction.z);
            rigid.body.applyForce(cameraForce);
        }
    });

    addEventListener("mousemove", ev => {
        document.getElementById("cursor").style.display = "block";
        document.getElementById("cursor").style.left = ev.clientX + "px";
        document.getElementById("cursor").style.top = ev.clientY + "px";
    });

    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);
    const serverData = {uuid: null, /*** @type {Object<number, Entity>} */entities: {}};
    let cP;
    let chatPromise = new Promise(r => cP = r);
    const player = new Player(0, 0, 0, -1, socket);
    await player.init();
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
    const loader = new THREE.FontLoader();
    const font = await new Promise(r => loader.load("../fonts/optimer.regular.json", r));

    function createText(text) {
        const textGeo = new THREE.TextGeometry(text, {
            font: font,
            size: 0.5,
            height: 0.001,
            curveSegments: 5
        });
        const textMesh1 = new THREE.Mesh(textGeo, [
            new THREE.MeshPhongMaterial({color: 0x000000, flatShading: true}),
            new THREE.MeshPhongMaterial({color: 0x000000})
        ]);
        textMesh1.position.x = 0;
        textMesh1.position.y = 2;
        textMesh1.position.z = 0;
        textMesh1.rotation.x = 0;
        textMesh1.rotation.y = Math.PI * 2;
        //scene.add(textMesh1); make this 2d, https://stackoverflow.com/questions/15248872/dynamically-create-2d-text-in-three-js
        return textMesh1;
    }

    let lastTick = Date.now();
    const color = new THREE.Color();

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
                            player.move(Entity.getDirection(player.yaw, 0, .1).setY(0));
                        }
                    } else {
                        if (heldKeys["w"]) {
                            player.actionId = 1;
                            player.move(Entity.getDirection(player.yaw, 0, .1).setY(0));
                        }
                        if (heldKeys["s"]) {
                            player.actionId = 1;
                            player.move(Entity.getDirection(player.yaw, 0, -.1).setY(0));
                        }
                        if (heldKeys["a"]) {
                            player.actionId = 1;
                            player.move(Entity.getRightDirection(player.yaw, 0, .1).setY(0));
                        }
                        if (heldKeys["d"]) {
                            player.actionId = 1;
                            player.move(Entity.getLeftDirection(player.yaw, 0, .1).setY(0));
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
        // TODO: nametag text on top
        // TODO: animations
        // TODO: model selection
        const timeElapsed = Date.now() - lastTick;
        lastTick = Date.now();
        physicsWorld.stepSimulation(timeElapsed / 1000, 10);
        gltfModels.forEach(model => {
            model.updateMixer();
        });

        for (let i = 0; i < rigidBodies.length; i++) {
            rigidBodies[i].rigidBody.motionState.getWorldTransform(transformAux1);
            const pos = transformAux1.getOrigin();
            const quat = transformAux1.getRotation();
            const pos3 = new THREE.Vector3(pos.x(), pos.y(), pos.z());
            const quat3 = new THREE.Quaternion(quat.x(), quat.y(), quat.z(), quat.w());
            rigidBodies[i].mesh.position.copy(pos3);
            rigidBodies[i].mesh.quaternion.copy(quat3);
        }
        requestAnimationFrame(animate);
    }

    let mouse = null;
    let mouseDown = false;
    let middleMouseDown = false;
    let rightMouseDown = false;
    let mouseDownButton = -1;
    vrDiv.addEventListener("mousedown", ev => {
        mouseDown = true;
        if (ev.button === 1) middleMouseDown = true;
        if (ev.button === 2) rightMouseDown = true;
        mouseDownButton = ev.button;
    });
    vrDiv.addEventListener("mouseup", ev => {
        mouseDown = false;
        if (ev.button === 1) middleMouseDown = false;
        if (ev.button === 2) rightMouseDown = false;
        mouseDownButton = -1;
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
    addEventListener("keydown", ev => {
        if (ev.key === "Escape" && !isVROn() && isPaused) pause();
        switch (ev.key) {
            case "z":
                document.getElementById("select_menu").hidden = false;
                break;
        }
    });
    addEventListener("keyup", ev => {
        switch (ev.key) {
            case "z":
                document.getElementById("select_menu").hidden = true;
                break;
        }
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