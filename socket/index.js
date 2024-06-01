const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  // pingInterval: 3000,
  // pingTimeout: 5000,
});

class Player {
  constructor(socket, nickname) {
    this.socket = socket;
    this.nickname = nickname;
    this.isPlaying = false;
    this.currentGame = null;
    this.currentGameType = null;
    this.state = "waiting"; // "waiting", "waitingFriend"
  }

  waitingFriend() {
    this.state = "waitingFriend";
  }

  waitingFriendLeave() {
    this.state = "waiting";
  }
}
class Game {
  constructor(player1, player2 = null) {
    this.players = [player1];
    if (player2) {
      this.players.push(player2);
      this.gameType = "multi";
    } else {
      this.gameType = "single";
    }
    this.id = `${this.gameType}_${Math.random().toString(36).substring(2, 15)}`;
    this.state = "waiting"; // "waiting", "playing", "finished"
    this.playerStage = new Map();
  }

  start() {
    this.state = "playing";
    this.players.forEach((player) => {
      player.isPlaying = true;
      // player.currentGame = this;
    });
  }

  end() {
    this.state = "finished";
    this.players.forEach((player) => {
      player.isPlaying = false;
      player.currentGame = null;
    });
  }

  getState() {
    // 게임의 현재 상태를 반환합니다.
    // 예시: { board: [...], score: {...}, ... }
    return {
      state: this.state,
      players: this.players.map((player) => player.nickname),
    };
  }
}

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log("Socket IO server listening on port" + port);
});

const playerList = new Map();
const gameList = new Map();
const waitingPlayers = [];

