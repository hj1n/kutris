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
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicon/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/favicon-16x16.png"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
