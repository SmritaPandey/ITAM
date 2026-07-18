// Jest CJS shim for the ESM-only `meilisearch` package. The e2e smoke never
// sets MEILI_HOST, so SearchService never instantiates the client.
export class Index {}
export class Meilisearch {
  constructor(_config?: unknown) {
    throw new Error('meilisearch is stubbed in e2e tests');
  }
}
export default Meilisearch;