io.on("connection", (socket) => {
  socket.on("setNickname", ({ nickname }) => {
    if (!playerList.has(nickname)) {
      const player = new Player(socket, nickname);
      playerList.set(nickname, player);
      socket.emit("nicknameSet", {
        success: true,
        message: "Nickname set successfully",
      });
    } else {
      // 이미 사용중인 닉네임일 경우, 새 닉네임 설정하도록 함
      // 플레이어 목록에 추가하지 않음
      socket.emit("error", {
        message: "닉네임이 다른사용자와 중복되어 재접속합니다.",
      });
    }
  });

  socket.on("startSingleGame", () => {
    const player = getPlayerBySocket(socket);
    if (player) {
      // 우리 목록에 있는 플레이어인지 확인후 새게임 생성
      const game = new Game(player);
      // 플레이어가 1명이므로 바로 시작
      gameList.set(game.id, game);
      player.currentGame = game;
      game.start();
      socket.join(game.id);
      socket.emit("gameStart", {
        gameId: game.id,
        players: [{ nickname: player.nickname }],
      });
      broadCastViewGameList();
    }
  });

  socket.on("gameOver", () => {
    const player = getPlayerBySocket(socket);
    if (player) {
      const game = player.currentGame;
      if (game) {
        game.end();
        gameList.delete(game.id);
        io.to(game.id).emit("gameOver", { message: "게임이 종료되었습니다." });
      }
    }
    broadCastViewGameList();
  });
  socket.on("updateGame", ({ stage, rows, score, level }) => {
    const player = getPlayerBySocket(socket);
    if (player) {
      // 해당 플레이어가 참여중인 게임 obj확인
      const game = player.currentGame;
      if (game) {
        // 게임의 플레이어별 상태 업데이트
        game.playerStage.set(player.nickname, {
          stage,
          rows,
          score,
          level,
        });
        // 자기가 속한 게임 socket room에 업데이트된 게임 상태 전달
        socket.to(game.id).emit("updateGameFromServer", {
          nickname: player.nickname,
          stage,
          rows,
          score,
          level,
        });
      }
    }
  });

  socket.on("joinRandomMatch", () => {
    const player = getPlayerBySocket(socket);
    if (player && !player.isPlaying) {
      waitingPlayers.push(player);
      if (waitingPlayers.length >= 2) {
        const player1 = waitingPlayers.shift();
        const player2 = waitingPlayers.shift();
        const game = new Game(player1, player2);
        gameList.set(game.id, game);
        player1.currentGame = game;
        player2.currentGame = game;
        game.start();
        player1.socket.join(game.id);
        player2.socket.join(game.id);
        io.to(game.id).emit("gameStart", {
          gameId: game.id,
          players: [
            { nickname: player1.nickname },
            { nickname: player2.nickname },
          ],
        });
      }
    }
  });

  socket.on("waitFriend", () => {
    const player = getPlayerBySocket(socket);
    if (player && !player.isPlaying) {
      // 친구 초대 대기 상태로 변경
      player.waitingFriend();
    }
  });

  socket.on("waitFriendLeave", () => {
    const player = getPlayerBySocket(socket);
    if (player && !player.isPlaying) {
      // 친구 초대 대기 상태로 변경
      player.waitingFriendLeave();
    }
  });

  socket.on("inviteFriend", ({ friendNickname }) => {
    const player = getPlayerBySocket(socket);
    const friend = playerList.get(`${friendNickname}`);
    // check friend is waiting
    if (player && friend && friend.state == "waitingFriend") {
      socket.emit("inviteSent", { message: "친구에게 매치요청을 보냈습니다." });
      friend.socket.emit("inviteReceived", { friendNickname: player.nickname });
    } else if (player && friend && friend.state != "waitingFriend") {
      socket.emit("inviteError", {
        message: "친구가 온라인이지만, 1:1매치 대기상태가 아닙니다.",
      });
    } else {
      socket.emit("inviteError", {
        message: "입력한 플레이어가 온라인이 아닙니다.",
      });
    }
  });

  socket.on("rejectInvite", ({ friendNickname }) => {
    const player = getPlayerBySocket(socket);
    const friend = playerList.get(friendNickname);
    if (player && friend && !friend.isPlaying) {
      friend.socket.emit("inviteError", {
        message: "친구가 매치를 거절했습니다.",
      });
    }
  });

  socket.on("acceptInvite", ({ friendNickname }) => {
    const player = getPlayerBySocket(socket);
    const friend = playerList.get(friendNickname);
    if (player && friend && !friend.isPlaying) {
      const game = new Game(player, friend);
      gameList.set(game.id, game);
      player.currentGame = game;
      friend.currentGame = game;
      game.start();
      player.socket.join(game.id);
      friend.socket.join(game.id);
      io.to(game.id).emit("confirmInvite", {
        gameId: game.id,
        players: [{ nickname: player.nickname }, { nickname: friend.nickname }],
      });
      // send gameStart After 3 seconds
    }
  });

  socket.on("viewGameWaitingJoin", () => {
    // 관전 가능한 게임 목록 실시간 전달하기 위한 room join
    socket.join("viewGameWaiting");
    // 현재 게임중인 목록 한번 전달 및 다른 함수에서 게임 추가시 실시간 전달
    // const playingGames = [];
    // gameList.forEach((game) => {
    //   if (game.state === "playing") {
    //     playingGames.push({
    //       gameId: game.id,
    //       players: game.players.map((player) => player.nickname),
    //       gameType: game.gameType,
    //     });
    //   }
    // });
    // io.to("viewGameWaiting").emit("viewGameList", {
    //   playingGameList: getGames(),
    // });
    broadCastViewGameList();
  });
  socket.on("viewGameWaitingLeave", () => {
    // 관전 가능한 게임 목록 실시간 전달하기 위한 room leave
    socket.leave("viewGameWaiting");
  });

  socket.on("viewGameJoin", ({ gameId }) => {
    const game = gameList.get(gameId);

    if (game) {
      socket.join(gameId);
      // socket.emit("updateGameFromServer", { state: game.getState() });
    } else {
      socket.emit("error", { message: "Game not found" });
    }
  });

  socket.on("disconnect", () => {
    console.log("disconnected", socket.id);
    // 속한 게임에 기권 처리
    // 게임 종료 처리
    // 게임 삭제 처리
    // 플레이어 목록에서 삭제

    const player = getPlayerBySocket(socket);
    if (player) {
      if (player.currentGame) {
        // 멀티게임이었을 경우 상대방에게 승리 메시지 전달
        const game = player.currentGame;
        game.end();
        gameList.delete(game.id);
        io.to(game.id).emit("gameEnd", { message: "Opponent disconnected" });
      }
      playerList.delete(player.nickname);
    }
    broadCastViewGameList();
  });
});

function getPlayerBySocket(socket) {
  for (const [nickname, player] of playerList.entries()) {
    if (player.socket.id === socket.id) {
      return player;
    }
  }
  return null;
}

function broadCastViewGameList() {
  io.to("viewGameWaiting").emit("viewGameList", {
    playingGameList: getGames(),
  });
}
function getGames() {
  const playingGames = [];
  gameList.forEach((game) => {
    if (game.state === "playing") {
      playingGames.push({
        gameId: game.id,
        players: game.players.map((player) => player.nickname),
        gameType: game.gameType,
      });
    }
  });
  return playingGames;
}
