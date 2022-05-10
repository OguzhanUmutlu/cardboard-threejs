const socket = io();
let ping = -1;
const vrDiv = document.getElementById("vr");
const leftDiv = document.getElementById("left");
const rightDiv = document.getElementById("right");
const pauseDiv = document.getElementById("pause");

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

async function req(a) {
    return await new Promise(async r => {
        try {
            r((await a.requestPermission()) === "granted");
        } catch (e) {
            r(true);
        }
    });
}

async function openFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) return await elem.requestFullscreen();
    if (elem["webkitRequestFullscreen"]) return await elem["webkitRequestFullscreen"]();
    if (elem["msRequestFullscreen"]) return await elem["msRequestFullscreen"]();
}

async function closeFullscreen() {
    if (document.exitFullscreen) return await document.exitFullscreen();
    if (document["webkitExitFullscreen"]) return await document["webkitExitFullscreen"]();
    if (document["msExitFullscreen"]) return await document["msExitFullscreen"]();
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

async function init() {
    let _open = 0;
    socket.on("open", ev => {
        if (++_open >= 2) window.location.reload();
        updatePing(ev.time);
    });
    if (!await req(window.DeviceOrientationEvent) || !await req(window.DeviceMotionEvent)) {
        alert("Permission was denied!");
        setTimeout(() => window.location.reload(), 1000);
        return;
    }
    Promise.all([navigator.permissions.query({name: "notifications"})])
        .then(results => {
            if (results.every(result => result.state === "granted")) {
                console.log("granted");
            } else {
                console.log("No permissions to use AbsoluteOrientationSensor.");
            }
        });
    const isVROn = () => isMobile() && window.innerWidth > window.innerHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, (window.innerWidth / 2) / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth / 2, window.innerHeight);
    leftDiv.appendChild(renderer.domElement);
    const renderer2 = new THREE.WebGLRenderer();
    renderer2.setSize(window.innerWidth / 2, window.innerHeight);
    rightDiv.appendChild(renderer2.domElement);
    const img = document.getElementById("img");
    img.width = window.innerWidth;
    img.height = window.innerHeight;
    const loader = new THREE.TextureLoader();
    loader.load("./cube.png", texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        const boxSize = 5;
        texture.repeat.set(boxSize, boxSize);
        const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0x01BE00,
            side: THREE.BackSide
        });
        const skybox = new THREE.Mesh(geometry, material);
        scene.add(skybox);
    });

    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshNormalMaterial();
    const cube = new THREE.Mesh(geometry, material);
    cube.position.z += 2
    scene.add(cube);
    camera.position.z = 5;
    let radian = 0;

    async function animate() {
        if (isVROn()) {
            vrDiv.style.display = "block";
            pauseDiv.style.display = "none";
            radian += Math.PI / 90;
            cube.position.x = Math.cos(radian);
            cube.position.y = -Math.sin(radian);
            renderer.render(scene, camera);
            renderer2.render(scene, camera);
        } else {
            vrDiv.style.display = "none";
            pauseDiv.style.display = "block";
            document.getElementById("pauseText").innerHTML = isMobile() ? "Wear your VR" : "Use your mobile device";
        }
        requestAnimationFrame(animate);
    }

    await animate();

    let mouse = null;


    vrDiv.addEventListener("click", () => {
        camera.rotation.x = 0;
        camera.rotation.y = 0;
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

    window.addEventListener("deviceorientation", ev => {
        const {alpha, beta, gamma} = ev;
        alert("1:" + alpha + ":" + beta + ":" + gamma);
    });

    function onMouseMove(ev) {
        if (mouse) {
            camera.rotation.y += (mouse[0] - ev.clientX) / 100;
            camera.rotation.x += (mouse[1] - ev.clientY) / 100;
        }
        mouse = [ev.clientX, ev.clientY];
    }

    window.addEventListener("resize", () => {
        img.width = window.innerWidth;
        img.height = window.innerHeight;
        camera.aspect = (window.innerWidth / 2) / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth / 2, window.innerHeight);
    }, false);
}

init().then(r => r);