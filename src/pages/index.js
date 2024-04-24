import React, { useCallback, useEffect, useRef, useState } from "react";
import { createStage, isColliding, randomTetromino } from "@/utils/gameHelper";
import { ROWPOINTS, STAGE_WIDTH } from "@/utils/gameSetup";
import Cell from "@/components/Cell";

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
        if (row.findIndex((cell) => cell[0] === 0) === -1) {
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
  const [gameOver, setGameOver] = useState(true);
  const gameArea = useRef(null);

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
    if (gameArea.current) gameArea.current.focus();
    setStage(createStage());
    setDroptime(1000);
    resetPlayer();
    setScore(0);
    setLevel(1);
    setRows(0);
    setGameOver(false);
  };

  const move = ({ keyCode, repeat }) => {
    if (!gameOver) {
      if (keyCode === 37) {
        movePlayer(-1);
      } else if (keyCode === 39) {
        movePlayer(1);
      } else if (keyCode === 40 && !repeat) {
        setDroptime(30);
      } else if (keyCode === 38) {
        playerRotate(stage);
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

  useInterval(() => {
    drop();
  }, dropTime);
  return (
    <main className="bg-white">
      <div
        tabIndex="0"
        onKeyDown={(e) => move(e)}
        onKeyUp={(e) => keyUp(e)}
        ref={gameArea}
        id="tetrisWrapper"
        className="w-full h-screen overflow-hidden outline-none"
      >
        <div
          id="tetrisContainer"
          className="flex flex-col items-center p-40 mx-auto"
        >
          <div className="display">
            {gameOver ? (
              <div className="flex gap-5">
                <div>게임오버</div>
                <div onClick={handleStartGame}>게임시작</div>
              </div>
            ) : (
              <div className="flex gap-5">
                <div>스코어 {score}</div>
                <div>줄 {rows}</div>
                <div>레벨 {level}</div>
              </div>
            )}
          </div>
          <div>
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(12, 30px)`,
                gridTemplateRows: `repeat(20, 30px)`,
                gridGap: "1px",
                border: "1px solid #777",
                background: "#222",
              }}
            >
              {stage.map((row, y) =>
                row.map((cell, x) => <Cell key={x} type={cell[0]} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
