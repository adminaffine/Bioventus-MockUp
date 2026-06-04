export type MonthOnMonthSeriesConfig = {
  dataKey: string;
  name: string;
  color: string;
  format?: "money" | "number";
  yAxisId?: "left" | "right";
};

export type MonthOnMonthPoint = {
  month: string;
  [key: string]: string | number;
};
