export const uploadImageToCloudinary = async (file, onProgress) => {
  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", "Chat_images");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", "https://api.cloudinary.com/v1_1/du3hiflqj/image/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      const response = JSON.parse(xhr.responseText);
      if (response.secure_url) {
        resolve(response.secure_url);
      } else {
        reject(response);
      }
    };

    xhr.onerror = () => reject("Upload error");

    xhr.send(data);
  });
};
