import React from "react";
import Cell from "./Cell";
export default function GameBoard({
  stage,
  score,
  rows,
  level,
  isConnected,
  drop,
}) {
  return (
    <div>
      <div className="display h-1/6 justify-center items-center my-2">
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
          onClick={() => {
            drop();
          }}
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
    </div>
  );
}
