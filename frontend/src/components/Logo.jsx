export default function Logo({ className = 'w-[22px] h-[22px]' }) {
  return (
    <div
      className={`${className} bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center flex-shrink-0`}
    >
      <svg
        viewBox="0 0 32 32"
        className="w-[68%] h-[68%] text-white dark:text-zinc-900"
        fill="currentColor"
      >
        <circle cx="11" cy="11" r="5.5" />
        <circle cx="21" cy="11" r="5.5" />
        <circle cx="11" cy="21" r="5.5" />
        <circle cx="21" cy="21" r="5.5" />
        <path
          d="M16 22 L16 30"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
