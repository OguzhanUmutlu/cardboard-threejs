const PORT = 12345;

const app = require("express")();
const http = require("http").Server(app);
const time = () => Date.now() + (new Date()).getTimezoneOffset() * 1000 * 60;
const clients = new Map();
let _client_id = 0;

function broadcastEmit(a, b, c = []) {
    clients.forEach((y, x) => {
        if (!c.some(i => i === y) || c.length === 0) y.emit(a, typeof b === "string" ? b : b(x));
    });
}

const chat = [];

function broadcastMessage(msg, c = []) {
    broadcastEmit("chat", x => ({
        time: time(),
        uuid: x,
        message: msg
    }), c);
}

function getFormattedTime(t) {
    const d = new Date(t);
    return d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
}

// noinspection JSValidateTypes
require("socket.io")(http).on("connection", sk => {
    sk._uuid = ++_client_id;
    sk._pos = [[0, 0, 0], [0, 0, 0]];
    sk._parseEntity = () => ({
        uuid: sk._uuid,
        position: {x: sk._pos[0][0], y: sk._pos[0][1], z: sk._pos[0][2]},
        rotation: {x: sk._pos[1][0], y: sk._pos[1][1], z: sk._pos[1][2]}
    });
    sk._kick = reason => {
        if (!clients.has(sk._uuid)) return;
        console.log("#" + sk._uuid + " has disconnected: " + reason);
        broadcastMessage("#" + sk._uuid + " has disconnected: " + reason);
        sk.emit("kicked", {
            time: time(),
            reason
        });
        broadcastEmit("removeEntity", x => ({
            time: time(),
            uuid: x,
            entity: {uuid: sk._uuid}
        }));
        clients.delete(sk._uuid);
    };
    sk._sendMessage = msg => {
        sk.emit("chat", {
            time: time(),
            uuid: sk._uuid,
            message: msg
        });
    }
    sk.on("ready", () => {
        clients.set(sk._uuid, sk);
        sk.emit("open", {
            time: time(),
            uuid: sk._uuid,
            chat
        });
        sk.on("ready2", () => {
            if (!clients.has(sk._uuid)) return;
            console.log("#" + sk._uuid + " has connected");
            broadcastMessage("#" + sk._uuid + " has connected");
            broadcastEmit("addEntities", x => ({
                time: time(),
                uuid: x,
                entities: Array.from(clients).map(i => i[1]).map(i => ({
                    uuid: i._uuid,
                    entity: i._parseEntity()
                }))
            }));
            sk.on("disconnect", () => {
                if (!clients.has(sk._uuid)) return;
                sk._kick("disconnected");
            });
            sk.on("chat", ev => {
                if (!clients.has(sk._uuid)) return;
                const msg = `Guest ${sk._uuid}: ${ev.message}`;
                chat.push({
                    time: time(),
                    message: msg
                });
                broadcastMessage(msg);
            });
            sk.on("move", ev => {
                if (!clients.has(sk._uuid)) return;
                const pos = sk._pos[0];
                const p = ev.position;
                const distance = Math.sqrt(Math.pow(p.x - pos[0], 2) + Math.pow(p.y - pos[1], 2) + Math.pow(p.z - pos[2], 2));
                if (distance > 10) return sk._kick("Illegal move packet.");
                if (sk._moveKey && sk._moveKey !== ev.key) return sk._kick("Unauthorized move packet.");
                sk._moveKey = Math.random();
                const r = ev.rotation;
                sk._pos = [[p.x, p.y, p.z], [r.x, r.y, r.z]];
                const pk = {
                    time: time(),
                    entity: sk._parseEntity()
                };
                broadcastEmit("updateEntity", x => ({
                    ...pk,
                    uuid: x, ...(x === sk._uuid ? {nextKey: sk._moveKey} : {})
                }));
            });
        });
    });
});
app.use(require("express").static("public"));
http.listen(PORT);