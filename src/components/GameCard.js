export default function GameCard({
  selectedPlayingGame,
  gameId,
  gameType,
  playerList,
}) {
  const isSelected = selectedPlayingGame === gameId;
  const baseClass =
    "flex items-center text-base text-gray-900 rounded-lg hover:shadow";

  const conditionalClass = isSelected
    ? "bg-green-500 hover:bg-green-300"
    : "bg-gray-50 hover:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500";

  const pList = playerList.map((player) => player.replace("Player_", ""));

  return (
    <div className={`${baseClass} ${conditionalClass} group dark:text-white`}>
      {gameType === "single" ? (
        <>
          <svg
            className="w-[21px] h-[21px] text-gray-800 dark:text-white"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke="currentColor"
              strokeWidth="2"
              d="M7 17v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3Zm8-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
          <span className="flex-1 ms-3 whitespace-nowrap">{pList[0]}</span>
        </>
      ) : (
        <>
          {" "}
          <svg
            className="w-[21px] h-[21px] text-gray-800 dark:text-white"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              d="M16 19h4a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-2m-2.236-4a3 3 0 1 0 0-4M3 18v-1a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm8-10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
          <span className="flex-1 ms-3 whitespace-nowrap">
            {pList[0]} vs {pList[1]}
          </span>
        </>
      )}
    </div>
  );
}
