const PORT = 12345;

const app = require("express")();
// noinspection JSValidateTypes
const http = require("http").Server(app);
const time = () => Date.now() + (new Date()).getTimezoneOffset() * 1000 * 60;
const clients = new Map();
let _client_id = 0;

function broadcastEmit(a, b, c = []) {
    clients.forEach((y, x) => {
        if ((!c.some(i => i === y) || c.length === 0) && y._client.hasPrepared) {
            const d = typeof b === "string" ? b : b(x);
            y.emit(a, d);
        }
    });
}

const chat = [];

function broadcastMessage(msg, c = []) {
    chat.push({
        time: time(),
        message: msg
    });
    clients.forEach((y, x) => {
        if (!c.some(i => i === y) || c.length === 0) y._client.sendMessage(msg);
    });
}

function getFormattedTime(t) {
    const d = new Date(t);
    return d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
}

class Client {
    uuid = ++_client_id;
    position = {x: 0, y: 0, z: 0};
    yaw = 0;
    pitch = 0;
    headYaw = 0;
    hasPrepared = false;
    hasPing = false;
    actionId = 0;
    moveKey = null;

    constructor(socket) {
        this.socket = socket;
    }

    log(n) {
        console.log(`[USER #${this.uuid}] ${n}`);
    }

    init() {
        this.pingInterval = setInterval(() => {
            if (!this.hasPrepared) return this.kick("You have waited too long for login action.", "login timeout");
            if (this.hasPing) return this.kick("It took too long you to respond to server!", "timeout");
            this.hasPing = true;
            this.socket.emit("ping", {time: time()});
        }, 10000);
        this.socket.on("pong", () => this.hasPing = false);
        this.log("Waiting #" + this.uuid + " for authentication...");
        this.socket.on("ready", () => {
            clients.set(this.uuid, this.socket);
            this.log("#" + this.uuid + " is being prepared...");
            this.socket.emit("open", {
                time: time(),
                uuid: this.uuid,
                chat
            });
            this.socket.on("ready2", () => {
                if (!clients.has(this.uuid)) return;
                this.hasPrepared = true;
                this.log("#" + this.uuid + " has connected");
                broadcastMessage("#" + this.uuid + " has connected");
                broadcastEmit("addEntities", x => ({
                    time: time(),
                    uuid: x,
                    entities: Array.from(clients).map(i => i[1]).map(i => ({
                        uuid: i._uuid,
                        entity: i._client.parseEntity()
                    }))
                }));
                this.socket.on("disconnect", () => {
                    if (!clients.has(this.uuid)) return;
                    this.kick("", "client disconnect");
                });
                this.socket.on("chat", ev => {
                    if (!clients.has(this.uuid)) return;
                    const msg = `Guest ${this.uuid}: ${ev.message}`;
                    broadcastMessage(msg);
                });
                this.socket.on("move", ev => {
                    if (!clients.has(this.uuid)) return;
                    if (this.distance(ev.position) > 10) return this.kick("Illegal move packet.", "client disconnect");
                    if (this.moveKey && this.moveKey !== ev.key) return this.kick("Unauthorized move packet.", "client disconnect");
                    this.moveKey = Math.random();
                    this.position = ev.position;
                    this.yaw = ev.yaw;
                    this.pitch = ev.pitch;
                    this.headYaw = ev.headYaw;
                    this.actionId = ev.actionId;
                    const pk = {
                        time: time(),
                        entity: this.parseEntity()
                    };
                    broadcastEmit("updateEntity", x => ({
                        ...pk,
                        uuid: x, ...(x === this.uuid ? {nextKey: this.moveKey} : {})
                    }));
                });
            });
        });
    }

    parseEntity() {
        return {
            uuid: this.uuid,
            position: this.position,
            yaw: this.yaw,
            pitch: this.pitch,
            headYaw: this.headYaw,
            action: this.actionId
        };
    }

    kick(reason, publicReason) {
        if (!clients.has(this.uuid)) return;
        this.log("#" + this.uuid + " has disconnected: " + reason);
        broadcastMessage("#" + this.uuid + " has disconnected: " + publicReason);
        this.socket.emit("kicked", {
            time: time(),
            reason
        });
        broadcastEmit("removeEntity", x => ({
            time: time(),
            uuid: x,
            entity: {uuid: this.uuid}
        }));
        clients.delete(this.uuid);
    }

    sendMessage(msg) {
        this.socket.emit("chat", {
            time: time(),
            uuid: this.uuid,
            message: msg
        });
    }

    distance(p) {
        return Math.sqrt(Math.pow(this.position.x - p.x, 2) + Math.pow(this.position.y - p.y, 2) + Math.pow(this.position.z - p.z, 2));
    }
}

// noinspection JSValidateTypes
require("socket.io")(http).on("connection", sk => {
    const client = new Client(sk);
    sk._uuid = client.uuid;
    sk._client = client;
    client.init();
});
app.use(require("express").static("public"));
http.listen(PORT);