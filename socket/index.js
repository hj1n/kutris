const express = require("express");
const app = express();
const server = require("http").createServer(app);
const socketIO = require("socket.io")(server, {
  // pingInterval: 3000,
  // pingTimeout: 5000,
});

const port = process.env.PORT || 3001;
let userList = {};
let gameList = [];
// [{"type":"single", "playerList": ["user1"]}, {"type":"multi", "playerList": ["user1", "user2"]}]
server.listen(port, () => {
  console.log("Socket IO server listening on port" + port);
});

// socket이 연결되었을 때
socketIO.on("connection", (socket) => {
  // success라는 이벤트가 발생했을 때
  console.log("socket connected", socket.id);
  socket.emit("success", "socket connected - succentEventA");

  socket.on("setNickname", (nickname) => {
    console.log("setNickname", nickname);
    socket.nickname = nickname;
    userList[nickname] = socket;
    console.log("userList", userList[nickname].rooms);
  });

  socket.on("gameStart", () => {
    console.log("gameStart");
  });

  socket.on("viewGame", () => {
    console.log("viewGame");
  });
  socket.on("updateStage", ({ stage, rows, score, level }) => {
    console.log("updateStage Event");
    console.log(`rows: ${rows}, score: ${score}, level: ${level}`);
  });
  socket.on("disconnect", () => {
    console.log("socket disconnected", socket.nickname);
  });
});
