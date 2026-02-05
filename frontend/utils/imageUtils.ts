/**
 * Resize and compress an image file to a data URL
 * @param file The file to process
 * @param maxWidth Maximum width
 * @param maxHeight Maximum height
 * @param quality Quality (0 to 1)
 * @returns Promise resolving to the data URL string
 */
export const resizeImage = (
    file: File,
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                // Convert to JPEG with specified quality (usually much smaller than PNG or raw)
                resolve(canvas.toDataURL('image/jpeg', quality));
            };

            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
