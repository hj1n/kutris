import "@/styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>::: KUTRIS :::</title>
        <meta name="title" property="og:title" content="::: KUTRIS :::" />
        <meta
          name="description"
          property="og:description"
          content="웹기반 테트리스 게임"
        />
        <meta
          name="image"
          property="og:image"
          content="https://kutris.vercel.app/kutris.png"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
