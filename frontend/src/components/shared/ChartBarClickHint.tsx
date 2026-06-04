type Props = {
  message?: string;
};

export default function ChartBarClickHint({
  message = "Click on the bar to open the full issue detail for that account",
}: Props) {
  return (
    <p className="shrink-0 text-center text-xs text-slate-500 dark:text-slate-400" role="note">
      {message}
    </p>
  );
}
