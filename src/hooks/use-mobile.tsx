import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT || isTouchDevice)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT || isTouchDevice)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
