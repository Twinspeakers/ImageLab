export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`

export const deepClone = <T>(input: T): T => structuredClone(input)

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export const isMac = () => navigator.platform.toLowerCase().includes('mac')

export const modKey = () => (isMac() ? 'Cmd' : 'Ctrl')

export const eventHasMod = (event: KeyboardEvent | WheelEvent) => event.metaKey || event.ctrlKey

export const debounce = <T extends (...args: never[]) => void>(fn: T, wait = 300) => {
  let timeout: number | null = null
  return (...args: Parameters<T>) => {
    if (timeout !== null) {
      window.clearTimeout(timeout)
    }
    timeout = window.setTimeout(() => fn(...args), wait)
  }
}

export const toDataUrl = async (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
