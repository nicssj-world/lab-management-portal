// PUT a file to a presigned R2 URL with upload-progress reporting. Shared by the
// revision-draft upload flow (RevisionPanel) and the pending-page document action panel.
export function uploadFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }
      reject(new Error(`(${xhr.status}) ${xhr.responseText.slice(0, 160)}`))
    }
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(file)
  })
}
