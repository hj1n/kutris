import React, { useCallback, useEffect, useRef, useState } from "react";
import { createStage, isColliding, randomTetromino } from "@/utils/gameHelper";
import { ROWPOINTS, STAGE_WIDTH } from "@/utils/gameSetup";
import Cell from "@/components/Cell";
import { socket } from "@/socket";
import GameCard from "@/components/GameCard";
import { v4 as uuidv4 } from "uuid";
import {
  BrowserView,
  MobileView,
  isBrowser,
  isDesktop,
  isMobile,
} from "react-device-detect";
import GameBoard from "@/components/GameBoard";
const usePlayer = () => {
  const [player, setPlayer] = useState({
    pos: { x: 0, y: 0 },
    tetromino: randomTetromino().shape,
    collided: false,
  });

  const updatePlayerPos = ({ x, y, collided }) => {
    setPlayer((prev) => ({
      ...prev,
      pos: { x: prev.pos.x + x, y: prev.pos.y + y },
      collided,
    }));
  };

  const resetPlayer = useCallback(() => {
    setPlayer({
      pos: { x: STAGE_WIDTH / 2 - 2, y: 0 },
      tetromino: randomTetromino().shape,
      collided: false,
    });
  }, []);

  const rotate = (matrix) => {
    const mtrx = matrix.map((_, i) => matrix.map((column) => column[i]));
    return mtrx.map((row) => row.reverse());
  };

  const playerRotate = (stage) => {
    const clonedPlayer = JSON.parse(JSON.stringify(player));
    clonedPlayer.tetromino = rotate(clonedPlayer.tetromino);

    const posX = clonedPlayer.pos.x;
    let offset = 1;
    while (isColliding(clonedPlayer, stage, { x: 0, y: 0 })) {
      clonedPlayer.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));

      if (offset > clonedPlayer.tetromino[0].length) {
        clonedPlayer.pos.x = posX;
        return;
      }
    }

    setPlayer(clonedPlayer);
  };

  return { player, updatePlayerPos, resetPlayer, playerRotate };
};

const useStage = (player, resetPlayer) => {
  const [stage, setStage] = useState(createStage());
  const [rowsCleared, setRowsCleared] = useState(0);

  useEffect(() => {
    if (!player.pos) return;
    setRowsCleared(0);

    const sweepRows = (newStage) => {
      return newStage.reduce((ack, row) => {
        if (row.every((cell) => cell[0] !== 0)) {
          setRowsCleared((prev) => prev + 1);
          ack.unshift(new Array(newStage[0].length).fill([0, "clear"]));
          return ack;
        }
        ack.push(row);
        return ack;
      }, []);
    };

    const updateStage = (prevStage) => {
      const newStage = prevStage.map((row) =>
        row.map((cell) => (cell[1] === "clear" ? [0, "clear"] : cell))
      );

      player.tetromino.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            newStage[y + player.pos.y][x + player.pos.x] = [
              value,
              `${player.collided ? "merged" : "clear"}`,
            ];
          }
        });
      });

      if (player.collided) {
        resetPlayer();
        return sweepRows(newStage);
      }

      return newStage;
    };

    setStage((prev) => updateStage(prev));
  }, [player, resetPlayer]);

  return { stage, setStage, rowsCleared };
};

const useGameStatus = (rowsCleared) => {
  const [score, setScore] = useState(0);
  const [rows, setRows] = useState(0);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    if (rowsCleared > 0) {
      setScore((prev) => prev + ROWPOINTS[rowsCleared - 1] * level);
      setRows((prev) => prev + rowsCleared);
      socket.emit("sendAttack", { count: rowsCleared });
    }
  }, [rowsCleared]);

  return { score, setScore, rows, setRows, level, setLevel };
};

