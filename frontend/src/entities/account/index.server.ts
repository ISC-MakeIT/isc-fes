// server-only関数をindex.tsにまとめると、CSCからindex.tsをインポートした時、依存にserver-onlyの関数も含まれてしまいエラーが起きる
// https://feature-sliced.design/docs/guides/tech/with-nextjs#server-and-client-public-apis

export { getAccount } from "./api/getAccount";
