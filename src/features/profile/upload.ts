import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '../../../lib/supabase';

// Uploads a picked file to a storage bucket. On the web the picked file is a blob URL / data
// URI the browser can fetch; on phones it is a file on disk that has to be read as base64.
export async function uploadFileToBucket(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
  options: { upsert?: boolean } = {}
): Promise<void> {
  const body =
    Platform.OS === 'web'
      ? await (await fetch(uri)).blob()
      : decode(
          await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          })
        );

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: options.upsert ?? false,
    cacheControl: '3600',
  });
  if (error) throw error;
}
