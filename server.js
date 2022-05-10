const PORT = 12345;

const app = require("express")();
const http = require("http").Server(app);
const time = () => Date.now() + (new Date()).getTimezoneOffset() * 1000 * 60;
require("socket.io")(http).on("connection", sk => {
    console.log("joined");
    sk.emit("open", {time: time()});
});
app.use(require("express").static("public"));
http.listen(PORT);