const useInterval = (callback, delay) => {
  const savedCallback = useRef(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      if (savedCallback.current) savedCallback.current();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
};

export default function Home() {
  const { player, updatePlayerPos, resetPlayer, playerRotate } = usePlayer();
  const { stage, setStage, rowsCleared } = useStage(player, resetPlayer);
  const [otherPlayerStage, setOtherPlayerStage] = useState(createStage());
  const [otherPlayerScore, setOtherPlayerScore] = useState({
    score: 0,
    rows: 0,
    level: 1,
  });
  const { score, setScore, rows, setRows, level, setLevel } =
    useGameStatus(rowsCleared);

  const [dropTime, setDroptime] = useState(null);
  const [gameStart, setGameStart] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [selectedPlayingGame, setSelectedPlayingGame] = useState(null);
  const [playingGameList, setPlayingGameList] = useState([]);
  const [viewGameCode, setViewGameCode] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMobileCheck, setIsMobileCheck] = useState(false);
  const [friendNickname, setFriendNickname] = useState("");
  const [matchMsg, setMatchMsg] = useState(null);
  const [isSendInvite, setIsSendInvite] = useState(false);
  const gameArea = useRef(null);
  const [nickname, setNickname] = useState(null);
  const [playType, setPlayType] = useState("single");
  const [inComingInvite, setInComingInvite] = useState("");
  const [startGameCountDown, setStartGameCountDown] = useState(3);

  useEffect(() => {
    // 페이지 로딩시 스테이지 초기화 및 플레이어 닉네임 생성
    setStage(createStage());
    setNickname(`Player_${uuidv4().slice(0, 5)}`);
  }, []);

  useEffect(() => {
    // 모바일 기기 체크
    if (isMobile) {
      setIsMobileCheck(true);
    }
  }, []);

  useEffect(() => {
    // 닉네임이 생성되면 서버에 전송
    if (!isConnected || !nickname) {
      return;
    }

    socket.emit("setNickname", { nickname });
  }, [nickname, isConnected]);

  useEffect(() => {
    // stage 업데이트시 서버에 전송

    if (!socket.connected || !gameStart || !stage) {
      return;
    }

    socket.emit("updateGame", { stage, rows, score, level });
  }, [stage]);

  useEffect(() => {
    // 소켓 연결
    if (socket.connected) {
      onConnect();
    }

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      alert("서버와 연결이 끊겼습니다, 페이지를 새로고침합니다.");
      window.location.reload();
      setIsConnected(false);
    }
    function onViewGameList({ playingGameList }) {
      console.log("playingGameList", playingGameList);
      setPlayingGameList(playingGameList);
    }
    function onSocketError({ message }) {
      alert(message);
      window.location.reload();
    }
    function onUpdateGameFromServer({ game }) {
      // setStage(stage);
      // setRows(rows);
      // setScore(score);
      // setLevel(level);
      // playerStage is map with player nickname and stage
      // playerScore is map with player nickname and score
      // state is game state
      // players is array of player nickname
      // console.log("state", state);
      game.playerStage.forEach(([player, { stage, rows, score, level }]) => {
        if (player != nickname) {
          setOtherPlayerStage(stage);
          setOtherPlayerScore({ score, rows, level });
        }
      });

      // Array.from(game).forEach(([nickname, { stage, rows, score, level }]) => {
      //   if (nickname != nickname) {
      //     setOtherPlayerStage(stage);
      //     setOtherPlayerScore({ score, rows, level });
      //   }
      // });
    }

    function onGameOver({ message }) {
      if (playType == "view") {
        // 관전자 입장에서의 게임오버
        alert("게임이 종료되어 관전을 종료합니다.");
        setGameStart(false);
        setGameOver(false);
        setStage(createStage());
        setSelectedPlayingGame(null);
      }
    }
    function onInviteError({ message }) {
      alert(message);
      setIsSendInvite(false);
      setFriendNickname("");
      setMatchMsg("받은 매치 요청이 없습니다. ");
    }
    function onInviteReceived({ friendNickname }) {
      if (playType == "multiFriend") {
        setInComingInvite(friendNickname);
        setMatchMsg(null);

        // const accept = confirm(
        //   `${friendNickname}님으로부터 매치 요청이 왔습니다. 수락하시겠습니까?`
        // );
        // if (accept) {
        //   socket.emit("inviteAccept", { friendNickname });
        //   setGameStart(true);
        // }
      }
    }
    function onInviteSent({ message }) {
      if (playType == "multiFriend") {
        setMatchMsg(message);
      }
    }

    function onConfirmInvite({ friendNickname }) {
      setPlayType("multiGaming");
      setMatchMsg("매치가 성사되어 3초뒤 게임이 시작됩니다.");
      setTimeout(() => {
        handleStartGame();

        setMatchMsg(null);
      }, 3000);
    }
    function onReceiveAttack({ count }) {
      console.log("count", count);
      for (let i = 0; i < count; i++) {
        insertRandomRow();
      }
    }

    function onGameEnd() {
      alert("상대방이 게임을 나갔습니다.\n게임을 종료합니다.");
      setGameStart(false);
      setGameOver(false);
      setStage(createStage());
      setSelectedPlayingGame(null);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("viewGameList", onViewGameList);
    socket.on("error", onSocketError);
    socket.on("gameOver", onGameOver);
    socket.on("gameEnd", onGameEnd);

    socket.on("updateGameFromServer", onUpdateGameFromServer);
    // inviteError,inviteReceived,inviteSent
    socket.on("inviteError", onInviteError);
    socket.on("inviteReceived", onInviteReceived);
    socket.on("inviteSent", onInviteSent);
    socket.on("confirmInvite", onConfirmInvite);
    socket.on("receiveAttack", onReceiveAttack);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("viewGameList", onViewGameList);
      socket.off("error", onSocketError);
      socket.off("gameOver", onGameOver);
      socket.off("gameEnd", onGameEnd);
      socket.off("updateGameFromServer", onUpdateGameFromServer);
      socket.off("inviteError", onInviteError);
      socket.off("inviteReceived", onInviteReceived);
      socket.off("inviteSent", onInviteSent);
      socket.off("confirmInvite", onConfirmInvite);
      socket.off("receiveAttack", onReceiveAttack);
    };
  }, [playType, stage, score, rows, level]);

  const movePlayer = (dir) => {
    if (!isColliding(player, stage, { x: dir, y: 0 })) {
      updatePlayerPos({ x: dir, y: 0, collided: false });
    }
  };

  const keyUp = ({ keyCode }) => {
    if (!gameOver && keyCode === 40) {
      setDroptime(1000 / level + 200);
    }
  };

  const handleStartGame = () => {
    if (playType == "single") {
      socket.emit("startSingleGame");
    }
    if (gameArea.current) gameArea.current.focus();
    setStage(createStage());
    setDroptime(1000);
    resetPlayer();
    setScore(0);
    setLevel(1);
    setRows(0);
    setGameStart(true);
    setGameOver(false);
  };

  const move = (e) => {
    // 관전모드는 키입력 무시
    if (playType == "view") return;

    const { keyCode, repeat } = e;
    if (!gameOver) {
      if (keyCode === 37) {
        // left
        movePlayer(-1);
      } else if (keyCode === 39) {
        // right
        movePlayer(1);
      } else if (keyCode === 40 && !repeat) {
        // down
        setDroptime(30);
      } else if (keyCode === 38) {
        // up
        playerRotate(stage);
      } else if (keyCode === 32) {
        e.preventDefault();
        hardDrop();
      }
    }
  };

  const moveControl = (dir) => {
    if (!gameOver) {
      if (dir === "left") {
        movePlayer(-1);
      } else if (dir === "right") {
        movePlayer(1);
      } else if (dir === "rotate") {
        playerRotate(stage);
      } else if (dir === "drop") {
        hardDrop();
      } else {
        console.log("Invalid move");
      }
    }
  };

  const drop = () => {
    if (rows > level * 10) {
      setLevel((prev) => prev + 1);
      setDroptime(1000 / level + 200);
    }

    if (!isColliding(player, stage, { x: 0, y: 1 })) {
      updatePlayerPos({ x: 0, y: 1, collided: false });
    } else {
      if (player.pos.y < 1) {
        console.log("Game over!");
        socket.emit("gameOver");
        setGameOver(true);
        setDroptime(null);
      }
      updatePlayerPos({ x: 0, y: 0, collided: true });
    }
  };

  const hardDrop = () => {
    let dropPos = player.pos.y;
    while (
      !isColliding(player, stage, { x: 0, y: dropPos - player.pos.y + 1 })
    ) {
      dropPos += 1;
    }
    updatePlayerPos({ x: 0, y: dropPos - player.pos.y, collided: true });
  };

  const insertRandomRow = () => {
    const newRow = new Array(STAGE_WIDTH).fill([1, "damage"]);
    newRow[Math.floor(Math.random() * STAGE_WIDTH)] = [0, "clear"];
    const newStage = stage.slice(1).concat([newRow]);
    setStage(newStage);
  };

  useInterval(() => {
    drop();
  }, dropTime);

  return (
    <main className="bg-white h-[100svh] w-full fixed">
      {(!gameStart || gameOver) && (
        <div className="modal fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-5 rounded h-4/5 w-10/12 max-w-80">
            {gameOver ? (
              <div className="flex flex-col items-center gap-5">
                <div>게임오버</div>
                <div>
                  <div className="font-bold">내 게임 스코어</div>
                  <div className="text-sm">
                    <div>게임 스코어 : {score}</div>
                    <div>처리한 줄 갯수 : {rows}</div>
                    <div>달성한 레벨 : {level}</div>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setGameStart(false);
                    setGameOver(false);
                    setStage(createStage());
                    setPlayType("single");
                  }}
                  className="cursor-pointer bg-gray-800 text-white p-2 rounded"
                >
                  처음으로
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <div>닉네임 : {nickname}</div>
                {playType != "multiGaming" && (
                  <form className="max-w-sm mx-auto">
                    <label
                      htmlFor="selectType"
                      className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      타입 선택
                    </label>
                    <select
                      id="selectType"
                      value={playType}
                      onChange={(e) => {
                        if (!isConnected && e.target.value !== "single") {
                          alert(
                            "서버가 연결되지 않았습니다. 싱글플레이로 진행해주세요"
                          );
                          setPlayType("single");
                          return;
                        } else {
                          if (playType != "view" && e.target.value == "view") {
                            setSelectedPlayingGame([]);
                            socket.emit("viewGameWaitingJoin");
                          } else if (
                            playType == "view" &&
                            e.target.value != "view"
                          ) {
                            setSelectedPlayingGame([]);
                            socket.emit("viewGameWaitingLeave");
                          } else if (
                            e.target.value.includes("multi") &&
                            isMobile
                          ) {
                            alert(
                              "모바일에서는 멀티플레이시 상대방플레이 화면을 볼 수 없습니다."
                            );
                            // return;
                          } else if (
                            playType != "multiFriend" &&
                            e.target.value == "multiFriend"
                          ) {
                            socket.emit("waitFriend");
                            setMatchMsg("받은 매치 요청이 없습니다. ");
                          } else if (
                            playType == "multiFriend" &&
                            e.target.value != "multiFriend"
                          ) {
                            socket.emit("waitFriendLeave");
                            setMatchMsg(null);
                          }
                          setPlayType(e.target.value);
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    >
                      <option value="single">싱글플레이</option>
                      <option value="multiRandom">멀티플레이 - 랜덤매칭</option>
                      <option value="multiFriend">멀티플레이 - 친구초대</option>

                      <option value="view">다른 플레이어 관전</option>
                    </select>
                  </form>
                )}
                <div className="flex flex-col gap-y-2">
                  {" "}
                  {!inComingInvite && playType == "multiFriend" && (
                    <>
                      <div>친구와 1:1 매치</div>

                      <div className="text-sm">
                        친구에게 참여코드{" "}
                        <span
                          onClick={() => {
                            navigator.clipboard.writeText(
                              nickname.replace("Player_", "")
                            );
                            alert(
                              "클립보드에 복사되었습니다, 친구에게 전달해주세요."
                            );
                          }}
                          className="font-bold text-blue-500"
                        >
                          {nickname?.replace("Player_", "")}{" "}
                        </span>
                        를 전달하거나, 친구한테 받은 코드를 입력해주세요.
                      </div>
                    </>
                  )}
                  {!isSendInvite &&
                    !inComingInvite &&
                    playType == "multiFriend" && (
                      <div className="flex justify-between ">
                        <input
                          type="text"
                          id="helper-text"
                          maxLength={5}
                          minLength={5}
                          aria-describedby="helper-text-explanation"
                          value={friendNickname.replace("Player_", "")}
                          onChange={(e) => {
                            setFriendNickname(`Player_${e.target.value}`);
                          }}
                          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-1/2 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                          placeholder="abcde"
                        ></input>
                        <button
                          disabled={
                            !friendNickname || friendNickname.length < 12
                          }
                          onClick={() => {
                            // /^[a-z0-9]{5}$/
                            if (
                              !/^[a-z0-9]{5}$/.test(
                                friendNickname.replace("Player_", "")
                              )
                            ) {
                              alert(
                                "닉네임은 5자리 영문자와 숫자로 입력해주세요."
                              );
                              setFriendNickname("");
                              return;
                            } else if (friendNickname == nickname) {
                              alert("자신의 닉네임은 입력할 수 없습니다.");
                              setFriendNickname("");
                              return;
                            }
                            socket.emit("inviteFriend", {
                              friendNickname,
                            });
                            setMatchMsg(
                              "친구에게 매치 요청을 보냈으며, 수락시 게임이 시작됩니다."
                            );
                            setIsSendInvite(true);
                          }}
                          class="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded
         disabled:bg-gray-200 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
                        >
                          매치 요청
                        </button>
                      </div>
                    )}
                  {inComingInvite && playType == "multiFriend" && (
                    <>
                      <div className="text-sm">새로운 매치 요청</div>

                      <div className="flex justify-between ">
                        <div className="font-bold">{inComingInvite}</div>
                        <div>
                          <button
                            onClick={() => {
                              socket.emit("acceptInvite", {
                                friendNickname: inComingInvite,
                              });
                              // setGameStart(true);
                              setInComingInvite(null);
                            }}
                            class="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-1 px-2 border border-blue-500 hover:border-transparent rounded
                          disabled:bg-gray-200 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
                          >
                            수락
                          </button>
                          <button
                            onClick={() => {
                              socket.emit("rejectInvite", {
                                friendNickname: inComingInvite,
                              });
                              setInComingInvite(null);
                              setMatchMsg("받은 매치 요청이 없습니다. ");
                            }}
                            class="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-1 px-2 border border-blue-500 hover:border-transparent rounded
         disabled:bg-gray-200 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  {playType.includes("multi") && matchMsg && (
                    <li className="flex items-center text-xs text-blue-500">
                      <div role="status">
                        <svg
                          aria-hidden="true"
                          className="w-4 h-4 me-2 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
                          viewBox="0 0 100 101"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                            fill="currentColor"
                          />
                          <path
                            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                            fill="currentFill"
                          />
                        </svg>
                      </div>
                      {matchMsg}
                    </li>
                  )}
                </div>

                {playType == "single" && (
                  <div
                    onClick={handleStartGame}
                    className="cursor-pointer bg-gray-800 text-white p-2 rounded"
                  >
                    게임 시작
                  </div>
                )}
                {playType == "view" && (
                  <div>
                    <div className="font-bold">현재 진행중인 게임</div>
                    {playingGameList.length == 0 ? (
                      <li className="flex items-center text-sm text-red-500">
                        <div role="status">
                          <svg
                            aria-hidden="true"
                            className="w-4 h-4 me-2 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
                            viewBox="0 0 100 101"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                              fill="currentColor"
                            />
                            <path
                              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                              fill="currentFill"
                            />
                          </svg>
                        </div>
                        진행중인 게임이 없습니다.
                      </li>
                    ) : (
                      <>
                        <div className="w-48 h-44 overflow-y-scroll flex flex-col gap-y-1">
                          {playingGameList?.map((game) => (
                            <div
                              key={game.gameId}
                              onClick={() =>
                                setSelectedPlayingGame(game.gameId)
                              }
                            >
                              <GameCard
                                selectedPlayingGame={selectedPlayingGame}
                                gameId={game.gameId}
                                gameType={game.gameType}
                                playerList={game.players}
                              />
                            </div>
                          ))}
                        </div>
                        <div
                          onClick={() => {
                            setViewGameCode(selectedPlayingGame);
                            setGameStart(true);
                            socket.emit("viewGameJoin", {
                              gameId: selectedPlayingGame,
                            });
                          }}
                          className="cursor-pointer bg-gray-800 text-white p-2 rounded"
                        >
                          관전 시작
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <div
        tabIndex="0"
        onKeyDown={(e) => move(e)}
        onKeyUp={(e) => keyUp(e)}
        ref={gameArea}
        id="tetrisWrapper"
        className="overflow-hidden outline-none flex items-center justify-center flex-col"
      >
        {/* <div>
          <div className="display h-1/6 justify-center items-center ">
            <div className="flex gap-5">
              <div>스코어 {score}</div>
              <div>줄 {rows}</div>
              <div>레벨 {level}</div>

              {isConnected ? (
                <span className="ml-5 inline-flex items-center bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
                  <span className="w-2 h-2 me-1 bg-green-500 rounded-full"></span>
                  Server ON
                </span>
              ) : (
                <span className="inline-flex items-center bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-red-900 dark:text-red-300">
                  <span className="w-2 h-2 me-1 bg-red-500 rounded-full"></span>
                  Server OFF
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center h-4/6">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(12, 25px)`,
                gridTemplateRows: `repeat(20, 25px)`,
                gridGap: "1px",
                border: "1px solid #777",
                background: "#222",
              }}
            >
              {stage.map((row, y) =>
                row.map((cell, x) => <Cell key={x * 20 + y} type={cell[0]} />)
              )}
            </div>
          </div>
        </div> */}
        {/* { stage, score, rows, level, isConnected } */}
        <div className="flex">
          <GameBoard
            stage={stage}
            score={score}
            rows={rows}
            level={level}
            isConnected={isConnected}
          />
          {!isMobileCheck && playType.includes("multi") && (
            <GameBoard
              stage={otherPlayerStage}
              score={otherPlayerScore.score}
              rows={otherPlayerScore.rows}
              level={otherPlayerScore.level}
              isConnected={isConnected}
            />
          )}
        </div>

        {playType != "view" && isMobileCheck && (
          <div className="w-full flex justify-between h-20">
            <button
              onClick={() => moveControl("left")}
              className="p-2 bg-gray-800 text-white rounded w-16 flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={() => moveControl("rotate")}
              className="p-2 bg-gray-800 text-white rounded w-16 flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.5 12.5a8.5 8.5 0 0112.5 0M7.5 14.5a4.5 4.5 0 016 0"
                />
              </svg>
            </button>
            <button
              onClick={() => moveControl("drop")}
              className="p-2 bg-gray-800 text-white rounded w-16 flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                />
              </svg>
            </button>
            <button
              onClick={() => moveControl("right")}
              className="p-2 bg-gray-800 text-white rounded w-16 flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
