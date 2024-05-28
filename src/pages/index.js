import React, { useCallback, useEffect, useRef, useState } from "react";
import { createStage, isColliding, randomTetromino } from "@/utils/gameHelper";
import { ROWPOINTS, STAGE_WIDTH } from "@/utils/gameSetup";
import Cell from "@/components/Cell";
import { socket } from "@/socket";
import { v4 as uuidv4 } from "uuid";
import {
  BrowserView,
  MobileView,
  isBrowser,
  isDesktop,
  isMobile,
} from "react-device-detect";
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
  const { score, setScore, rows, setRows, level, setLevel } =
    useGameStatus(rowsCleared);

  const [dropTime, setDroptime] = useState(null);
  const [gameStart, setGameStart] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playingGameList, setPlayingGameList] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMobileCheck, setIsMobileCheck] = useState(false);

  const gameArea = useRef(null);
  const [nickname, setNickname] = useState(null);
  const [playType, setPlayType] = useState("single");

  useEffect(() => {
    // 페이지 로딩시 스테이지 초기화 및 플레이어 닉네임 생성
    setStage(createStage());
    setNickname(`Player_${uuidv4().slice(0, 8)}`);
  }, []);

  useEffect(() => {
    // 모바일 기기 체크
    if (isMobile) {
      setIsMobileCheck(true);
    }
  }, []);

  useEffect(() => {
    // 닉네임이 생성되면 서버에 전송
    if (!socket.connected || !nickname) {
      return;
    }

    socket.emit("setNickname", { nickname });
  }, [nickname]);

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
      setIsConnected(false);
    }
    function onViewGameList({ playingGameList }) {
      setPlayingGameList(playingGameList);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("viewGameList", onViewGameList);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

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
          <div className="bg-white p-5 rounded w">
            {gameOver ? (
              <div className="flex flex-col items-center gap-5">
                <div>게임오버</div>
                <div>
                  <div>게임 스코어 : {score}</div>
                  <div>처리한 줄 갯수 : {rows}</div>
                  <div>달성한 레벨 : {level}</div>
                </div>

                <div
                  onClick={() => {
                    setGameStart(false);
                    setGameOver(false);
                    setStage(createStage());
                  }}
                  className="cursor-pointer bg-gray-800 text-white p-2 rounded"
                >
                  처음으로
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <div>닉네임 : {nickname}</div>
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
                          socket.emit("viewGameWaitingJoin");
                        } else if (
                          playType == "view" &&
                          e.target.value != "view"
                        ) {
                          socket.emit("viewGameWaitingLeave");
                        } else if (
                          e.target.value.includes("multi") &&
                          isMobile
                        ) {
                          alert(
                            "모바일에서는 멀티플레이시 상대방플레이 화면을 볼 수 없습니다."
                          );
                          return;
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
                <div
                  onClick={handleStartGame}
                  className="cursor-pointer bg-gray-800 text-white p-2 rounded"
                >
                  게임 시작
                </div>{" "}
                <div
                  onClick={handleStartGame}
                  className="cursor-pointer bg-gray-800 text-white p-2 rounded"
                >
                  매칭 시작
                </div>
                <div>
                  <div>현재 진행중인 게임</div>
                </div>
                <div
                  onClick={handleStartGame}
                  className="cursor-pointer bg-gray-800 text-white p-2 rounded"
                >
                  관전 시작
                </div>
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
        <div className="display h-1/6 justify-center items-center ">
          {/* <div>
            서버 :
            
          </div> */}
          <div className="flex gap-5">
            <div>스코어 {score}</div>
            <div>줄 {rows}</div>
            <div>레벨 {level}</div>
            {/* <div
              onClick={() => {
                insertRandomRow();
              }}
              className="cursor-pointer"
            >
              피해부여 테스트
            </div> */}
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
        {playType != "view" && (
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
