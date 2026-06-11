import { useEffect, useMemo } from 'react';

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(',', 2);

  if (!header || !encoded) {
    return null;
  }

  const mimeMatch = header.match(/^data:(.*?);base64$/);
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export function useAvatarObjectUrl(source: string) {
  const objectUrl = useMemo(() => {
    if (!source) {
      return '';
    }

    if (!source.startsWith('data:')) {
      return source;
    }

    const blob = dataUrlToBlob(source);

    return blob ? URL.createObjectURL(blob) : '';
  }, [source]);

  useEffect(() => {
    return () => {
      if (objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  return objectUrl;
}
