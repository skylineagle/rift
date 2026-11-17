export type Direction = "AB" | "BA";

export type LogRow = { id: number; direction: Direction; time: string; text: string; injected?: boolean };

const AB = ["$PMTK220,1000*1F\r\n", "$PMTK314,0,1,0,1,1,5,0,0,0,0,0,0,0,0,0,0,0,0,0*2C\r\n", "$PUBX,40,GLL,0,0,0,0*5C\r\n", "$PMTK605*31\r\n"];
const BA = [
  "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47\r\n",
  "$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A\r\n",
  "$GPGSA,A,3,04,05,,09,12,,,24,,,,,2.5,1.3,2.1*39\r\n",
  "$GPVTG,054.7,T,034.4,M,005.5,N,010.2,K*48\r\n",
];

export const PATTERN: Direction[] = ["AB", "BA", "BA", "AB", "BA", "AB", "BA", "AB", "BA", "BA", "AB", "BA", "AB", "AB"];

const clock = (index: number) => `10:24:${String(2 + Math.floor(index / 4)).padStart(2, "0")}.${String((index * 137) % 1000).padStart(3, "0")}`;

export const STREAM: LogRow[] = PATTERN.map((direction, index) => ({
  id: index,
  direction,
  time: clock(index),
  text: direction === "AB" ? AB[index % AB.length] : BA[index % BA.length],
}));

export const INJECT_TEXT = "$PUBX,00*33\\r\\n";
export const INJECT_ROW: LogRow = { id: 100, direction: "AB", time: "10:24:09.412", text: "$PUBX,00*33\r\n", injected: true };
export const REPLY_ROW: LogRow = { id: 101, direction: "BA", time: "10:24:09.538", text: "$PUBX,00,123519.00,4807.0380,N,01131.0000,E,545.4,G3,2.1,2.0*6B\r\n" };

export const PROFILES = ["gps", "modem", "imu"] as const;

export const COMMAND = 'rift pipe tcp-server://0.0.0.0:9000 "uart:///dev/ttyUSB0?baud=115200"';

const hex = (text: string) => Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).padStart(2, "0")).join(" ");
const escaped = (text: string) => text.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
const cliData = (time: string, arrow: string, text: string) => `${time} adhoc ${arrow} ${new TextEncoder().encode(text).length}B  ${hex(text)}  |${escaped(text)}|`;

export const CLI_LINES = [
  "10:24:01.112 adhoc A listening",
  "10:24:01.118 adhoc B connected /dev/ttyUSB0",
  "10:24:02.540 adhoc A connected 192.168.1.42:51822",
  cliData("10:24:02.611", "A→B", "$PMTK605*31\r\n"),
  cliData("10:24:02.648", "B→A", "$GPVTG,054.7,T*48\r\n"),
  cliData("10:24:03.002", "B→A", "$GPGLL,4916.45,N*31\r\n"),
  cliData("10:24:03.115", "A→B", "$PUBX,00*33\r\n"),
  cliData("10:24:03.240", "B→A", "$GPGSV,1,1,08*7A\r\n"),
];
