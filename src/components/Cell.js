// Cell.js
import React from "react";
import { TETROMINOS } from "@/utils/gameSetup";
const Cell = ({ type }) => {
  console.log(type);
  return (
    <div
      className={`w-[100%] h-[100%] ${type === 0 ? "bg-black" : "bg-white"}`}
      type={type}
    />
  );
};

export default React.memo(Cell);
