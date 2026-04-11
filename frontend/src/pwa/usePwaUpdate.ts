import { useRegisterSW } from 'virtual:pwa-register/react'

export const usePwaUpdate = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })

  return { needRefresh, updateServiceWorker }
}
