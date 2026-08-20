import type { AppApi } from '../shared/api'

export type { AppApi }

declare global {
  interface Window {
    api: AppApi
  }
}

export {}
