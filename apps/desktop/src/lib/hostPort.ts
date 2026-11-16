export type HostPort = { host: string; port: string };

const MIN_PORT = 1;
const MAX_PORT = 65535;

export const parseHostPort = (address: string): HostPort => {
  const bracketed = address.match(/^\[(.*)\]:(\d*)$/);
  if (bracketed) return { host: bracketed[1], port: bracketed[2] };
  const separator = address.lastIndexOf(":");
  const isSingleColon = separator >= 0 && separator === address.indexOf(":");
  if (!isSingleColon) return { host: address, port: "" };
  return { host: address.slice(0, separator), port: address.slice(separator + 1) };
};

export const joinHostPort = ({ host, port }: HostPort) =>
  host.includes(":") ? `[${host}]:${port}` : `${host}:${port}`;

export const isValidPort = (port: string) => {
  const value = Number(port);
  return /^\d+$/.test(port) && value >= MIN_PORT && value <= MAX_PORT;
};
