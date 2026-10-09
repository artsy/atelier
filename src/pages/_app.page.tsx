import type { AppProps } from "next/app";
import { Boot } from "../components/Boot";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Boot>
      <Component {...pageProps} />
    </Boot>
  );
}
