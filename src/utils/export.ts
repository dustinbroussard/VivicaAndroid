import { Capacitor } from '@capacitor/core';

// Optional dynamic imports avoid bundling on web if tree-shaken
async function writeAndShareNative(filename: string, json: string) {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  // Write to cache so we can share it; avoids storage permission prompts
  await Filesystem.writeFile({
    path: filename,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });

  // Share the file so the user can save to Downloads/Drive/Files
  await Share.share({
    url: uri,
    title: 'Export from Vivica',
    text: filename,
    dialogTitle: 'Save or share export',
  });
}

function downloadViaAnchor(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportJsonFile(filename: string, data: unknown) {
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  try {
    if (Capacitor.isNativePlatform()) {
      await writeAndShareNative(filename, json);
    } else {
      downloadViaAnchor(filename, json);
    }
  } catch (_) {
    // Fallback to anchor if native flow fails for any reason
    downloadViaAnchor(filename, json);
  }
}

