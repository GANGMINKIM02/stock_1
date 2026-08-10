export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const maxSizeBytes = 5 * 1024 * 1024;

  if (!file) {
    return { valid: false, error: '파일이 선택되지 않았습니다.' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'PNG, JPG, JPEG, WEBP 형식만 업로드할 수 있습니다.' };
  }

  if (file.size === 0) {
    return { valid: false, error: '빈 파일은 업로드할 수 없습니다.' };
  }

  if (file.size > maxSizeBytes) {
    return { valid: false, error: '파일 크기는 5MB 이하만 허용됩니다.' };
  }

  return { valid: true };
}

export async function isImageCorrupted(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(false);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(true);
    };

    image.src = objectUrl;
  });
}
